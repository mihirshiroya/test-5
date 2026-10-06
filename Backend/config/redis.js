const Redis = require('ioredis');

/**
 * Shared Redis client used for response caching.
 *
 * Caching is strictly optional: when REDIS_URL is not set, or Redis is
 * unreachable, `isRedisReady()` returns false and every cache helper becomes a
 * no-op so the API keeps serving straight from the database.
 */
const REDIS_URL = process.env.REDIS_URL;

let client = null;
let ready = false;

if (REDIS_URL) {
  client = new Redis(REDIS_URL, {
    lazyConnect: false,
    enableOfflineQueue: false, // fail fast instead of queueing while disconnected
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    retryStrategy: (times) => Math.min(times * 500, 10000),
  });

  client.on('ready', () => {
    ready = true;
    console.log('[redis] connected, response caching enabled');
  });

  client.on('end', () => {
    ready = false;
  });

  client.on('error', (error) => {
    if (ready) {
      console.error('[redis] connection lost, caching disabled until reconnect:', error.message);
    }
    ready = false;
  });
} else {
  console.log('[redis] REDIS_URL not set, response caching disabled');
}

const isRedisReady = () => Boolean(client) && ready;

const disconnectRedis = async () => {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
};

module.exports = {
  redis: client,
  isRedisReady,
  disconnectRedis,
};
