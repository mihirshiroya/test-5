const prisma = require('../config/database');

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_GOAL_SECONDS = 4 * 60 * 60;
const DAY_BUCKET_HOURS = 3;
const RECENT_ACTIVITY_LIMIT = 8;
const MAX_TZ_OFFSET_MINUTES = 14 * 60;

// ---------------------------------------------------------------------------
// Time helpers
//
// The client sends `tz` = Date#getTimezoneOffset() (minutes, UTC - local).
// Every "day" below is a calendar day in the user's local time zone, encoded
// as a "YYYY-MM-DD" key.
// ---------------------------------------------------------------------------

const parseTz = (raw) => {
  const tz = parseInt(raw, 10);
  if (Number.isNaN(tz) || Math.abs(tz) > MAX_TZ_OFFSET_MINUTES) return 0;
  return tz;
};

const isDayKey = (val) =>
  typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) && !Number.isNaN(Date.parse(`${val}T00:00:00Z`));

/** Local "YYYY-MM-DD" for an instant. */
const dayKey = (date, tz) =>
  new Date(new Date(date).getTime() - tz * 60000).toISOString().slice(0, 10);

/** UTC instant at which the local day `key` starts. */
const dayStart = (key, tz) => new Date(Date.parse(`${key}T00:00:00Z`) + tz * 60000);

const shiftDay = (key, days) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** Local hour (0-23) of an instant. */
const localHour = (date, tz) => new Date(new Date(date).getTime() - tz * 60000).getUTCHours();

/** Monday of the local week containing `key`. */
const weekStartKey = (key) => {
  const weekday = new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = Sun
  return shiftDay(key, -((weekday + 6) % 7));
};

const daysBetween = (fromKey, toKey) =>
  Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / DAY_MS);

const pctDelta = (current, previous) =>
  previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100);

const toMinutes = (seconds) => Math.round(seconds / 60);

