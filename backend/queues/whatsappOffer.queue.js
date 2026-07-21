const { Queue } = require("bullmq");
const { getRedisConnection } = require("../config/redis");

// One BullMQ job per customer. Jobs persist in Redis, so a campaign
// survives a server restart and jobs already queued keep processing once
// the app comes back up.
const QUEUE_NAME = "whatsapp-offer-campaign";

let queue = null;

const getWhatsappOfferQueue = () => {
  if (queue) return queue;

  queue = new Queue(QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      // Automatic retry on transient TrdAI/network failures — one failed
      // customer never blocks or cancels the rest of the campaign, since
      // every other customer is its own independent job.
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 7 * 24 * 3600, count: 2000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  });

  return queue;
};

module.exports = { QUEUE_NAME, getWhatsappOfferQueue };
