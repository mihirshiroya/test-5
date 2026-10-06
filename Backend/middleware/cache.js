const crypto = require('crypto');
const cache = require('../utils/cache');

/**
 * A namespace is either per-user (default: the requester's own data) or
 * "global" (data shared by every viewer, e.g. admin user lists). Responses are
 * ALWAYS keyed by the requester id as well, so one user's response can never
 * be served to another user, even for global namespaces.
 */
const GLOBAL_SCOPE = 'global';

const toPairs = (namespaces, req) =>
  namespaces.map((ns) => {
    const { name, global } = typeof ns === 'string' ? { name: ns, global: false } : ns;
    return [name, global ? GLOBAL_SCOPE : req.user?.id];
  });

/**
 * Cache successful GET responses.
 *
 * @param {string|{name:string,global?:boolean}} namespace
 * @param {number} ttlSeconds
 */
const cacheResponse = (namespace, ttlSeconds = 60) => async (req, res, next) => {
  if (req.method !== 'GET' || !req.user?.id) return next();

  const pairs = toPairs([namespace], req);
  const versions = await cache.getVersions(pairs);
  if (!versions) return next(); // redis unavailable

  const urlHash = crypto.createHash('sha1').update(req.originalUrl).digest('hex');
  const [[name, scope]] = pairs;
  const key = `${cache.PREFIX}:res:${name}:${scope}:v${versions[0]}:${req.user.id}:${urlHash}`;

  const hit = await cache.getJSON(key);
  if (hit) {
    res.set('X-Cache', 'HIT');
    return res.status(hit.status).json(hit.body);
  }

  res.set('X-Cache', 'MISS');
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200 && body && body.success !== false) {
      void cache.setJSON(key, { status: res.statusCode, body }, ttlSeconds);
    }
    return originalJson(body);
  };

  return next();
};

/**
 * Invalidate namespaces after a successful write.
 *
 * The version bump happens BEFORE the response is sent, so a client that
 * refetches immediately after a mutation can never read the stale entry.
 */
const invalidateOn = (...namespaces) => (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  let bumped = false;
  const bump = () => {
    if (bumped || res.statusCode >= 400 || !req.user?.id) return Promise.resolve();
    bumped = true;
    return cache.bumpVersions(toPairs(namespaces, req));
  };

  // res.json() delegates to res.send(), so patching send covers JSON bodies
  // and bodiless responses such as 204 No Content.
  const originalSend = res.send.bind(res);
  res.send = (body) => {
    bump().finally(() => originalSend(body));
    return res;
  };

  return next();
};

module.exports = {
  cacheResponse,
  invalidateOn,
};
