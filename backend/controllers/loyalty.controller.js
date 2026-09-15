const Invoice = require("../models/invoice.model");
const LoyaltyTransaction = require("../models/loyaltyTransaction.model");
const { getLoyaltyBalance } = require("../services/loyalty.service");

const MOBILE_RE = /^\d{10}$/;

const HISTORY_LIMIT = 50;

// Desk-side view of one customer's loyalty standing: the current redeemable
// balance (see loyalty.service.js) plus a merged, newest-first history —
// "earned" rows are read straight from existing invoices (nothing new is
// stored for them), "redeemed"/"adjusted" rows come from the new ledger.
// This never touches Invoice documents, so it can't disturb the existing
// earning behaviour or any report that already reads charges.loyaltyPoints.
const getLoyaltyDetails = async (req, res) => {
  try {
    const mobileNumber = String(req.params.mobileNumber || "").trim();
    if (!MOBILE_RE.test(mobileNumber)) {
      return res.status(400).json({ message: "A valid 10-digit mobile number is required" });
    }

    const [earnedInvoices, ledgerEntries, currentBalance] = await Promise.all([
      Invoice.find({ "customer.mobileNumber": mobileNumber, "charges.loyaltyPoints": { $gt: 0 } })
        .select("invoiceNumber charges.loyaltyPoints createdAt")
        .sort({ createdAt: -1 })
        .limit(HISTORY_LIMIT)
        .lean(),
      LoyaltyTransaction.find({ mobileNumber })
        .sort({ createdAt: -1 })
        .limit(HISTORY_LIMIT)
        .lean(),
      getLoyaltyBalance(mobileNumber),
    ]);

    const history = [
      ...earnedInvoices.map((invoice) => ({
        type: "earned",
        points: invoice.charges.loyaltyPoints,
        balanceAfter: null,
        reason: `Invoice #${invoice.invoiceNumber}`,
        date: invoice.createdAt,
      })),
      ...ledgerEntries.map((entry) => ({
        type: entry.type,
        points: entry.points,
        balanceAfter: entry.balanceAfter,
        reason: entry.reason,
        date: entry.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, HISTORY_LIMIT);

    return res.status(200).json({ mobileNumber, currentBalance, history });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load loyalty details" });
  }
};

const redeemPoints = async (req, res) => {
  try {
    const mobileNumber = String(req.params.mobileNumber || "").trim();
    if (!MOBILE_RE.test(mobileNumber)) {
      return res.status(400).json({ message: "A valid 10-digit mobile number is required" });
    }
    const points = Number(req.body?.points);
    const reason = String(req.body?.reason || "").trim();

    if (!Number.isInteger(points) || points <= 0) {
      return res.status(400).json({ message: "Enter a whole number of points greater than zero" });
    }
    if (!reason) {
      return res.status(400).json({ message: "A reason is required to redeem points" });
    }

    const currentBalance = await getLoyaltyBalance(mobileNumber);
    if (points > currentBalance) {
      return res.status(400).json({ message: `Cannot redeem more than the current balance (${currentBalance} pts)` });
    }

    const balanceAfter = currentBalance - points;
    await LoyaltyTransaction.create({
      mobileNumber,
      type: "redeemed",
      points: -points,
      reason,
      balanceAfter,
      createdBy: req.user?._id || null,
    });

    return res.status(200).json({ message: "Points redeemed successfully", currentBalance: balanceAfter });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to redeem points" });
  }
};

// "Set new balance" workflow (per the desk UI) rather than asking staff to
// compute a +/- delta themselves — the signed ledger entry is derived here.
const adjustPoints = async (req, res) => {
  try {
    const mobileNumber = String(req.params.mobileNumber || "").trim();
    if (!MOBILE_RE.test(mobileNumber)) {
      return res.status(400).json({ message: "A valid 10-digit mobile number is required" });
    }
    const targetBalance = Number(req.body?.targetBalance);
    const reason = String(req.body?.reason || "").trim();

    if (!Number.isInteger(targetBalance) || targetBalance < 0) {
      return res.status(400).json({ message: "Enter a valid new balance (0 or more)" });
    }
    if (!reason) {
      return res.status(400).json({ message: "A reason is required to adjust points" });
    }

    const currentBalance = await getLoyaltyBalance(mobileNumber);
    const delta = targetBalance - currentBalance;
    if (delta === 0) {
      return res.status(200).json({ message: "Balance is already at that value", currentBalance });
    }

    await LoyaltyTransaction.create({
      mobileNumber,
      type: "adjusted",
      points: delta,
      reason,
      balanceAfter: targetBalance,
      createdBy: req.user?._id || null,
    });

    return res.status(200).json({ message: "Points adjusted successfully", currentBalance: targetBalance });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to adjust points" });
  }
};

module.exports = { getLoyaltyDetails, redeemPoints, adjustPoints };
