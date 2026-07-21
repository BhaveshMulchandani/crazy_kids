const { Worker } = require("bullmq");
const { getRedisConnection } = require("../config/redis");
const { QUEUE_NAME } = require("../queues/whatsappOffer.queue");
const whatsappService = require("../services/whatsapp.service");

// Controlled concurrency — safe default for sending to thousands of
// customers without hammering TrdAI or Redis. Override via env if needed.
const CONCURRENCY = Number(process.env.WHATSAPP_OFFER_WORKER_CONCURRENCY) || 5;

let worker = null;

const startWhatsappOfferWorker = () => {
  if (worker) return worker;

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { mobileNumber, parentName, offerName, offerHighlight } = job.data;
      console.log("[whatsapp-offer-worker] sending", {
        jobId: job.id,
        mobileNumber,
        offerName,
        attempt: job.attemptsMade + 1,
      });

      await whatsappService.sendOffer({
        destination: mobileNumber,
        userName: parentName,
        offerName,
        offerHighlight,
      });
    },
    {
      connection: getRedisConnection(),
      concurrency: CONCURRENCY,
    }
  );

  worker.on("completed", (job) => {
    console.log("[whatsapp-offer-worker] success", {
      jobId: job.id,
      mobileNumber: job.data?.mobileNumber,
      offerName: job.data?.offerName,
    });
  });

  // Fires after every failed attempt, including ones BullMQ will still
  // retry — `willRetry` tells the two cases apart in the logs.
  worker.on("failed", (job, error) => {
    const attemptsMade = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 1;
    const willRetry = attemptsMade < maxAttempts;
    console.error("[whatsapp-offer-worker] failure", {
      jobId: job?.id,
      mobileNumber: job?.data?.mobileNumber,
      offerName: job?.data?.offerName,
      retryAttempt: attemptsMade,
      maxAttempts,
      willRetry,
      errorReason: error?.message,
    });
  });

  worker.on("error", (error) => {
    console.error("[whatsapp-offer-worker] worker error:", error.message);
  });

  console.log(`[whatsapp-offer-worker] started (concurrency=${CONCURRENCY})`);
  return worker;
};

module.exports = { startWhatsappOfferWorker };
