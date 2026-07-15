const Invoice = require("../models/invoice.model");
const Session = require("../models/session.model");
const KOT = require("../models/cafe.model");
const PriceSetting = require("../models/price.model");
const { calculateInvoiceCharges } = require("../services/billing.service");

const generateInvoiceNumber = async () => {
  const count = await Invoice.countDocuments();
  return `INV-${String(count + 1).padStart(5, "0")}`;
};

// Mirrors the invoice payload built at session completion time
// (session.controller.js:completesession) so offer discounts and active
// memberships are reflected the same way regardless of which route created
// the invoice. Does not mutate/consume membership hours — that side effect
// belongs solely to the session-completion flow.
const buildInvoicePayload = async ({ session, kots, settings }) => {
  const calculation = await calculateInvoiceCharges({ session, settings, kots });
  const startTime = session.startTime ? new Date(session.startTime) : null;
  const endTime = session.actualEndTime ? new Date(session.actualEndTime) : null;
  const actualDurationMinutes = startTime && endTime
    ? Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000))
    : 0;
  const pointsPer100 = Number(settings?.loyaltyPointsPer100 ?? 10);
  const loyaltyPoints = Math.floor(Number(calculation.grandTotal || 0) / 100) * pointsPer100;

  return {
    customer: {
      parentName: session.parentName || "",
      mobileNumber: session.mobileNumber || "",
      bandNumber: session.bandNumber || "",
      sessionNumber: session.sessionNumber || "",
      gender: session.gender || "",
      city: session.city || "",
    },
    children: calculation.childCharges,
    sessionDetails: {
      startTime: session.startTime || null,
      endTime: session.actualEndTime || null,
      actualDurationMinutes,
      totalHours: calculation.totalHours,
      extensionHours: calculation.extensionHours,
      pauseTimeMinutes: Number(session.totalPausedMinutes || 0),
    },
    cafeItems: calculation.cafeItems,
    charges: {
      sessionTotal: calculation.sessionTotal,
      cafeSubtotal: calculation.cafeSubtotal,
      cafeGST: calculation.cafeGST,
      cafeTotal: calculation.cafeTotal,
      grandTotal: calculation.grandTotal,
      loyaltyPoints,
      normalSessionTotal: calculation.normalSessionTotal,
      discountAmount: calculation.discountAmount,
      membershipPurchaseTotal: Number(calculation.membershipPurchase?.price || 0),
      socksQty: calculation.socksQty,
      socksRate: calculation.socksRate,
      socksTotal: calculation.socksTotal,
    },
    offer: {
      name: calculation.offer?.name || "",
      type: calculation.offer?.type || "",
      discountAmount: calculation.discountAmount,
      specialPricingApplied: calculation.specialPricingApplied,
    },
    membership: {
      applied: calculation.membershipApplied,
      membership: calculation.membership?._id || null,
      planName: calculation.membership?.planName || "",
      hoursConsumed: calculation.membershipApplied ? calculation.totalHours : 0,
      hoursBeforeSession: calculation.membershipApplied ? calculation.membership.remainingPlayHours : 0,
      remainingHours: calculation.membershipApplied ? calculation.membership.remainingPlayHours : 0,
      expiryDate: calculation.membershipApplied ? calculation.membership.expiryDate : null,
      purchase: {
        planName: calculation.membershipPurchase?.planName || "",
        price: Number(calculation.membershipPurchase?.price || 0),
      },
    },
    payment: {
      status: session.paymentStatus || "pending",
      breakdown: Array.isArray(session.paymentBreakdown)
        ? session.paymentBreakdown.map((entry) => ({
          method: entry?.method || "cash",
          amount: Number(entry?.amount || 0),
        }))
        : [],
      amountPaid: Number(session.amountPaid || 0),
      pendingAmount: Math.max(calculation.grandTotal - Number(session.amountPaid || 0), 0),
    },
  };
};

const createInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const existingInvoice = await Invoice.findOne({ session: id });
    if (existingInvoice) {
      return res.status(200).json({ message: "Invoice already exists", invoice: existingInvoice });
    }

    const settings = await PriceSetting.findOne();
    const kots = await KOT.find({ session: id }).sort({ createdAt: -1 });
    const invoicePayload = await buildInvoicePayload({ session, kots, settings });
    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      invoiceNumber,
      session: session._id,
      ...invoicePayload,
    });

    return res.status(201).json({ message: "Invoice created successfully", invoice });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
};

const getInvoiceBySession = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findOne({ session: id }).sort({ createdAt: -1 });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    return res.status(200).json({ invoice });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    return res.status(200).json({ invoice });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
};

const listInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    return res.status(200).json({ count: invoices.length, invoices });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
};

module.exports = {
  createInvoice,
  getInvoiceBySession,
  getInvoiceById,
  listInvoices,
};
