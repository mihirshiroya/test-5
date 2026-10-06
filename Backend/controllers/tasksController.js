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
  Math.max(0, Math.floor((new Date(end) - new Date(start)) / 1000));

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
 * @param {number} [spent] – seconds tracked across all sessions of the task
 */
const serializeTask = (task, spent) => {
  const tracked = spent ?? task.actualDurationSeconds ?? 0;
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    workspaceId: task.workspaceId,
    position: task.position,
    createdAt: ms(task.createdAt),
    updatedAt: ms(task.updatedAt),
    plannedDurationSeconds: task.plannedDurationSeconds ?? 0,
    actualDurationSeconds: tracked,
    spentSeconds: tracked,
    startDate: ms(task.startDate),
    deadlineDate: ms(task.deadlineDate),
    startedAt: ms(task.startedAt),
    completedAt: ms(task.completedAt),
  };
};

const serializeSession = (session) => ({
  id: session.id,
  taskId: session.taskId,
  startedAt: ms(session.startedAt),
  endedAt: ms(session.endedAt),
  committedSeconds: session.durationSeconds ?? 0,
});

const serializeWorkspace = (ws) => ({
  id: ws.id,
  name: ws.name,
  description: ws.description ?? null,
  tint: ws.tint,
  icon: ws.icon,
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

/** Rewrites positions of one column (workspace + status) to 0..n-1. */
const reindexColumn = async (tx, { userId, workspaceId, status }) => {
  const tasks = await tx.task.findMany({
    where: { userId, workspaceId, status },
    orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
    select: { id: true, position: true },
  });
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].position !== i) {
      await tx.task.update({
        where: { id: tasks[i].id },
        data: { position: i },
      });
    }
  }
};

// ---------------------------------------------------------------------------
// Session helpers  (model: TaskSession, field: durationSeconds)
// ---------------------------------------------------------------------------

const openSessionWhere = (taskId) => ({ taskId, endedAt: null });

const openSession = (tx, userId, taskId) =>
  tx.taskSession.create({
    data: { userId, taskId, startedAt: new Date() },
  });

/**
 * Closes a session and adds its full duration to the task's
 * actualDurationSeconds. Returns { session, seconds }.
 */
const closeSession = async (tx, session, forceTime = null) => {
  const ended = forceTime || new Date();
  const seconds = elapsedBetween(session.startedAt, ended);
  const closed = await tx.taskSession.update({
    where: { id: session.id },
    data: { endedAt: ended, durationSeconds: seconds },
  });
  await tx.task.update({
    where: { id: session.taskId },
    data: { actualDurationSeconds: { increment: seconds } },
  });
  return { session: closed, seconds };
};

const closeOpenSession = async (tx, userId, taskId) => {
  const session = await tx.taskSession.findFirst({
    where: openSessionWhere(taskId),
  });
  if (!session) return 0;
  const { seconds } = await closeSession(tx, session);
  if (seconds > 0) {
    await recordActivity(tx, userId, 'SESSION_COMPLETED', {
      taskId,
      seconds,
    });
  }
  return seconds;
};

/**
 * Seconds tracked on sessions: closed durations plus the last synced
 * checkpoint of the open session (durationSeconds is updated by /sync).
 */
const spentSeconds = async (taskId, client = prisma) => {
  const agg = await client.taskSession.aggregate({
    where: { taskId },
    _sum: { durationSeconds: true },
  });
  return agg._sum.durationSeconds || 0;
};

/** Live spent time including the currently running (unsynced) session. */
const liveSpentSeconds = async (taskId, client = prisma) => {
  const [closedAgg, open] = await Promise.all([
    client.taskSession.aggregate({
      where: { taskId, endedAt: { not: null } },
      _sum: { durationSeconds: true },
    }),
    client.taskSession.findFirst({ where: openSessionWhere(taskId) }),
  ]);
  const closed = closedAgg._sum.durationSeconds || 0;
  return open ? closed + elapsedBetween(open.startedAt, new Date()) : closed;
};

const canStart = async (userId, exceptTaskId = null) => {
  const count = await prisma.taskSession.count({
    where: {
      userId,
      endedAt: null,
      ...(exceptTaskId ? { taskId: { not: exceptTaskId } } : {}),
    },
  });
  return count === 0;
};

const canComplete = async (task) => {
  if (!task.plannedDurationSeconds || task.plannedDurationSeconds <= 0) return true;
  const spent = await liveSpentSeconds(task.id);
  // Small grace (2s) for clock drift between client and server.
  return spent + 2 >= task.plannedDurationSeconds * COMPLETION_THRESHOLD;
};

// ---------------------------------------------------------------------------
// Analytics  (models: DailyAnalytics + DailyActivity)
// ---------------------------------------------------------------------------

/** Today as a UTC-midnight Date, which maps cleanly onto a @db.Date column. */
const analyticsDay = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

