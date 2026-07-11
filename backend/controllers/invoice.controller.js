const Invoice = require("../models/invoice.model");
const Session = require("../models/session.model");
const KOT = require("../models/cafe.model");
const PriceSetting = require("../models/price.model");

const generateInvoiceNumber = async () => {
  const count = await Invoice.countDocuments();
  return `INV-${String(count + 1).padStart(5, "0")}`;
};

const buildInvoicePayload = async ({ session, kots, settings }) => {
  const children = Array.isArray(session.children) ? session.children : [];
  const totalHours = Number(session.totalHours || 1);
  const extensionHours = Math.max(totalHours - 1, 0);
  const pauseTimeMinutes = Number(session.totalPausedMinutes || 0);
  const startTime = session.startTime ? new Date(session.startTime) : null;
  const endTime = session.actualEndTime ? new Date(session.actualEndTime) : null;
  const actualDurationMinutes = startTime && endTime
    ? Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000))
    : 0;

  const childCharges = children.map((child) => {
    const age = Number(child?.age ?? 0);
    const isUnder3 = age < 3;
    const firstHourRate = isUnder3
      ? Number(settings?.firstHourUnder3 ?? 0)
      : Number(settings?.firstHourAbove3 ?? 0);
    const extensionRate = isUnder3
      ? Number(settings?.extensionUnder3 ?? 0)
      : Number(settings?.extensionAbove3 ?? 0);
    const firstHourCharge = firstHourRate;
    const extensionCharge = Math.max(totalHours - 1, 0) * extensionRate;
    const childTotal = firstHourCharge + extensionCharge;

    return {
      name: child?.name || "",
      dob: child?.dob || null,
      age,
      firstHourCharge,
      extensionHours: Math.max(totalHours - 1, 0),
      extensionRate,
      childTotal,
    };
  });

  const sessionTotal = childCharges.reduce((sum, child) => sum + Number(child.childTotal || 0), 0);
  const cafeItems = (kots || []).flatMap((kot) => (kot?.items || []).map((item) => ({
    name: item?.name || "",
    quantity: Number(item?.quantity || 1),
    unitPrice: Number(item?.price || 0),
    lineTotal: Number(item?.total || 0),
  })));
  const cafeTotal = cafeItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const grandTotal = sessionTotal + cafeTotal;
  const pointsPer100 = Number(settings?.loyaltyPointsPer100 ?? 10);
  const loyaltyPoints = Math.floor(Number(grandTotal || 0) / 100) * pointsPer100;

  return {
    customer: {
      parentName: session.parentName || "",
      mobileNumber: session.mobileNumber || "",
      bandNumber: session.bandNumber || "",
      sessionNumber: session.sessionNumber || "",
    },
    children: childCharges,
    sessionDetails: {
      startTime: session.startTime || null,
      endTime: session.actualEndTime || null,
      actualDurationMinutes,
      totalHours,
      extensionHours,
      pauseTimeMinutes,
    },
    cafeItems,
    charges: {
      sessionTotal,
      cafeTotal,
      grandTotal,
      loyaltyPoints,
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
      pendingAmount: Math.max(grandTotal - Number(session.amountPaid || 0), 0),
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
