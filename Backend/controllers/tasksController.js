const prisma = require('../config/database');

const STATUSES = ['TODO', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const COMPLETION_THRESHOLD = 0.75;
const MAX_TITLE_LENGTH = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clean = (val) => (typeof val === 'string' ? val.trim() : val);
const fail = (res, code, message) => res.status(code).json({ error: message });
const serverError = (res, error) => {
  console.error(error);
  return res.status(500).json({ error: 'Internal server error' });
};
const ms = (date) => (date ? new Date(date).getTime() : null);
const toInt = (val) => parseInt(val, 10);
const elapsedBetween = (start, end) =>
  Math.floor((end - start) / 1000);

const isLocked = (status) => status === 'COMPLETED';

const findOwnedTask = (id, userId) =>
  prisma.task.findFirst({ where: { id, userId } });
const findOwnedWorkspace = (id, userId) =>
  prisma.workspace.findFirst({ where: { id, userId } });

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

/**
 * @param {object} task  – Prisma task row
 * @param {number} [spent=0] – pre-computed spentSeconds (sum of committed sessions)
 */
const serializeTask = (task, spent = 0) => ({
  id: task.id,
  title: task.title,
  description: task.description ?? null,
  status: task.status,
  priority: task.priority,
  workspaceId: task.workspaceId,
  position: task.position,
  createdAt: ms(task.createdAt),
  updatedAt: ms(task.updatedAt),
  // ── Duration / scheduling fields the frontend expects ──────────────────
  plannedDurationSeconds: task.plannedDurationSeconds ?? 0,
  actualDurationSeconds: task.actualDurationSeconds ?? spent,
  spentSeconds: spent,
  startDate: ms(task.startDate),
  deadlineDate: ms(task.deadlineDate),
  startedAt: ms(task.startedAt),
  completedAt: ms(task.completedAt),
});

const serializeSession = (session) => ({
  id: session.id,
  taskId: session.taskId,
  startedAt: ms(session.startedAt),
  endedAt: ms(session.endedAt),
  committedSeconds: session.committedSeconds,
});

const serializeWorkspace = (ws) => ({
  id: ws.id,
  name: ws.name,
  description: ws.description ?? null,
  createdAt: ms(ws.createdAt),
  updatedAt: ms(ws.updatedAt),
});

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

const listTasks = (where) =>
  prisma.task.findMany({
    where,
    orderBy: [{ workspaceId: 'asc' }, { position: 'asc' }],
  });

// ---------------------------------------------------------------------------
// Positioning helpers
// ---------------------------------------------------------------------------

const nextPosition = async (tx, where) => {
  const last = await tx.task.findFirst({
    where,
    orderBy: { position: 'desc' },
  });
  return last ? last.position + 1 : 0;
};

const reindexColumn = async (
  tx,
  { userId, workspaceId, status },
  startPosition = 0,
) => {
  const tasks = await tx.task.findMany({
    where: { userId, workspaceId, status, position: { gte: startPosition } },
    orderBy: { position: 'asc' },
  });
  for (let i = 0; i < tasks.length; i++) {
    await tx.task.update({
      where: { id: tasks[i].id },
      data: { position: startPosition + i },
    });
  }
};

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

const openSessionWhere = (taskId) => ({ taskId, endedAt: null });

const openSession = (tx, taskId) =>
  tx.session.create({ data: { taskId } });

const closeSession = async (tx, session, forceTime = null) => {
  const ended = forceTime || new Date();
  const elapsed = elapsedBetween(session.startedAt, ended);
  return tx.session.update({
    where: { id: session.id },
    data: {
      endedAt: ended,
      committedSeconds: Math.max(0, elapsed),
    },
  });
};

const spentSeconds = async (taskId) => {
  const agg = await prisma.session.aggregate({
    where: { taskId },
    _sum: { committedSeconds: true },
  });
  return agg._sum.committedSeconds || 0;
};

const canStart = async (userId) => {
  const count = await prisma.session.count({
    where: { task: { userId }, endedAt: null },
  });
  return count === 0;
};

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const recordActivity = (tx, userId, type, metadata = {}) =>
  tx.activity.create({ data: { userId, type, metadata } });

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates + coerces task fields from req.body.
 * `partial = true` skips "required" checks (used for PATCH).
 */
const buildTaskData = (body, partial = false) => {
  const data = {};
  const errors = [];

  // title
  if (body.title !== undefined || !partial) {
    const title = clean(body.title);
    if (!title) {
      errors.push('Title is required');
    } else if (title.length > MAX_TITLE_LENGTH) {
      errors.push(`Title must be less than ${MAX_TITLE_LENGTH} characters`);
    } else {
      data.title = title;
    }
  }

  // description
  if (body.description !== undefined) {
    data.description = clean(body.description) || '';
  }

  // workspaceId
  if (body.workspaceId !== undefined || !partial) {
    const workspaceId = clean(body.workspaceId);
    if (!workspaceId) {
      errors.push('Workspace ID is required');
    } else {
      data.workspaceId = workspaceId;
    }
  }

  // status
  if (body.status !== undefined || !partial) {
    const status = clean(body.status);
    if (status && !STATUSES.includes(status)) {
      errors.push(`Status must be one of: ${STATUSES.join(', ')}`);
    } else if (status) {
      data.status = status;
    } else if (!partial) {
      errors.push('Status is required');
    }
  }

  // priority
  if (body.priority !== undefined || !partial) {
    const priority = clean(body.priority);
    if (priority && !PRIORITIES.includes(priority)) {
      errors.push(`Priority must be one of: ${PRIORITIES.join(', ')}`);
    } else if (priority) {
      data.priority = priority;
    } else if (!partial) {
      errors.push('Priority is required');
    }
  }

  // ── NEW: scheduling / duration fields ────────────────────────────────────

  // plannedDurationSeconds
  if (body.plannedDurationSeconds !== undefined) {
    const secs = toInt(body.plannedDurationSeconds);
    if (!isNaN(secs) && secs >= 0) {
      data.plannedDurationSeconds = secs;
    }
  }

  // startDate  (accept epoch ms from frontend)
  if (body.startDate !== undefined) {
    if (body.startDate === null) {
      data.startDate = null;
    } else {
      const d = new Date(body.startDate);
      if (!isNaN(d.getTime())) data.startDate = d;
    }
  }

  // deadlineDate
  if (body.deadlineDate !== undefined) {
    if (body.deadlineDate === null) {
      data.deadlineDate = null;
    } else {
      const d = new Date(body.deadlineDate);
      if (!isNaN(d.getTime())) data.deadlineDate = d;
    }
  }

  return { data, errors };
};

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

class TasksController {
  // ── GET /api/tasks ────────────────────────────────────────────────────────
  static async getTasks(req, res) {
    try {
      const userId = req.user.id;
      const where = { userId };
      if (req.query.workspaceId) where.workspaceId = req.query.workspaceId;
      if (req.query.status) where.status = req.query.status;

      const [tasks, workspaces, activeSession] = await Promise.all([
        listTasks(where),
        prisma.workspace.findMany({
          where: { userId },
          orderBy: { name: 'asc' },
        }),
        prisma.session.findFirst({
          where: { task: { userId }, endedAt: null },
          include: { task: true },
        }),
      ]);

      // Attach spentSeconds to each task efficiently
      const taskIds = tasks.map((t) => t.id);
      const spentAgg = await prisma.session.groupBy({
        by: ['taskId'],
        where: { taskId: { in: taskIds } },
        _sum: { committedSeconds: true },
      });
      const spentMap = Object.fromEntries(
        spentAgg.map((r) => [r.taskId, r._sum.committedSeconds ?? 0]),
      );

      return res.json({
        tasks: tasks.map((t) => serializeTask(t, spentMap[t.id] ?? 0)),
        workspaces: workspaces.map(serializeWorkspace),
        activeSession: activeSession
          ? { ...serializeSession(activeSession), taskId: activeSession.taskId }
          : null,
      });
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── GET /api/tasks/today ──────────────────────────────────────────────────
  static async getTodayTasks(req, res) {
    try {
      const userId = req.user.id;
      const today = startOfDay();

      const tasks = await prisma.task.findMany({
        where: {
          userId,
          OR: [
            { status: { in: ['IN_PROGRESS', 'TODO'] } },
            { updatedAt: { gte: today } },
          ],
        },
        orderBy: [{ workspaceId: 'asc' }, { position: 'asc' }],
      });

      return res.json(tasks.map((t) => serializeTask(t)));
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── GET /api/tasks/:taskId ────────────────────────────────────────────────
  static async getTaskById(req, res) {
    try {
      const userId = req.user.id;
      const task = await findOwnedTask(req.params.taskId, userId);
      if (!task) return fail(res, 404, 'Task not found');

      const [spent, activeSession] = await Promise.all([
        spentSeconds(task.id),
        prisma.session.findFirst({ where: openSessionWhere(task.id) }),
      ]);

      return res.json({
        ...serializeTask(task, spent),
        activeSession: activeSession ? serializeSession(activeSession) : null,
      });
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── POST /api/tasks ───────────────────────────────────────────────────────
  static async createTask(req, res) {
    try {
      const userId = req.user.id;

      // Apply defaults before validation
      const body = {
        status: 'TODO',
        priority: 'MEDIUM',
        description: '',
        plannedDurationSeconds: 0,
        ...req.body,
      };

      const { data, errors } = buildTaskData(body);
      if (errors.length > 0) return fail(res, 400, errors.join(', '));

      if (data.status === 'IN_PROGRESS') {
        const can = await canStart(userId);
        if (!can)
          return fail(
            res,
            400,
            'Cannot create an IN_PROGRESS task while another task is active',
          );
      }

      const workspace = await findOwnedWorkspace(data.workspaceId, userId);
      if (!workspace) return fail(res, 404, 'Workspace not found');

      const task = await prisma.$transaction(async (tx) => {
        const position = await nextPosition(tx, {
          userId,
          workspaceId: data.workspaceId,
          status: data.status,
        });

        const t = await tx.task.create({
          data: {
            userId,
            title: data.title,
            description: data.description ?? '',
            workspaceId: data.workspaceId,
            status: data.status,
            priority: data.priority,
            position,
            plannedDurationSeconds: data.plannedDurationSeconds ?? 0,
            startDate: data.startDate ?? null,
            deadlineDate: data.deadlineDate ?? null,
          },
        });

        await recordActivity(tx, userId, 'TASK_CREATED', {
          taskId: t.id,
          title: t.title,
          workspaceId: t.workspaceId,
        });

        if (t.status === 'IN_PROGRESS') {
          await openSession(tx, t.id);
        }

        return t;
      });

      return res.status(201).json(serializeTask(task));
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── PATCH /api/tasks/:taskId ──────────────────────────────────────────────
  static async updateTask(req, res) {
    try {
      const userId = req.user.id;
      const task = await findOwnedTask(req.params.taskId, userId);
      if (!task) return fail(res, 404, 'Task not found');
      if (isLocked(task.status)) return fail(res, 400, 'Cannot update a completed task');

      const { data, errors } = buildTaskData(req.body, true);
      if (errors.length > 0) return fail(res, 400, errors.join(', '));

      delete data.status; // status changes use specialized endpoints

      if (Object.keys(data).length === 0) {
        const spent = await spentSeconds(task.id);
        return res.json(serializeTask(task, spent));
      }

      if (data.workspaceId && data.workspaceId !== task.workspaceId) {
        const ws = await findOwnedWorkspace(data.workspaceId, userId);
        if (!ws) return fail(res, 404, 'Workspace not found');
      }

      const updated = await prisma.$transaction(async (tx) => {
        const movedWorkspace =
          data.workspaceId && data.workspaceId !== task.workspaceId;
        const finalData = { ...data };

        if (movedWorkspace) {
          finalData.position = await nextPosition(tx, {
            userId,
            workspaceId: data.workspaceId,
            status: task.status,
          });
        }

        const u = await tx.task.update({ where: { id: task.id }, data: finalData });

        if (movedWorkspace) {
          await reindexColumn(tx, {
            userId,
            workspaceId: task.workspaceId,
            status: task.status,
          });
        }

        await recordActivity(tx, userId, 'TASK_UPDATED', {
          taskId: u.id,
          changes: Object.keys(data),
        });

        return u;
      });

      const spent = await spentSeconds(updated.id);
      return res.json(serializeTask(updated, spent));
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── DELETE /api/tasks/:taskId ─────────────────────────────────────────────
  static async deleteTask(req, res) {
    try {
      const userId = req.user.id;
      const task = await findOwnedTask(req.params.taskId, userId);
      if (!task) return fail(res, 404, 'Task not found');

      await prisma.$transaction(async (tx) => {
        const session = await tx.session.findFirst({
          where: openSessionWhere(task.id),
        });
        if (session) await closeSession(tx, session);

        await tx.task.delete({ where: { id: task.id } });

        await recordActivity(tx, userId, 'TASK_DELETED', {
          taskId: task.id,
          title: task.title,
          workspaceId: task.workspaceId,
        });

        await reindexColumn(
          tx,
          { userId, workspaceId: task.workspaceId, status: task.status },
          task.position,
        );
      });

      return res.status(204).send();
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── PATCH /api/tasks/:taskId/move ─────────────────────────────────────────
  static async moveTask(req, res) {
    try {
      const userId = req.user.id;
      const { status, index, workspaceId } = req.body;

      const task = await findOwnedTask(req.params.taskId, userId);
      if (!task) return fail(res, 404, 'Task not found');

      const newStatus = status ? clean(status) : task.status;
      if (!STATUSES.includes(newStatus)) return fail(res, 400, 'Invalid status');

      const newWorkspaceId = workspaceId ? clean(workspaceId) : task.workspaceId;
      if (newWorkspaceId !== task.workspaceId) {
        const ws = await findOwnedWorkspace(newWorkspaceId, userId);
        if (!ws) return fail(res, 404, 'Workspace not found');
      }

      const movedCol =
        newStatus !== task.status || newWorkspaceId !== task.workspaceId;
      const targetIndex = index !== undefined ? toInt(index) : null;

      if (!movedCol && targetIndex === null) {
        const spent = await spentSeconds(task.id);
        return res.json(serializeTask(task, spent));
      }

      if (newStatus === 'IN_PROGRESS' && task.status !== 'IN_PROGRESS') {
        const can = await canStart(userId);
        if (!can) return fail(res, 400, 'Cannot start task while another is active');
      }

      const updated = await prisma.$transaction(async (tx) => {
        let finalPos = task.position;

        if (movedCol) {
          finalPos = await nextPosition(tx, {
            userId,
            workspaceId: newWorkspaceId,
            status: newStatus,
          });
        }

        if (targetIndex !== null) {
          const count = await tx.task.count({
            where: { userId, workspaceId: newWorkspaceId, status: newStatus },
          });
          const maxIdx = movedCol ? count : count - 1;
          finalPos = Math.max(0, Math.min(targetIndex, maxIdx));
        }

        let u;

        if (!movedCol && finalPos !== task.position) {
          const up = finalPos < task.position;
          await tx.task.updateMany({
            where: {
              userId,
              workspaceId: newWorkspaceId,
              status: newStatus,
              position: up
                ? { gte: finalPos, lt: task.position }
                : { gt: task.position, lte: finalPos },
            },
            data: { position: up ? { increment: 1 } : { decrement: 1 } },
          });
          u = await tx.task.update({
            where: { id: task.id },
            data: { position: finalPos },
          });
        } else if (movedCol) {
          await tx.task.updateMany({
            where: {
              userId,
              workspaceId: newWorkspaceId,
              status: newStatus,
              position: { gte: finalPos },
            },
            data: { position: { increment: 1 } },
          });

          u = await tx.task.update({
            where: { id: task.id },
            data: {
              status: newStatus,
              workspaceId: newWorkspaceId,
              position: finalPos,
              // stamp startedAt / completedAt
              ...(newStatus === 'IN_PROGRESS' && task.status !== 'IN_PROGRESS'
                ? { startedAt: new Date() }
                : {}),
              ...(newStatus === 'COMPLETED'
                ? { completedAt: new Date() }
                : {}),
            },
          });

          await reindexColumn(tx, {
            userId,
            workspaceId: task.workspaceId,
            status: task.status,
          }, task.position + 1);
        } else {
          u = task;
        }

        if (newStatus !== task.status) {
          if (newStatus === 'IN_PROGRESS') {
            await openSession(tx, u.id);
            await recordActivity(tx, userId, 'TASK_STARTED', { taskId: u.id });
          } else if (task.status === 'IN_PROGRESS') {
            const session = await tx.session.findFirst({
              where: openSessionWhere(u.id),
            });
            if (session) {
              const closed = await closeSession(tx, session);
              if (closed.committedSeconds > 0) {
                await recordActivity(tx, userId, 'SESSION_COMPLETED', {
                  taskId: u.id,
                  seconds: closed.committedSeconds,
                });
              }
            }
            const actType =
              newStatus === 'COMPLETED' ? 'TASK_COMPLETED' : 'STATUS_CHANGED';
            await recordActivity(tx, userId, actType, {
              taskId: u.id,
              from: task.status,
              to: newStatus,
            });
          } else {
            const actType =
              newStatus === 'COMPLETED' ? 'TASK_COMPLETED' : 'STATUS_CHANGED';
            await recordActivity(tx, userId, actType, {
              taskId: u.id,
              from: task.status,
              to: newStatus,
            });
          }
        }

        return u;
      });

      const spent = await spentSeconds(updated.id);
      return res.json(serializeTask(updated, spent));
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── POST /api/tasks/:taskId/start ─────────────────────────────────────────
  static async startTask(req, res) {
    try {
      const userId = req.user.id;
      const task = await findOwnedTask(req.params.taskId, userId);
      if (!task) return fail(res, 404, 'Task not found');
      if (task.status === 'IN_PROGRESS') {
        const spent = await spentSeconds(task.id);
        return res.json(serializeTask(task, spent));
      }
      if (isLocked(task.status)) return fail(res, 400, 'Task is locked');

      const can = await canStart(userId);
      if (!can) return fail(res, 400, 'Another task is already active');

      const updated = await prisma.$transaction(async (tx) => {
        const pos = await nextPosition(tx, {
          userId,
          workspaceId: task.workspaceId,
          status: 'IN_PROGRESS',
        });

        const u = await tx.task.update({
          where: { id: task.id },
          data: {
            status: 'IN_PROGRESS',
            position: pos,
            startedAt: task.startedAt ?? new Date(),
          },
        });

        await reindexColumn(
          tx,
          { userId, workspaceId: task.workspaceId, status: task.status },
          task.position + 1,
        );

        await openSession(tx, task.id);
        await recordActivity(tx, userId, 'TASK_STARTED', { taskId: task.id });

        return u;
      });

      const spent = await spentSeconds(updated.id);
      return res.json(serializeTask(updated, spent));
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── POST /api/tasks/:taskId/hold ──────────────────────────────────────────
  static async holdTask(req, res) {
    try {
      const userId = req.user.id;
      const task = await findOwnedTask(req.params.taskId, userId);
      if (!task) return fail(res, 404, 'Task not found');
      if (task.status === 'ON_HOLD') {
        const spent = await spentSeconds(task.id);
        return res.json(serializeTask(task, spent));
      }
      if (isLocked(task.status)) return fail(res, 400, 'Task is locked');

      const updated = await prisma.$transaction(async (tx) => {
        if (task.status === 'IN_PROGRESS') {
          const session = await tx.session.findFirst({
            where: openSessionWhere(task.id),
          });
          if (session) {
            const closed = await closeSession(tx, session);
            if (closed.committedSeconds > 0) {
              await recordActivity(tx, userId, 'SESSION_COMPLETED', {
                taskId: task.id,
                seconds: closed.committedSeconds,
              });
            }
          }
        }

        const pos = await nextPosition(tx, {
          userId,
          workspaceId: task.workspaceId,
          status: 'ON_HOLD',
        });

        const u = await tx.task.update({
          where: { id: task.id },
          data: { status: 'ON_HOLD', position: pos },
        });

        await reindexColumn(
          tx,
          { userId, workspaceId: task.workspaceId, status: task.status },
          task.position + 1,
        );

        await recordActivity(tx, userId, 'STATUS_CHANGED', {
          taskId: task.id,
          from: task.status,
          to: 'ON_HOLD',
        });

        return u;
      });

      const spent = await spentSeconds(updated.id);
      return res.json(serializeTask(updated, spent));
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── POST /api/tasks/:taskId/complete ──────────────────────────────────────
  static async completeTask(req, res) {
    try {
      const userId = req.user.id;
      const task = await findOwnedTask(req.params.taskId, userId);
      if (!task) return fail(res, 404, 'Task not found');
      if (task.status === 'COMPLETED') {
        const spent = await spentSeconds(task.id);
        return res.json(serializeTask(task, spent));
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (task.status === 'IN_PROGRESS') {
          const session = await tx.session.findFirst({
            where: openSessionWhere(task.id),
          });
          if (session) {
            const closed = await closeSession(tx, session);
            if (closed.committedSeconds > 0) {
              await recordActivity(tx, userId, 'SESSION_COMPLETED', {
                taskId: task.id,
                seconds: closed.committedSeconds,
              });
            }
          }
        }

        const pos = await nextPosition(tx, {
          userId,
          workspaceId: task.workspaceId,
          status: 'COMPLETED',
        });

        const u = await tx.task.update({
          where: { id: task.id },
          data: { status: 'COMPLETED', position: pos, completedAt: new Date() },
        });

        await reindexColumn(
          tx,
          { userId, workspaceId: task.workspaceId, status: task.status },
          task.position + 1,
        );

        await recordActivity(tx, userId, 'TASK_COMPLETED', { taskId: task.id });

        return u;
      });

      const spent = await spentSeconds(updated.id);
      return res.json(serializeTask(updated, spent));
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── POST /api/tasks/:taskId/sync ──────────────────────────────────────────
  static async syncTime(req, res) {
    try {
      const userId = req.user.id;
      const task = await findOwnedTask(req.params.taskId, userId);
      if (!task) return fail(res, 404, 'Task not found');

      const session = await prisma.session.findFirst({
        where: openSessionWhere(task.id),
      });
      if (!session) return fail(res, 400, 'No active session');

      const now = new Date();
      const elapsed = elapsedBetween(session.startedAt, now);

      await prisma.session.update({
        where: { id: session.id },
        data: { committedSeconds: elapsed },
      });

      return res.json({ committedSeconds: elapsed });
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── POST /api/tasks/reorder ───────────────────────────────────────────────
  static async reorderTasks(req, res) {
    try {
      const userId = req.user.id;
      const { ids, status } = req.body;
      const workspaceId = clean(req.body.workspaceId);

      if (!workspaceId) return fail(res, 400, 'Workspace ID is required');
      if (!status || !STATUSES.includes(status))
        return fail(res, 400, 'Valid status is required');
      if (!Array.isArray(ids)) return fail(res, 400, 'ids must be an array');

      await prisma.$transaction(async (tx) => {
        const tasks = await tx.task.findMany({
          where: { userId, workspaceId, status, id: { in: ids } },
        });
        const validIds = new Set(tasks.map((t) => t.id));
        const filtered = ids.filter((id) => validIds.has(id));
        for (let i = 0; i < filtered.length; i++) {
          await tx.task.update({
            where: { id: filtered[i] },
            data: { position: i },
          });
        }
      });

      const tasks = await listTasks({ userId, workspaceId, status });
      return res.json(tasks.map((t) => serializeTask(t)));
    } catch (err) {
      return serverError(res, err);
    }
  }
}

module.exports = TasksController;