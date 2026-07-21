const IORedis = require("ioredis");

let connection = null;

// BullMQ requires a dedicated ioredis connection with maxRetriesPerRequest
// set to null (it manages its own blocking-command retries) — this is the
// one shared connection every Queue/Worker in this app pulls from.
const getRedisConnection = () => {
  if (connection) return connection;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not configured on the server.");
  }

  connection = new IORedis(url, {
    maxRetriesPerRequest: null,
  });

  connection.on("error", (error) => {
    console.error("[redis] connection error:", error.message);
  });

  return connection;
};

module.exports = { getRedisConnection };
