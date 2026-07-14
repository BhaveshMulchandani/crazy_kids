const sessionmodel = require("../models/session.model");
const Invoice = require("../models/invoice.model");

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
};