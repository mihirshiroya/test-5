const { redis, isRedisReady } = require('../config/redis');

const PREFIX = 'cache';
const VERSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Invalidation strategy: every cached response key embeds a "version" for its
 * namespace + scope (e.g. tasks for user 42). Writes bump that version with a
 * single atomic INCR, which orphans every older key at once — no SCAN/KEYS
 * needed. Orphaned keys simply expire through their own TTL.
 */
const versionKey = (namespace, scope) => `${PREFIX}:ver:${namespace}:${scope}`;
const userKey = (userId) => `${PREFIX}:user:${userId}`;

const safe = async (operation, fallback = null) => {
  if (!isRedisReady()) return fallback;
  try {
    return await operation();
  } catch (error) {
    console.error('[cache] redis operation failed:', error.message);
    return fallback;
  }
};

const getJSON = (key) =>
  safe(async () => {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  });

const setJSON = (key, value, ttlSeconds) =>
  safe(() => redis.set(key, JSON.stringify(value), 'EX', ttlSeconds));

const del = (...keys) => safe(() => (keys.length ? redis.del(...keys) : 0), 0);

const getVersions = (pairs) =>
  safe(async () => {
    const values = await redis.mget(pairs.map(([ns, scope]) => versionKey(ns, scope)));
    return values.map((v) => v || '0');
  }, null);

const bumpVersions = (pairs) =>
  safe(async () => {
    const pipeline = redis.pipeline();
    for (const [ns, scope] of pairs) {
      const key = versionKey(ns, scope);
      pipeline.incr(key);
      pipeline.expire(key, VERSION_TTL_SECONDS);
    }
    await pipeline.exec();
  });

/* ------------------------- authenticated user cache ------------------------ */

const USER_TTL_SECONDS = 5 * 60;

const getCachedUser = (userId) => getJSON(userKey(userId));

const setCachedUser = (user) =>
  user?.id ? setJSON(userKey(user.id), user, USER_TTL_SECONDS) : null;

const invalidateUser = (userId) => (userId ? del(userKey(userId)) : null);

module.exports = {
  PREFIX,
  getJSON,
  setJSON,
  del,
  getVersions,
  bumpVersions,
  getCachedUser,
  setCachedUser,
  invalidateUser,
};