const relativeTime = (date, now = new Date()) => {
  const seconds = Math.max(0, Math.floor((now - new Date(date)) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatShortDuration = (seconds) => {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
};

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

/** Effective [start, end] of a session; open sessions run until `now`. */
const sessionBounds = (session, now) => {
  const start = new Date(session.startedAt);
  const end = session.endedAt ? new Date(session.endedAt) : now;
  return { start, end: end < start ? start : end };
};

const sessionSeconds = (session, now) => {
  const { start, end } = sessionBounds(session, now);
  return Math.floor((end - start) / 1000);
};

/**
 * Splits a session's time across local days and calls
 * `onSlice(dayKey, sliceStart, sliceEnd)` for each piece.
 */
const forEachDaySlice = (session, tz, now, onSlice) => {
  const { start, end } = sessionBounds(session, now);
  let cursor = start;
  while (cursor < end) {
    const key = dayKey(cursor, tz);
    const nextDay = dayStart(shiftDay(key, 1), tz);
    const sliceEnd = nextDay < end ? nextDay : end;
    onSlice(key, cursor, sliceEnd);
    cursor = sliceEnd;
  }
};

/** Map<dayKey, seconds> of focus time for the given sessions. */
const focusByDay = (sessions, tz, now) => {
  const map = new Map();
  for (const s of sessions) {
    forEachDaySlice(s, tz, now, (key, a, b) => {
      map.set(key, (map.get(key) || 0) + (b - a) / 1000);
    });
  }
  return map;
};

/** Focus seconds per 3-hour bucket of the local day `key`. */
const focusByBucket = (sessions, key, tz, now) => {
  const buckets = new Array(24 / DAY_BUCKET_HOURS).fill(0);
  const from = dayStart(key, tz);
  const to = dayStart(shiftDay(key, 1), tz);

  for (const s of sessions) {
    const { start, end } = sessionBounds(s, now);
    let cursor = start < from ? from : start;
    const stop = end > to ? to : end;

    while (cursor < stop) {
      const bucket = Math.floor(localHour(cursor, tz) / DAY_BUCKET_HOURS);
      const bucketEnd = new Date(from.getTime() + (bucket + 1) * DAY_BUCKET_HOURS * 3600000);
      const sliceEnd = bucketEnd < stop ? bucketEnd : stop;
      buckets[bucket] += (sliceEnd - cursor) / 1000;
      cursor = sliceEnd;
    }
  }
  return buckets;
};

const bucketLabel = (index) => {
  const hour = index * DAY_BUCKET_HOURS;
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
};

const sumRange = (map, fromKey, toKey) => {
  let total = 0;
  for (let k = fromKey; k <= toKey; k = shiftDay(k, 1)) total += map.get(k) || 0;
  return total;
};

const countByDay = (dates, tz) => {
  const map = new Map();
  for (const d of dates) {
    if (!d) continue;
    const key = dayKey(d, tz);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
};

const heatLevel = (minutes, completed) => {
  if (minutes <= 0) return completed > 0 ? 1 : 0;
  if (minutes < 30) return 1;
  if (minutes < 90) return 2;
  if (minutes < 180) return 3;
  return 4;
};

const buildHeatmap = (fromKey, toKey, focusMap, completedMap) => {
  const cells = [];
  for (let k = fromKey; k <= toKey; k = shiftDay(k, 1)) {
    const minutes = toMinutes(focusMap.get(k) || 0);
    const completed = completedMap.get(k) || 0;
    cells.push({ date: k, minutes, completed, value: heatLevel(minutes, completed) });
  }
  return cells;
};

/** Sessions of the user that overlap [from, to). */
const sessionsOverlapping = (userId, from, to, include) =>
  prisma.taskSession.findMany({
    where: {
      userId,
      startedAt: { lt: to },
      OR: [{ endedAt: null }, { endedAt: { gt: from } }],
    },
    orderBy: { startedAt: 'asc' },
    ...(include ? { include } : {}),
  });

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

const ACTIVITY_KIND = {
  TASK_CREATED: 'created',
  TASK_COMPLETED: 'completed',
  TASK_STARTED: 'focus',
  SESSION_COMPLETED: 'focus',
  SESSION_STARTED: 'focus',
  TASK_UPDATED: 'comment',
  STATUS_CHANGED: 'comment',
  PRIORITY_CHANGED: 'comment',
  DEADLINE_CHANGED: 'comment',
  TASK_DELETED: 'milestone',
};

const STATUS_LABEL = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
};

const activityText = (type, title, metadata) => {
  const name = `"${title}"`;
  switch (type) {
    case 'TASK_CREATED':
      return `Created ${name}`;
    case 'TASK_COMPLETED':
      return `Completed ${name}`;
    case 'TASK_STARTED':
      return `Started working on ${name}`;
    case 'SESSION_COMPLETED':
      return `Logged a ${formatShortDuration(Number(metadata.seconds) || 0)} focus session on ${name}`;
    case 'SESSION_STARTED':
      return `Started a focus session on ${name}`;
    case 'STATUS_CHANGED':
      return `Moved ${name} to ${STATUS_LABEL[metadata.to] || metadata.to || 'a new status'}`;
    case 'PRIORITY_CHANGED':
      return `Changed priority of ${name}`;
    case 'DEADLINE_CHANGED':
      return `Updated the deadline of ${name}`;
    case 'TASK_DELETED':
      return `Deleted ${name}`;
    default:
      return `Updated ${name}`;
  }
};

const recentActivity = async (userId, now) => {
  const rows = await prisma.dailyActivity.findMany({
    where: { dailyAnalytics: { userId } },
    orderBy: { createdAt: 'desc' },
    take: RECENT_ACTIVITY_LIMIT,
    include: {
      task: { select: { title: true, workspace: { select: { name: true } } } },
    },
  });

  const orphanWorkspaceIds = [
    ...new Set(
      rows
        .filter((r) => !r.task && r.metadata && r.metadata.workspaceId)
        .map((r) => r.metadata.workspaceId),
    ),
  ];
  const workspaces = orphanWorkspaceIds.length
    ? await prisma.workspace.findMany({
        where: { userId, id: { in: orphanWorkspaceIds } },
        select: { id: true, name: true },
      })
    : [];
  const workspaceName = Object.fromEntries(workspaces.map((w) => [w.id, w.name]));

  return rows.map((r) => {
    const metadata = r.metadata || {};
    const title = r.task?.title || metadata.title || 'a task';
    return {
      id: r.id,
      kind: ACTIVITY_KIND[r.type] || 'comment',
      type: r.type,
      text: activityText(r.type, title, metadata),
      meta: r.task?.workspace?.name || workspaceName[metadata.workspaceId] || 'Workspace',
      ago: relativeTime(r.createdAt, now),
      at: r.createdAt.getTime(),
    };
  });
};

// ---------------------------------------------------------------------------
// Completion rate: completed / tasks that were relevant in the period
// (created, completed or due inside it).
// ---------------------------------------------------------------------------

const completionRate = (tasks, from, to) => {
  let relevant = 0;
  let completed = 0;
  const inRange = (d) => d && d >= from && d < to;

  for (const t of tasks) {
    const done = inRange(t.completedAt);
    if (done || inRange(t.createdAt) || inRange(t.deadlineDate)) {
      relevant++;
      if (done) completed++;
    }
  }
  return relevant === 0 ? 0 : Math.round((completed / relevant) * 100);
};

const serverError = (res, err) => {
  console.error('Analytics error:', err);
  return res.status(500).json({ success: false, message: 'Failed to load analytics' });
};

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

class AnalyticsController {
  // ── GET /api/analytics/overview?tz= ───────────────────────────────────────
  static async getOverview(req, res) {
    try {
      const userId = req.user.id;
      const tz = parseTz(req.query.tz);
      const now = new Date();

      const today = dayKey(now, tz);
      const yesterday = shiftDay(today, -1);
      const thisWeek = weekStartKey(today);
      const lastWeek = shiftDay(thisWeek, -7);
      const lastWeekEnd = shiftDay(thisWeek, -1);
      const yearStart = `${today.slice(0, 4)}-01-01`;
      const rangeStartKey = yearStart < lastWeek ? yearStart : lastWeek;

      const rangeFrom = dayStart(rangeStartKey, tz);
      const rangeTo = dayStart(shiftDay(today, 1), tz);

      const [sessions, tasks, activity] = await Promise.all([
        sessionsOverlapping(userId, rangeFrom, rangeTo),
        prisma.task.findMany({
          where: {
            userId,
            OR: [
              { createdAt: { gte: rangeFrom } },
              { completedAt: { gte: rangeFrom } },
              { deadlineDate: { gte: rangeFrom, lt: rangeTo } },
            ],
          },
          select: { createdAt: true, completedAt: true, deadlineDate: true },
        }),
        recentActivity(userId, now),
      ]);

      const focusMap = focusByDay(sessions, tz, now);
      const completedMap = countByDay(
        tasks.map((t) => t.completedAt),
        tz,
      );
      const sessionCountMap = countByDay(
        sessions.map((s) => s.startedAt),
        tz,
      );

      const range = (fromKey, toKey) => [dayStart(fromKey, tz), dayStart(shiftDay(toKey, 1), tz)];
      const [todayFrom, todayTo] = range(today, today);
      const [yFrom, yTo] = range(yesterday, yesterday);
      const [wFrom, wTo] = range(thisWeek, today);
      const [pwFrom, pwTo] = range(lastWeek, lastWeekEnd);

      const metrics = [
        {
          key: 'focus',
          label: 'Focus time',
          unit: 'minutes',
          today: toMinutes(sumRange(focusMap, today, today)),
          yesterday: toMinutes(sumRange(focusMap, yesterday, yesterday)),
          weekTotal: toMinutes(sumRange(focusMap, thisWeek, today)),
          prevWeekTotal: toMinutes(sumRange(focusMap, lastWeek, lastWeekEnd)),
        },
        {
          key: 'tasks',
          label: 'Tasks completed',
          unit: 'count',
          today: sumRange(completedMap, today, today),
          yesterday: sumRange(completedMap, yesterday, yesterday),
          weekTotal: sumRange(completedMap, thisWeek, today),
          prevWeekTotal: sumRange(completedMap, lastWeek, lastWeekEnd),
        },
        {
          key: 'rate',
          label: 'Completion rate',
          unit: 'percent',
          today: completionRate(tasks, todayFrom, todayTo),
          yesterday: completionRate(tasks, yFrom, yTo),
          weekTotal: completionRate(tasks, wFrom, wTo),
          prevWeekTotal: completionRate(tasks, pwFrom, pwTo),
        },
        {
          key: 'sessions',
          label: 'Focus sessions',
          unit: 'count',
          today: sumRange(sessionCountMap, today, today),
          yesterday: sumRange(sessionCountMap, yesterday, yesterday),
          weekTotal: sumRange(sessionCountMap, thisWeek, today),
          prevWeekTotal: sumRange(sessionCountMap, lastWeek, lastWeekEnd),
        },
      ];

      const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const weekSeries = WEEKDAYS.map((label, i) => ({
        label,
        current: toMinutes(focusMap.get(shiftDay(thisWeek, i)) || 0),
        previous: toMinutes(focusMap.get(shiftDay(lastWeek, i)) || 0),
      }));

      const todayBuckets = focusByBucket(sessions, today, tz, now);
      const yesterdayBuckets = focusByBucket(sessions, yesterday, tz, now);
      const daySeries = todayBuckets.map((secs, i) => ({
        label: bucketLabel(i),
        current: toMinutes(secs),
        previous: toMinutes(yesterdayBuckets[i]),
      }));

      return res.json({
        success: true,
        data: {
          generatedAt: now.getTime(),
          metrics,
          weekSeries,
          daySeries,
          activity,
          heatmap: buildHeatmap(yearStart, today, focusMap, completedMap),
        },
      });
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── GET /api/analytics/sessions?date=YYYY-MM-DD&tz= ───────────────────────
  static async getSessions(req, res) {
    try {
      const userId = req.user.id;
      const tz = parseTz(req.query.tz);
      const now = new Date();
      const today = dayKey(now, tz);

      const date = req.query.date ? String(req.query.date) : today;
      if (!isDayKey(date)) {
        return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });
      }

      const from = dayStart(date, tz);
      const to = dayStart(shiftDay(date, 1), tz);

      const rows = await sessionsOverlapping(userId, from, to, {
        task: {
          select: { id: true, title: true, workspace: { select: { id: true, name: true } } },
        },
      });

      const sessions = rows
        .map((s) => {
          const { start, end } = sessionBounds(s, now);
          const clippedStart = start < from ? from : start;
          const clippedEnd = end > to ? to : end;
          return {
            id: s.id,
            taskId: s.taskId,
            taskName: s.task?.title || 'Untitled task',
            workspaceName: s.task?.workspace?.name || null,
            start: clippedStart.toISOString(),
            end: clippedEnd.toISOString(),
            durationSeconds: Math.max(0, Math.floor((clippedEnd - clippedStart) / 1000)),
            running: !s.endedAt,
          };
        })
        .filter((s) => s.durationSeconds > 0 || s.running);

      return res.json({
        success: true,
        data: { date, goalSeconds: DAILY_GOAL_SECONDS, sessions },
      });
    } catch (err) {
      return serverError(res, err);
    }
  }

  // ── GET /api/analytics/profile?tz=&month=YYYY-MM ──────────────────────────
  static async getProfile(req, res) {
    try {
      const userId = req.user.id;
      const tz = parseTz(req.query.tz);
      const now = new Date();
      const today = dayKey(now, tz);
      const yearStart = `${today.slice(0, 4)}-01-01`;

      let month = req.query.month ? String(req.query.month) : today.slice(0, 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) month = today.slice(0, 7);
      if (month > today.slice(0, 7)) month = today.slice(0, 7);

      const monthStartKey = `${month}-01`;
      const [y, m] = month.split('-').map(Number);
      const monthEndKey = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      const monthLastKey = monthEndKey < today ? monthEndKey : today;

      const last30Start = shiftDay(today, -29);
      const prev30Start = shiftDay(today, -59);

      const earliestKey = [yearStart, monthStartKey, prev30Start].sort()[0];
      const rangeFrom = dayStart(earliestKey, tz);
      const rangeTo = dayStart(shiftDay(today, 1), tz);

      const [
        sessions,
        completedTasks,
        longestClosed,
        openSessions,
        workspaces,
        taskGroups,
      ] = await Promise.all([
        sessionsOverlapping(userId, rangeFrom, rangeTo),
        prisma.task.findMany({
          where: { userId, completedAt: { not: null } },
          select: { completedAt: true },
        }),
        prisma.taskSession.aggregate({
          where: { userId, endedAt: { not: null } },
          _max: { durationSeconds: true },
        }),
        prisma.taskSession.findMany({ where: { userId, endedAt: null } }),
        prisma.workspace.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, name: true, tint: true, icon: true },
        }),
        prisma.task.groupBy({
          by: ['workspaceId', 'status'],
          where: { userId },
          _count: { _all: true },
        }),
      ]);

      const focusMap = focusByDay(sessions, tz, now);
      const completedMap = countByDay(
        completedTasks.map((t) => t.completedAt),
        tz,
      );

      // ── Headline stats ──
      let bestDay = null;
      for (const [date, count] of completedMap) {
        if (!bestDay || count > bestDay.count) bestDay = { date, count };
      }

      const longestOpen = openSessions.reduce((max, s) => Math.max(max, sessionSeconds(s, now)), 0);
      const longestSessionSeconds = Math.max(longestClosed._max.durationSeconds || 0, longestOpen);

      const activeDays = [...completedMap.keys()].sort();
      let longestStreak = 0;
      let run = 0;
      let prev = null;
      for (const key of activeDays) {
        run = prev && daysBetween(prev, key) === 1 ? run + 1 : 1;
        longestStreak = Math.max(longestStreak, run);
        prev = key;
      }

      let currentStreak = 0;
      let cursor = completedMap.has(today) ? today : shiftDay(today, -1);
      while (completedMap.has(cursor)) {
        currentStreak++;
        cursor = shiftDay(cursor, -1);
      }

      // ── Monthly productivity ──
      const monthDays = [];
      for (let k = monthStartKey; k <= monthLastKey; k = shiftDay(k, 1)) {
        monthDays.push({
          date: k,
          completed: completedMap.get(k) || 0,
          focusMinutes: toMinutes(focusMap.get(k) || 0),
        });
      }
      const monthCompleted = monthDays.reduce((s, d) => s + d.completed, 0);
      const avgTasksPerDay = monthDays.length
        ? Math.round((monthCompleted / monthDays.length) * 10) / 10
        : 0;

      // ── Focus, last 30 days ──
      const focusDays = [];
      for (let k = last30Start; k <= today; k = shiftDay(k, 1)) {
        focusDays.push({ date: k, minutes: toMinutes(focusMap.get(k) || 0) });
      }
      const focusTotal = focusDays.reduce((s, d) => s + d.minutes, 0);
      const focusPrevTotal = toMinutes(sumRange(focusMap, prev30Start, shiftDay(last30Start, -1)));

      // ── Projects ──
      const counts = {};
      for (const g of taskGroups) {
        counts[g.workspaceId] ??= { total: 0, done: 0 };
        counts[g.workspaceId].total += g._count._all;
        if (g.status === 'COMPLETED') counts[g.workspaceId].done += g._count._all;
      }
      const projects = workspaces.map((w) => {
        const { total = 0, done = 0 } = counts[w.id] || {};
        const status = total === 0 ? 'Planning' : done === total ? 'Done' : 'In progress';
        return { id: w.id, name: w.name, tint: w.tint, icon: w.icon, total, done, status };
      });

      return res.json({
        success: true,
        data: {
          generatedAt: now.getTime(),
          stats: {
            totalCompleted: completedTasks.length,
            bestDay,
            longestSessionSeconds,
            currentStreak,
            longestStreak,
          },
          heatmap: buildHeatmap(yearStart, today, focusMap, completedMap),
          monthly: {
            month,
            days: monthDays,
            totalCompleted: monthCompleted,
            avgTasksPerDay,
          },
          focus30: {
            days: focusDays,
            totalMinutes: focusTotal,
            prevTotalMinutes: focusPrevTotal,
            delta: pctDelta(focusTotal, focusPrevTotal),
          },
          projects,
        },
      });
    } catch (err) {
      return serverError(res, err);
    }
  }
}

module.exports = AnalyticsController;
