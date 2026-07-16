const Invoice = require("../models/invoice.model");
const Session = require("../models/session.model");
const KOT = require("../models/cafe.model");
const PriceSetting = require("../models/price.model");
const { calculateInvoiceCharges } = require("../services/billing.service");
const whatsappService = require("../services/whatsapp.service");
const { getNextFormattedNumber } = require("../services/counter.service");

// countDocuments()+1 is not concurrency-safe (two concurrent invoice
// creations can read the same count before either write lands) and would
// also collide with session.controller.js:completesession, which shares
// this same atomic "invoiceNumber" sequence.
const generateInvoiceNumber = () =>
  getNextFormattedNumber({
    name: "invoiceNumber",
    model: Invoice,
    field: "invoiceNumber",
    prefix: "INV-",
    padLength: 5,
  });

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
      area: session.area || "",
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
      extraDiscountAmount: calculation.extraDiscountAmount,
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

    let invoice;
    try {
      invoice = await Invoice.create({
        invoiceNumber,
        session: session._id,
        ...invoicePayload,
      });
    } catch (createError) {
      // A concurrent request already created the invoice for this session
      // (unique index on Invoice.session) — return that one instead of
      // failing, matching the "already exists" branch above.
      if (createError.code !== 11000) throw createError;
      invoice = await Invoice.findOne({ session: id });
    }

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

// Accepts the exact PDF bytes the frontend rendered from the same
// #invoice-print markup the "Print invoice" button uses (see
// Runningbills.jsx), and stores them as-is. No PDF generation happens on
// the backend — this only persists what the client already produced, so
// there is a single invoice template (the print one) instead of a
// duplicate PDFKit-authored one.
const uploadInvoicePdf = async (req, res) => {
  const { invoiceId } = req.params;
  console.log("[invoice.controller] upload-pdf: invoked", {
    invoiceId,
    contentType: req.headers["content-type"],
    bodyBytes: Buffer.isBuffer(req.body) ? req.body.length : 0,
  });

  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      console.error("[invoice.controller] upload-pdf: empty or non-buffer body", { invoiceId });
      return res.status(400).json({ message: "Invoice PDF file is required" });
    }

    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      {
        pdf: {
          data: req.body,
          contentType: "application/pdf",
          generatedAt: new Date(),
        },
      },
      { new: true }
    ).select("_id");

    if (!invoice) {
      console.error("[invoice.controller] upload-pdf: invoice not found", { invoiceId });
      return res.status(404).json({ message: "Invoice not found" });
    }

    console.log("[invoice.controller] upload-pdf: stored successfully", { invoiceId });
    return res.status(200).json({ message: "Invoice PDF stored successfully" });
  } catch (error) {
    console.error("[invoice.controller] upload-pdf failed:", {
      invoiceId,
      message: error.message,
      stack: error.stack,
    });
    if (error.name === "CastError") {
      return res.status(404).json({ message: "Invoice not found" });
    }
    return res.status(500).json({ message: error.message || "Unable to store invoice PDF" });
  }
};

// Public (no auth) by design — TrdAI's servers fetch this URL directly to
// attach the PDF to the WhatsApp message, so it can't require a session
// cookie. The invoice id is an unguessable Mongo ObjectId, so this is
// effectively a share-link, the same trust model as e.g. hosted invoice
// links from other billing providers. Serves back exactly what
// uploadInvoicePdf stored — the print invoice, unmodified.
const getInvoicePdf = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await Invoice.findById(invoiceId).select("invoiceNumber pdf").lean();

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (!invoice.pdf?.data) {
      return res.status(404).json({ message: "Invoice PDF not found" });
    }

    const filename = `Invoice_${invoice.invoiceNumber || invoice._id}.pdf`;
    res.setHeader("Content-Type", invoice.pdf.contentType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    return res.send(invoice.pdf.data);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({ message: "Invoice not found" });
    }
    return res.status(500).json({ message: error.message || "Unable to load invoice PDF" });
  }
};

// Receive invoice id -> fetch invoice -> fetch session -> fetch parent
// name/mobile/reward points -> locate the public PDF url -> call TrdAI ->
// report success/failure. All WhatsApp-specific behavior lives in
// whatsapp.service.js; this only gathers the data it needs.
const sendInvoiceWhatsApp = async (req, res) => {
  const { invoiceId } = req.params;
  console.log("[invoice.controller] send-whatsapp: invoked", { invoiceId });

  try {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      console.error("[invoice.controller] send-whatsapp: invoice not found", { invoiceId });
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (!invoice.pdf?.data) {
      console.error("[invoice.controller] send-whatsapp: no stored PDF for invoice", { invoiceId });
      return res.status(404).json({ message: "Invoice PDF not found." });
    }

    const session = invoice.session ? await Session.findById(invoice.session).lean() : null;

    const parentName = session?.parentName || invoice.customer?.parentName || "";
    const mobileNumber = session?.mobileNumber || invoice.customer?.mobileNumber || "";
    const rewardPoints = invoice.charges?.loyaltyPoints;
    console.log("[invoice.controller] send-whatsapp: resolved recipient", {
      invoiceId,
      sessionId: invoice.session ? String(invoice.session) : null,
      parentName,
      mobileNumber,
      rewardPoints,
    });

    if (!mobileNumber?.trim()) {
      console.error("[invoice.controller] send-whatsapp: mobile number missing", { invoiceId });
      return res.status(400).json({ message: "Customer mobile number not found." });
    }

    const publicBaseUrl = process.env.PUBLIC_BASE_URL;
    if (!publicBaseUrl?.trim()) {
      console.error("[invoice.controller] send-whatsapp: PUBLIC_BASE_URL is not configured", { invoiceId });
      return res.status(404).json({ message: "Invoice PDF not found." });
    }

    const mediaUrl = `${publicBaseUrl.replace(/\/$/, "")}/invoice/${invoice._id}/pdf`;
    console.log("[invoice.controller] send-whatsapp: generated media URL", { invoiceId, mediaUrl });

    const result = await whatsappService.sendInvoice({
      destination: mobileNumber,
      userName: parentName,
      invoiceNumber: invoice.invoiceNumber,
      grandTotal: invoice.charges?.grandTotal,
      rewardPoints,
      mediaUrl,
      mediaFilename: `Invoice_${invoice.invoiceNumber || invoice._id}.pdf`,
    });

    console.log("[invoice.controller] send-whatsapp: succeeded", { invoiceId, data: result.data });
    return res.status(200).json({ message: "Invoice sent successfully on WhatsApp.", data: result.data });
  } catch (error) {
    // Full error (message, statusCode if set by whatsapp.service.js, and
    // stack) — never just error.message — so the actual cause is always
    // visible here even though the HTTP response the frontend gets stays a
    // plain { message } and the toast it shows stays generic.
    console.error("[invoice.controller] send-whatsapp failed:", {
      invoiceId,
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack,
    });
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to send invoice on WhatsApp." });
  }
};

module.exports = {
  createInvoice,
  getInvoiceBySession,
  getInvoiceById,
  listInvoices,
  uploadInvoicePdf,
  getInvoicePdf,
  sendInvoiceWhatsApp,
};
