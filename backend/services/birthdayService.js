const Session = require("../models/session.model");
const whatsappService = require("./whatsapp.service");

// Returns today's day/month in IST wall-clock time, independent of the
// server's own timezone — birthdays are matched on day+month only, the
// birth year is ignored.
const getTodayDayMonthIST = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(new Date());

  return {
    day: Number(parts.find((p) => p.type === "day").value),
    month: Number(parts.find((p) => p.type === "month").value),
  };
};

// Accepts bare 10-digit Indian numbers or an already-91-prefixed 12-digit
// form — anything else isn't a sendable WhatsApp destination.
const hasValidMobileNumber = (mobileNumber) => {
  const digits = String(mobileNumber || "").replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 12 && digits.startsWith("91"));
};

// Children (not sessions) live nested inside session.children[], and the
// same child can appear across many repeat-visit sessions. This returns one
// row per unique child (mobileNumber + name + dob) whose dob matches
// today's day+month in IST — sessions are read newest-first so the most
// recently used parentName wins for a given number, mirroring
// whatsappOffer.controller.js's fetchEligibleCustomers.
const findTodaysBirthdayChildren = async () => {
  const { day, month } = getTodayDayMonthIST();

  const rows = await Session.aggregate([
    {
      $match: {
        mobileNumber: { $exists: true, $ne: "" },
        "children.dob": { $exists: true, $ne: null },
      },
    },
    { $sort: { createdAt: -1 } },
    { $unwind: "$children" },
    {
      $match: {
        "children.dob": { $ne: null },
        "children.name": { $exists: true, $ne: "" },
        $expr: {
          $and: [
            { $eq: [{ $dayOfMonth: { date: "$children.dob", timezone: "Asia/Kolkata" } }, day] },
            { $eq: [{ $month: { date: "$children.dob", timezone: "Asia/Kolkata" } }, month] },
          ],
        },
      },
    },
    {
      $group: {
        _id: {
          mobileNumber: "$mobileNumber",
          childName: "$children.name",
          dob: "$children.dob",
        },
        parentName: { $first: "$parentName" },
      },
    },
    {
      $project: {
        _id: 0,
        mobileNumber: "$_id.mobileNumber",
        childName: "$_id.childName",
        parentName: 1,
      },
    },
  ]);

  return rows.filter((row) => hasValidMobileNumber(row.mobileNumber) && row.childName?.trim());
};

// Sends one birthday WhatsApp message per birthday child found for today.
// Promise.allSettled guarantees one failed/rejected send never stops the
// rest of the run — every child is independent.
const runBirthdayCampaign = async () => {
  console.log("[birthday-service] Birthday Cron Started");

  const children = await findTodaysBirthdayChildren();
  console.log(`[birthday-service] Found ${children.length} birthday children.`);

  const results = await Promise.allSettled(
    children.map(async (child) => {
      console.log(`[birthday-service] Sending birthday message to ${child.mobileNumber} (${child.childName})...`);
      await whatsappService.sendBirthday({
        destination: child.mobileNumber,
        userName: child.parentName,
        childName: child.childName,
      });
      console.log(`[birthday-service] Success: ${child.mobileNumber} (${child.childName})`);
    })
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const child = children[index];
      console.error(
        `[birthday-service] Failed: ${child.mobileNumber} (${child.childName}) - ${result.reason?.message || result.reason}`
      );
    }
  });

  const succeeded = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - succeeded;
  console.log(`[birthday-service] Birthday Cron Completed. Sent: ${succeeded}, Failed: ${failed}.`);

  return { total: children.length, succeeded, failed };
};

module.exports = { findTodaysBirthdayChildren, runBirthdayCampaign };
