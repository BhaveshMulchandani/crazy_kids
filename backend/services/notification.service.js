const sessionmodel = require("../models/session.model");
const Notification = require("../models/notification.model");
const { getDisplayName } = require("../utils/customerDisplay");

const buildOverdueMessage = (session) =>
  `${getDisplayName(session)}'s session has ended and is waiting for checkout.`;

// Sessions whose scheduled end time has passed but are still
// running/paused (i.e. not yet checked out) get a one-time "waiting for
// checkout" notification. This never touches session.status, invoices, or
// payment — it only raises a notification and flips `overdueNotified` so
// the same session isn't notified twice.
const scanOverdueSessions = async () => {
  const now = new Date();
  const overdue = await sessionmodel
    .find({
      status: { $in: ["running", "paused"] },
      scheduledEndTime: { $lte: now },
      overdueNotified: { $ne: true },
    })
    .select("_id parentName children scheduledEndTime")
    .lean();

  if (!overdue.length) return;

  await Notification.insertMany(
    overdue.map((session) => ({
      type: "session_overdue",
      session: session._id,
      message: buildOverdueMessage(session),
    }))
  );

  await sessionmodel.updateMany(
    { _id: { $in: overdue.map((s) => s._id) } },
    { $set: { overdueNotified: true } }
  );
};

const startOverdueSessionWatcher = (intervalMs = 30000) => {
  scanOverdueSessions().catch((err) => console.error("overdue session scan failed", err));
  return setInterval(() => {
    scanOverdueSessions().catch((err) => console.error("overdue session scan failed", err));
  }, intervalMs);
};

module.exports = { startOverdueSessionWatcher, scanOverdueSessions };
