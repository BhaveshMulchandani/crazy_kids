const Membership = require("../models/membership.model");
const Offer = require("../models/offer.model");

const refreshStatus = (membership, now = new Date()) => {
  if (membership.expiryDate <= now) membership.status = "expired";
  else if (Number(membership.remainingPlayHours) <= 0) membership.status = "exhausted";
  else membership.status = "active";
  return membership;
};

const serialize = (membership) => {
  const item = membership.toObject ? membership.toObject() : membership;
  return { ...item, isActive: item.status === "active" && new Date(item.expiryDate) > new Date() && Number(item.remainingPlayHours) > 0 };
};

const getActiveForCustomer = async (req, res) => {
  try {
    const mobileNumber = String(req.params.mobileNumber || "").trim();
    const memberships = await Membership.find({ "customer.mobileNumber": mobileNumber, status: "active" }).sort({ expiryDate: 1, createdAt: -1 });
    const now = new Date();
    for (const membership of memberships) {
      refreshStatus(membership, now);
      await membership.save();
    }
    const membership = memberships.find((item) => item.status === "active");
    return res.json({ membership: membership ? serialize(membership) : null });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load membership" });
  }
};

const createMembership = async ({ parentName, mobileNumber, planId }) => {
  const plan = await Offer.findOne({ _id: planId, type: "membership", active: true });
  if (!plan) throw new Error("Selected membership plan is unavailable");
  const rules = plan.rules || {};
  const playHours = Number(rules.playHours || 0);
  const bonusHours = Number(rules.bonusHours || 0);
  const validityMonths = Number(rules.validityMonths || 0);
  if (playHours <= 0 || validityMonths <= 0 || Number(rules.kidsAllowed || 0) <= 0) throw new Error("Membership plan configuration is invalid");
  const purchaseDate = new Date();
  const expiryDate = new Date(purchaseDate);
  expiryDate.setMonth(expiryDate.getMonth() + validityMonths);
  return Membership.create({
    customer: { parentName: (parentName || "").trim(), mobileNumber: mobileNumber.trim() },
    membershipPlan: plan._id,
    planName: plan.name,
    purchasePrice: Number(plan.value || 0),
    purchaseDate,
    expiryDate,
    totalPlayHours: playHours + bonusHours,
    usedPlayHours: 0,
    remainingPlayHours: playHours + bonusHours,
    kidsAllowed: Number(rules.kidsAllowed),
    bonusHours,
    benefits: Array.isArray(rules.benefits) ? rules.benefits.filter(Boolean) : [],
  });
};

const analytics = async (req, res) => {
  try {
    const now = new Date();
    await Membership.updateMany({ status: "active", expiryDate: { $lte: now } }, { $set: { status: "expired" } });
    await Membership.updateMany({ status: "active", remainingPlayHours: { $lte: 0 } }, { $set: { status: "exhausted" } });
    const memberships = await Membership.find().sort({ purchaseDate: -1 }).limit(10).lean();
    const totals = await Membership.aggregate([{ $group: { _id: null, totalSold: { $sum: 1 }, revenue: { $sum: "$purchasePrice" }, hoursConsumed: { $sum: "$usedPlayHours" }, remainingHours: { $sum: "$remainingPlayHours" } } }]);
    const popular = await Membership.aggregate([{ $group: { _id: "$planName", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 1 }]);
    const expiringSoon = await Membership.find({ status: "active", expiryDate: { $gt: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } }).sort({ expiryDate: 1 }).limit(10).lean();
    // Dashboard card metric — replaces "expiring in 7 days" as the headline
    // number shown on the admin dashboard (expiringSoon above is kept as-is
    // for other consumers, e.g. the Membership Dashboard's filters).
    const soldLast30Days = await Membership.countDocuments({ purchaseDate: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } });
    const total = totals[0] || {};
    return res.json({ totalSold: total.totalSold || 0, soldLast30Days, active: await Membership.countDocuments({ status: "active", expiryDate: { $gt: now }, remainingPlayHours: { $gt: 0 } }), expired: await Membership.countDocuments({ status: "expired" }), revenue: total.revenue || 0, hoursConsumed: total.hoursConsumed || 0, remainingHours: total.remainingHours || 0, popularPlan: popular[0] || null, expiringSoon, recent: memberships });
  } catch (error) { return res.status(500).json({ message: error.message || "Unable to load membership analytics" }); }
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Coarser, display-facing status than the raw `status` enum on the model —
// "expired" here covers both `expired` (past expiryDate) and `exhausted`
// (no play hours left), since a customer/operator only cares that the
// membership can no longer be used, not why.
const displayStatus = (membership, now, expiringSoonCutoff) => {
  if (membership.status !== "active") return "expired";
  return membership.expiryDate <= expiringSoonCutoff ? "expiring_soon" : "active";
};

// Server-side paginated + searchable + sortable + filterable membership
// directory for the admin Membership Dashboard page. Does not change any
// existing membership behaviour — purely a read/list endpoint alongside the
// existing analytics/getActiveForCustomer ones.
const list = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const statusFilter = String(req.query.status || "").trim();
    const allowedSortFields = {
      purchaseDate: "purchaseDate",
      expiryDate: "expiryDate",
      remainingPlayHours: "remainingPlayHours",
      usedPlayHours: "usedPlayHours",
      totalPlayHours: "totalPlayHours",
      planName: "planName",
      parentName: "customer.parentName",
      mobileNumber: "customer.mobileNumber",
    };
    const sortField = allowedSortFields[req.query.sortBy] || "purchaseDate";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const now = new Date();
    // Keep statuses fresh before filtering/listing, same as analytics above.
    await Membership.updateMany({ status: "active", expiryDate: { $lte: now } }, { $set: { status: "expired" } });
    await Membership.updateMany({ status: "active", remainingPlayHours: { $lte: 0 } }, { $set: { status: "exhausted" } });

    const expiringSoonCutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const match = {};

    if (search) {
      const pattern = escapeRegex(search);
      match.$or = [
        { "customer.parentName": { $regex: pattern, $options: "i" } },
        { "customer.mobileNumber": { $regex: pattern, $options: "i" } },
        { planName: { $regex: pattern, $options: "i" } },
        { "registeredChildren.name": { $regex: pattern, $options: "i" } },
      ];
    }

    if (statusFilter === "active") {
      match.status = "active";
      match.expiryDate = { $gt: expiringSoonCutoff };
    } else if (statusFilter === "expiring_soon") {
      match.status = "active";
      match.expiryDate = { $lte: expiringSoonCutoff, $gt: now };
    } else if (statusFilter === "expired") {
      match.status = { $in: ["expired", "exhausted"] };
    }

    const [rows, total] = await Promise.all([
      Membership.find(match).sort({ [sortField]: sortDir }).skip(skip).limit(limit).lean(),
      Membership.countDocuments(match),
    ]);

    const memberships = rows.map((m) => ({
      ...m,
      displayStatus: displayStatus(m, now, expiringSoonCutoff),
    }));

    return res.json({ memberships, total, page, limit });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load memberships" });
  }
};

module.exports = { getActiveForCustomer, createMembership, refreshStatus, serialize, analytics, list };
