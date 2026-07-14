const sessionmodel = require("../models/session.model");
const Invoice = require("../models/invoice.model");

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfWeek = (date = new Date()) => {
  // Calendar week: Monday 00:00 -> Sunday 23:59
  const d = startOfDay(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  return d;
};

const startOfMonth = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);

const localDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// Offset of the server's local timezone, e.g. "+05:30" — keeps the
// $dateToString day-bucketing in the aggregation in sync with the
// local-time day/week/month boundaries computed above.
const tzOffsetString = (date = new Date()) => {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
};

const dashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const today = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const trendStart = startOfDay(new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000));
    const tz = tzOffsetString(now);

    const [facetResult, activeSessions] = await Promise.all([
      Invoice.aggregate([
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: "$charges.grandTotal" },
                  cafeRevenue: { $sum: "$charges.cafeTotal" },
                  totalOrders: { $sum: 1 },
                },
              },
            ],
            today: [
              { $match: { createdAt: { $gte: today } } },
              { $group: { _id: "$customer.mobileNumber", total: { $sum: "$charges.grandTotal" } } },
            ],
            week: [
              { $match: { createdAt: { $gte: weekStart } } },
              {
                $group: {
                  _id: null,
                  sales: { $sum: "$charges.grandTotal" },
                  cafeSales: { $sum: "$charges.cafeTotal" },
                },
              },
            ],
            month: [
              { $match: { createdAt: { $gte: monthStart } } },
              { $group: { _id: null, sales: { $sum: "$charges.grandTotal" } } },
            ],
            revenueTrend: [
              { $match: { createdAt: { $gte: trendStart } } },
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: tz } },
                  revenue: { $sum: "$charges.grandTotal" },
                },
              },
            ],
            offerUsage: [
              { $match: { "offer.name": { $nin: ["", null] } } },
              { $group: { _id: "$offer.name", value: { $sum: 1 } } },
              { $sort: { value: -1 } },
              { $limit: 8 },
            ],
            bestSellingCafeItems: [
              { $unwind: "$cafeItems" },
              { $group: { _id: "$cafeItems.name", qty: { $sum: "$cafeItems.quantity" } } },
              { $sort: { qty: -1 } },
              { $limit: 6 },
            ],
            topCustomers: [
              {
                $group: {
                  _id: "$customer.mobileNumber",
                  parentName: { $last: "$customer.parentName" },
                  total_spent: { $sum: "$charges.grandTotal" },
                  visit_count: { $sum: 1 },
                  reward_points: { $sum: "$charges.loyaltyPoints" },
                },
              },
              { $sort: { total_spent: -1 } },
              { $limit: 5 },
            ],
            customerVisits: [
              {
                $group: {
                  _id: "$customer.mobileNumber",
                  visits: { $sum: 1 },
                  firstVisit: { $min: "$createdAt" },
                },
              },
            ],
            recentTransactions: [
              { $sort: { createdAt: -1 } },
              { $limit: 6 },
              {
                $project: {
                  invoiceNumber: 1,
                  "customer.parentName": 1,
                  "customer.bandNumber": 1,
                  "customer.sessionNumber": 1,
                  "charges.grandTotal": 1,
                  createdAt: 1,
                },
              },
            ],
          },
        },
      ]),
      sessionmodel
        .find({ status: "running" })
        .select("sessionNumber parentName bandNumber scheduledEndTime")
        .sort({ scheduledEndTime: 1 })
        .limit(50)
        .lean(),
    ]);

    const facets = facetResult[0];
    const totals = facets.totals[0] || { totalRevenue: 0, cafeRevenue: 0, totalOrders: 0 };
    const week = facets.week[0] || { sales: 0, cafeSales: 0 };
    const month = facets.month[0] || { sales: 0 };
    const todaySales = facets.today.reduce((sum, c) => sum + Number(c.total || 0), 0);
    const todayCustomers = facets.today.length;
    const repeatCustomers = facets.customerVisits.filter((c) => c.visits > 1).length;
    const newCustomersThisWeek = facets.customerVisits.filter((c) => c.firstVisit >= weekStart).length;

    const trendMap = new Map(facets.revenueTrend.map((r) => [r._id, r.revenue]));
    const revenueTrend = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const key = localDateKey(d);
      revenueTrend.push({ date: key, revenue: trendMap.get(key) || 0 });
    }

    return res.status(200).json({
      totals,
      today: { sales: todaySales, customers: todayCustomers },
      week,
      month,
      repeatCustomers,
      newCustomersThisWeek,
      topCustomers: facets.topCustomers,
      recentTransactions: facets.recentTransactions,
      revenueTrend,
      offerUsage: facets.offerUsage,
      bestSellingCafeItems: facets.bestSellingCafeItems,
      activeSessions,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load dashboard stats" });
  }
};

const fetchcustomers = async (req, res) => {
  try {
    // Latest completed session of every customer
    const sessions = await sessionmodel
      .find({ status: "completed" })
      .select(
        "_id sessionNumber parentName mobileNumber bandNumber children createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    if (!sessions.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        customers: [],
      });
    }

    // Unique mobile numbers
    const mobileNumbers = [
      ...new Set(sessions.map((session) => session.mobileNumber)),
    ];

    // All completed sessions of those customers
    const completedSessions = await sessionmodel
      .find({
        status: "completed",
        mobileNumber: { $in: mobileNumbers },
      })
      .select("_id mobileNumber")
      .lean();

    // All invoices
    const invoices = await Invoice.find({
      session: { $in: completedSessions.map((s) => s._id) },
    })
      .select("session charges.grandTotal charges.loyaltyPoints")
      .lean();

    // Mobile lookup
    const sessionMobileMap = new Map(
      completedSessions.map((s) => [String(s._id), s.mobileNumber])
    );

    // Stats initialize
    const statsMap = new Map();

    mobileNumbers.forEach((mobile) => {
      statsMap.set(mobile, {
        visit_count: 0,
        total_spent: 0,
        reward_points: 0,
      });
    });

    // Visit count
    completedSessions.forEach((session) => {
      statsMap.get(session.mobileNumber).visit_count += 1;
    });

    // Total spent & reward points
    invoices.forEach((invoice) => {
      const mobile = sessionMobileMap.get(String(invoice.session));

      if (!mobile) return;

      const stats = statsMap.get(mobile);

      stats.total_spent += Number(invoice.charges?.grandTotal || 0);
      stats.reward_points += Number(invoice.charges?.loyaltyPoints || 0);
    });

    // One customer per mobile number
    const customersMap = new Map();

    sessions.forEach((session) => {
      if (!customersMap.has(session.mobileNumber)) {
        customersMap.set(session.mobileNumber, {
          ...session,
          ...statsMap.get(session.mobileNumber),
        });
      }
    });

    return res.status(200).json({
      success: true,
      count: customersMap.size,
      customers: [...customersMap.values()],
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
};

module.exports = {
  fetchcustomers,
  dashboardStats,
};