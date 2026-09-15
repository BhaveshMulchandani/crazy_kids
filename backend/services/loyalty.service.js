const Invoice = require("../models/invoice.model");
const LoyaltyTransaction = require("../models/loyaltyTransaction.model");

// Single source of truth for a customer's CURRENT REDEEMABLE balance —
// every screen that shows "points" for a customer (as opposed to a report's
// period-scoped "points earned in this range", which intentionally keeps
// using its own date-bounded sum) should go through this, not repeat the
// $sum itself, so Desk/Admin/Billing can never drift into different
// formulas. Earned points (Invoice.charges.loyaltyPoints) are never written
// to here — redemptions/adjustments only ever add ledger rows on top.
const getEarnedPointsMap = async (mobileNumbers) => {
  if (!mobileNumbers.length) return new Map();
  const rows = await Invoice.aggregate([
    { $match: { "customer.mobileNumber": { $in: mobileNumbers } } },
    { $group: { _id: "$customer.mobileNumber", earned: { $sum: "$charges.loyaltyPoints" } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.earned]));
};

const getLedgerPointsMap = async (mobileNumbers) => {
  if (!mobileNumbers.length) return new Map();
  const rows = await LoyaltyTransaction.aggregate([
    { $match: { mobileNumber: { $in: mobileNumbers } } },
    { $group: { _id: "$mobileNumber", ledger: { $sum: "$points" } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.ledger]));
};

// Batched balance lookup — one pair of aggregations regardless of how many
// mobile numbers are requested, so list screens (customer directory,
// dashboard top customers, billing search) stay a fixed number of queries.
const getLoyaltyBalances = async (mobileNumbers) => {
  const uniqueMobiles = [...new Set(mobileNumbers)].filter(Boolean);
  if (!uniqueMobiles.length) return new Map();

  const [earnedMap, ledgerMap] = await Promise.all([
    getEarnedPointsMap(uniqueMobiles),
    getLedgerPointsMap(uniqueMobiles),
  ]);

  return new Map(
    uniqueMobiles.map((mobileNumber) => [
      mobileNumber,
      Number(earnedMap.get(mobileNumber) || 0) + Number(ledgerMap.get(mobileNumber) || 0),
    ])
  );
};

const getLoyaltyBalance = async (mobileNumber) => {
  const balances = await getLoyaltyBalances([mobileNumber]);
  return balances.get(mobileNumber) || 0;
};

module.exports = { getLoyaltyBalances, getLoyaltyBalance };