const counterIncrements = (type, metadata) => {
  switch (type) {
    case 'TASK_CREATED':
      return { createdTaskCount: { increment: 1 } };
    case 'TASK_COMPLETED':
      return { completedTaskCount: { increment: 1 } };
    case 'SESSION_COMPLETED':
      return {
        totalSessions: { increment: 1 },
        totalFocusSeconds: { increment: Math.max(0, toInt(metadata.seconds) || 0) },
      };
    default:
      return {};
  }
};

const recordActivity = async (tx, userId, type, metadata = {}, { taskExists = true } = {}) => {
  const increments = counterIncrements(type, metadata);
  const createCounters = Object.fromEntries(
    Object.entries(increments).map(([k, v]) => [k, v.increment]),
  );

  const analytics = await tx.dailyAnalytics.upsert({
    where: { userId_analyticsDate: { userId, analyticsDate: analyticsDay() } },
    update: increments,
    create: { userId, analyticsDate: analyticsDay(), ...createCounters },
  });

  return tx.dailyActivity.create({
    data: {
      dailyAnalyticsId: analytics.id,
      taskId: taskExists ? metadata.taskId ?? null : null,
      type,
      metadata,
    },
  });
};

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const parseDateField = (raw) => {
  if (raw === null || raw === '') return { value: null };
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { error: true };
  return { value: d };
};

/**
 * Validates + coerces task fields from req.body.
 * `partial = true` skips "required" checks (used for PATCH).
 */
