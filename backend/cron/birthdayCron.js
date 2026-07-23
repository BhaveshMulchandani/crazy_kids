const cron = require("node-cron");
const { runBirthdayCampaign } = require("../services/birthdayService");

const CRON_SCHEDULE = "0 9 * * *"; // every day at 9:00 AM
const CRON_TIMEZONE = "Asia/Kolkata";

let task = null;

// Starts the daily 9:00 AM IST birthday-wish cron. Idempotent — calling it
// more than once reuses the already-scheduled task instead of
// double-scheduling a second one.
const startBirthdayCron = () => {
  if (task) return task;

  task = cron.schedule(
    CRON_SCHEDULE,
    () => {
      runBirthdayCampaign().catch((error) => {
        console.error("[birthday-cron] campaign run failed:", error.message);
      });
    },
    { timezone: CRON_TIMEZONE }
  );

  console.log(`[birthday-cron] scheduled for "${CRON_SCHEDULE}" (${CRON_TIMEZONE})`);
  return task;
};

module.exports = { startBirthdayCron };