const buildTaskData = (body, partial = false) => {
  const data = {};
  const errors = [];

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

  if (body.description !== undefined) {
    data.description = clean(body.description) || '';
  }

  if (body.workspaceId !== undefined || !partial) {
    const workspaceId = clean(body.workspaceId);
    if (!workspaceId) {
      errors.push('Workspace ID is required');
    } else {
      data.workspaceId = workspaceId;
    }
  }

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

  if (body.plannedDurationSeconds !== undefined) {
    const secs = toInt(body.plannedDurationSeconds);
    if (isNaN(secs) || secs < 0) {
      errors.push('plannedDurationSeconds must be a non-negative integer');
    } else {
      data.plannedDurationSeconds = secs;
    }
  }

  for (const field of ['startDate', 'deadlineDate']) {
    if (body[field] !== undefined) {
      const parsed = parseDateField(body[field]);
      if (parsed.error) errors.push(`${field} is invalid`);
      else data[field] = parsed.value;
    }
  }

  if (
    data.startDate instanceof Date &&
    data.deadlineDate instanceof Date &&
    data.deadlineDate < data.startDate
  ) {
    errors.push('Deadline must be after the start date');
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
      if (req.query.workspaceId) where.workspaceId = String(req.query.workspaceId);
      if (req.query.status && STATUSES.includes(req.query.status)) {
        where.status = req.query.status;
      }

      const [tasks, workspaces, activeSession] = await Promise.all([
        listTasks(where),
        prisma.workspace.findMany({
          where: { userId },
          orderBy: { name: 'asc' },
        }),
        prisma.taskSession.findFirst({
          where: { userId, endedAt: null },
          orderBy: { startedAt: 'desc' },
        }),
      ]);

      const taskIds = tasks.map((t) => t.id);
      const spentAgg = taskIds.length
        ? await prisma.taskSession.groupBy({
            by: ['taskId'],
            where: { taskId: { in: taskIds } },
            _sum: { durationSeconds: true },
          })
        : [];
      const spentMap = Object.fromEntries(
        spentAgg.map((r) => [r.taskId, r._sum.durationSeconds ?? 0]),
      );

      return res.json({
        tasks: tasks.map((t) => serializeTask(t, spentMap[t.id] ?? 0)),
        workspaces: workspaces.map(serializeWorkspace),
        activeSession: activeSession ? serializeSession(activeSession) : null,
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
        prisma.taskSession.findFirst({ where: openSessionWhere(task.id) }),
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

      const body = {
        status: 'TODO',
        priority: 'MEDIUM',
        description: '',
        plannedDurationSeconds: 0,
        ...req.body,
      };

      const { data, errors } = buildTaskData(body);
      if (errors.length > 0) return fail(res, 400, errors.join(', '));

      const workspace = await findOwnedWorkspace(data.workspaceId, userId);
      if (!workspace) return fail(res, 404, 'Workspace not found');

      if (data.status === 'IN_PROGRESS' && !(await canStart(userId))) {
        return fail(res, 400, 'Cannot create an IN_PROGRESS task while another task is active');
      }

      const task = await prisma.$transaction(async (tx) => {
        const position = await nextPosition(tx, {
          userId,
          workspaceId: data.workspaceId,
          status: data.status,
        });

        const now = new Date();
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
            startedAt: data.status === 'IN_PROGRESS' ? now : null,
            completedAt: data.status === 'COMPLETED' ? now : null,
          },
        });

        await recordActivity(tx, userId, 'TASK_CREATED', {
          taskId: t.id,
          title: t.title,
          workspaceId: t.workspaceId,
        });

        if (t.status === 'IN_PROGRESS') {
          await openSession(tx, userId, t.id);
          await recordActivity(tx, userId, 'TASK_STARTED', { taskId: t.id });
        } else if (t.status === 'COMPLETED') {
          await recordActivity(tx, userId, 'TASK_COMPLETED', { taskId: t.id });
        }

        return t;
      });

      return res.status(201).json(serializeTask(task, 0));
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
      delete data.status; // status changes use the dedicated endpoints

      // Cross-check dates against the stored value when only one side changes.
      const nextStart = data.startDate !== undefined ? data.startDate : task.startDate;
      const nextDeadline = data.deadlineDate !== undefined ? data.deadlineDate : task.deadlineDate;
      if (nextStart && nextDeadline && new Date(nextDeadline) < new Date(nextStart)) {
        errors.push('Deadline must be after the start date');
      }
      if (errors.length > 0) return fail(res, 400, [...new Set(errors)].join(', '));

      if (Object.keys(data).length === 0) {
        const spent = await spentSeconds(task.id);
        return res.json(serializeTask(task, spent));
      }

      const movedWorkspace = data.workspaceId && data.workspaceId !== task.workspaceId;
      if (movedWorkspace) {
        const ws = await findOwnedWorkspace(data.workspaceId, userId);
        if (!ws) return fail(res, 404, 'Workspace not found');
      }

      const updated = await prisma.$transaction(async (tx) => {
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

        const activityType =
          data.priority && data.priority !== task.priority
            ? 'PRIORITY_CHANGED'
            : data.deadlineDate !== undefined && ms(data.deadlineDate) !== ms(task.deadlineDate)
              ? 'DEADLINE_CHANGED'
              : 'TASK_UPDATED';

        await recordActivity(tx, userId, activityType, {
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
        await closeOpenSession(tx, userId, task.id);

        await tx.task.delete({ where: { id: task.id } });

        await recordActivity(
          tx,
          userId,
          'TASK_DELETED',
          { taskId: task.id, title: task.title, workspaceId: task.workspaceId },
          { taskExists: false },
        );

        await reindexColumn(tx, {
          userId,
          workspaceId: task.workspaceId,
          status: task.status,
        });
      });

      return res.status(204).send();
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── PATCH /api/tasks/:taskId/move ─────────────────────────────────────────
  // body: { status?, index?, workspaceId? }
  static async moveTask(req, res) {
    try {
      const userId = req.user.id;
      const { status, index, workspaceId } = req.body;

      const task = await findOwnedTask(req.params.taskId, userId);
      if (!task) return fail(res, 404, 'Task not found');
      if (isLocked(task.status)) return fail(res, 400, 'Cannot move a completed task');

      const newStatus = status ? clean(status) : task.status;
      if (!STATUSES.includes(newStatus)) return fail(res, 400, 'Invalid status');

      const newWorkspaceId = workspaceId ? clean(workspaceId) : task.workspaceId;
      if (newWorkspaceId !== task.workspaceId) {
        const ws = await findOwnedWorkspace(newWorkspaceId, userId);
        if (!ws) return fail(res, 404, 'Workspace not found');
      }

      const statusChanged = newStatus !== task.status;
      const movedCol = statusChanged || newWorkspaceId !== task.workspaceId;
      const parsedIndex = index !== undefined && index !== null ? toInt(index) : NaN;
      const targetIndex = Number.isNaN(parsedIndex) ? null : Math.max(0, parsedIndex);

      if (!movedCol && (targetIndex === null || targetIndex === task.position)) {
        const spent = await spentSeconds(task.id);
        return res.json(serializeTask(task, spent));
      }

      if (newStatus === 'IN_PROGRESS' && statusChanged && !(await canStart(userId, task.id))) {
        return fail(res, 400, 'Cannot start task while another is active');
      }

      if (newStatus === 'COMPLETED' && !(await canComplete(task))) {
        return fail(
          res,
          400,
          `Complete becomes available after ${COMPLETION_THRESHOLD * 100}% of the planned time is used`,
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        // Target column without the moved task, in display order.
        const siblings = await tx.task.findMany({
          where: {
            userId,
            workspaceId: newWorkspaceId,
            status: newStatus,
            id: { not: task.id },
          },
          orderBy: { position: 'asc' },
          select: { id: true },
        });

        const insertAt =
          targetIndex === null ? siblings.length : Math.min(targetIndex, siblings.length);
        const ordered = [...siblings.slice(0, insertAt), { id: task.id }, ...siblings.slice(insertAt)];

        // Session bookkeeping before the status flip.
        if (statusChanged && task.status === 'IN_PROGRESS') {
          await closeOpenSession(tx, userId, task.id);
        }

        const now = new Date();
        const u = await tx.task.update({
          where: { id: task.id },
          data: {
            status: newStatus,
            workspaceId: newWorkspaceId,
            position: insertAt,
            ...(newStatus === 'IN_PROGRESS' && statusChanged && !task.startedAt
              ? { startedAt: now }
              : {}),
            ...(newStatus === 'COMPLETED' && statusChanged ? { completedAt: now } : {}),
          },
        });

        for (let i = 0; i < ordered.length; i++) {
          if (ordered[i].id === task.id) continue;
          await tx.task.update({ where: { id: ordered[i].id }, data: { position: i } });
        }

        if (movedCol) {
          await reindexColumn(tx, {
            userId,
            workspaceId: task.workspaceId,
            status: task.status,
          });
        }

        if (statusChanged) {
          if (newStatus === 'IN_PROGRESS') {
            await openSession(tx, userId, u.id);
            await recordActivity(tx, userId, 'TASK_STARTED', { taskId: u.id });
          } else {
            await recordActivity(
              tx,
              userId,
              newStatus === 'COMPLETED' ? 'TASK_COMPLETED' : 'STATUS_CHANGED',
              { taskId: u.id, from: task.status, to: newStatus },
            );
          }
        }

        return u;
      });

      const fresh = await prisma.task.findUnique({ where: { id: updated.id } });
      const spent = await spentSeconds(updated.id);
      return res.json(serializeTask(fresh ?? updated, spent));
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
      if (isLocked(task.status)) return fail(res, 400, 'Task is locked');

      if (task.startDate && new Date(task.startDate) > new Date()) {
        return fail(res, 400, 'Task cannot be started before its start date');
      }

      if (!(await canStart(userId, task.id))) {
        return fail(res, 400, 'Another task is already active');
      }

      const updated = await prisma.$transaction(async (tx) => {
        const hasOpen = await tx.taskSession.findFirst({
          where: openSessionWhere(task.id),
        });

        if (task.status === 'IN_PROGRESS') {
          // Repair: IN_PROGRESS task without a running session.
          if (!hasOpen) await openSession(tx, userId, task.id);
          return task;
        }

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

        await reindexColumn(tx, {
          userId,
          workspaceId: task.workspaceId,
          status: task.status,
        });

        if (!hasOpen) await openSession(tx, userId, task.id);
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
        await closeOpenSession(tx, userId, task.id);

        const pos = await nextPosition(tx, {
          userId,
          workspaceId: task.workspaceId,
          status: 'ON_HOLD',
        });

        const u = await tx.task.update({
          where: { id: task.id },
          data: { status: 'ON_HOLD', position: pos },
        });

        await reindexColumn(tx, {
          userId,
          workspaceId: task.workspaceId,
          status: task.status,
        });

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

      if (!(await canComplete(task))) {
        return fail(
          res,
          400,
          `Complete becomes available after ${COMPLETION_THRESHOLD * 100}% of the planned time is used`,
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        await closeOpenSession(tx, userId, task.id);

        const pos = await nextPosition(tx, {
          userId,
          workspaceId: task.workspaceId,
          status: 'COMPLETED',
        });

        const u = await tx.task.update({
          where: { id: task.id },
          data: { status: 'COMPLETED', position: pos, completedAt: new Date() },
        });

        await reindexColumn(tx, {
          userId,
          workspaceId: task.workspaceId,
          status: task.status,
        });

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
  // Checkpoints the running session so tracked time survives a crash.
  static async syncTime(req, res) {
    try {
      const userId = req.user.id;
      const task = await findOwnedTask(req.params.taskId, userId);
      if (!task) return fail(res, 404, 'Task not found');

      const session = await prisma.taskSession.findFirst({
        where: openSessionWhere(task.id),
      });
      if (!session) return fail(res, 400, 'No active session');

      const elapsed = elapsedBetween(session.startedAt, new Date());

      await prisma.taskSession.update({
        where: { id: session.id },
        data: { durationSeconds: elapsed },
      });

      return res.json({ committedSeconds: elapsed });
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── PATCH /api/tasks/reorder ──────────────────────────────────────────────
  // body: { workspaceId, status, ids: string[] }
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
          where: { userId, workspaceId, status },
          orderBy: { position: 'asc' },
          select: { id: true },
        });
        const validIds = new Set(tasks.map((t) => t.id));
        const requested = [...new Set(ids)].filter((id) => validIds.has(id));
        const rest = tasks.map((t) => t.id).filter((id) => !requested.includes(id));
        const ordered = [...requested, ...rest];
        for (let i = 0; i < ordered.length; i++) {
          await tx.task.update({ where: { id: ordered[i] }, data: { position: i } });
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
