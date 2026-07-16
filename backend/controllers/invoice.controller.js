const PDFDocument = require("pdfkit");
const Invoice = require("../models/invoice.model");
const Session = require("../models/session.model");
const KOT = require("../models/cafe.model");
const PriceSetting = require("../models/price.model");
const { calculateInvoiceCharges } = require("../services/billing.service");
const whatsappService = require("../services/whatsapp.service");

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

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;

// Renders the already-computed Invoice document (charges, children, cafe
// items — all produced once by billing.service.js at checkout time) as a
// PDF. No pricing/billing calculation happens here; this only formats
// fields that already exist on the invoice, the same data the on-screen
// "Generate Invoice" modal already prints via the browser.
const renderInvoicePdf = (invoice) => {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const customer = invoice.customer || {};
  const children = invoice.children || [];
  const cafeItems = invoice.cafeItems || [];
  const charges = invoice.charges || {};
  const offer = invoice.offer || {};
  const membership = invoice.membership || {};

  doc.rect(0, 0, doc.page.width, 6).fill("#2563eb");
  doc.moveDown(2);
  doc.font("Helvetica-Bold").fontSize(20).fillColor("#0f172a").text("PLAYKIT");
  doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("Tax Invoice");
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(`Invoice: ${invoice.invoiceNumber || "-"}`);
  doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(`Date: ${invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : "-"}`);
  doc.moveDown(0.8);
  doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.8);

  doc.font("Helvetica").fontSize(10).fillColor("#1f2937");
  doc.text(`Parent Name: ${customer.parentName || "-"}`);
  doc.text(`Mobile Number: ${customer.mobileNumber || "-"}`);
  if (customer.bandNumber) doc.text(`Band Number: ${customer.bandNumber}`);
  if (customer.sessionNumber) doc.text(`Session Number: ${customer.sessionNumber}`);
  if (customer.area) doc.text(`Area: ${customer.area}`);
  if (customer.city) doc.text(`City: ${customer.city}`);
  doc.moveDown(0.8);

  if (children.length > 0) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text("Children");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9.5).fillColor("#1f2937");
    children.forEach((child) => {
      doc.text(
        `${child.name || "-"}  |  Age ${child.age ?? "-"}  |  First Hour ${money(child.firstHourCharge)}  |  Socks ${child.socksOpted ? "Yes" : "No"}  |  Total ${money(child.childTotal)}`
      );
    });
    doc.moveDown(0.8);
  }

  if (cafeItems.length > 0) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text("Cafe Items");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9.5).fillColor("#1f2937");
    cafeItems.forEach((item) => {
      doc.text(`${item.name || "-"}  x${item.quantity || 1}  |  ${money(item.lineTotal)}`);
    });
    doc.moveDown(0.8);
  }

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text("Charges");
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor("#1f2937");
  doc.text(`Session Charges: ${money(charges.sessionTotal)}`);
  if (membership.applied) doc.text(`Membership Applied: ${membership.planName || "-"}`);
  if (!membership.applied && offer.name) doc.text(`Offer Applied: ${offer.name}`);
  if (charges.discountAmount) doc.text(`Discount Amount: -${money(charges.discountAmount)}`);
  if (charges.membershipPurchaseTotal) doc.text(`Membership Purchase: ${money(charges.membershipPurchaseTotal)}`);
  doc.text(`Cafe Total: ${money(charges.cafeTotal)}`);
  if (charges.socksQty) doc.text(`Socks (${charges.socksQty} x ${money(charges.socksRate)}): ${money(charges.socksTotal)}`);
  if (charges.extraDiscountAmount) doc.text(`Extra Discount: -${money(charges.extraDiscountAmount)}`);
  doc.text(`Loyalty Points Earned: ${charges.loyaltyPoints || 0}`);
  doc.moveDown(0.6);
  doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a").text(`Grand Total: ${money(charges.grandTotal)}`);
  doc.moveDown(1.5);
  doc.font("Helvetica-Oblique").fontSize(9).fillColor("#94a3b8").text("Thank you for visiting!", { align: "center" });

  return doc;
};

// Public (no auth) by design — TrdAI's servers fetch this URL directly to
// attach the PDF to the WhatsApp message, so it can't require a session
// cookie. The invoice id is an unguessable Mongo ObjectId, so this is
// effectively a share-link, the same trust model as e.g. hosted invoice
// links from other billing providers.
const getInvoicePdf = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await Invoice.findById(invoiceId).lean();

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const filename = `Invoice_${invoice.invoiceNumber || invoice._id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    const doc = renderInvoicePdf(invoice);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({ message: "Invoice not found" });
    }
    if (!res.headersSent) {
      return res.status(500).json({ message: error.message || "Unable to generate invoice PDF" });
    }
    res.end();
  }
};

// Receive invoice id -> fetch invoice -> fetch session -> fetch parent
// name/mobile/reward points -> locate the public PDF url -> call TrdAI ->
// report success/failure. All WhatsApp-specific behavior lives in
// whatsapp.service.js; this only gathers the data it needs.
const sendInvoiceWhatsApp = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const session = invoice.session ? await Session.findById(invoice.session).lean() : null;

    const parentName = session?.parentName || invoice.customer?.parentName || "";
    const mobileNumber = session?.mobileNumber || invoice.customer?.mobileNumber || "";

    if (!mobileNumber?.trim()) {
      return res.status(400).json({ message: "Customer mobile number not found." });
    }

    const publicBaseUrl = process.env.PUBLIC_BASE_URL;
    if (!publicBaseUrl?.trim()) {
      return res.status(404).json({ message: "Invoice PDF not found." });
    }

    const mediaUrl = `${publicBaseUrl.replace(/\/$/, "")}/invoice/${invoice._id}/pdf`;

    const result = await whatsappService.sendInvoice({
      destination: mobileNumber,
      userName: parentName,
      invoiceNumber: invoice.invoiceNumber,
      grandTotal: invoice.charges?.grandTotal,
      rewardPoints: invoice.charges?.loyaltyPoints,
      mediaUrl,
      mediaFilename: `Invoice_${invoice.invoiceNumber || invoice._id}.pdf`,
    });

    return res.status(200).json({ message: "Invoice sent successfully on WhatsApp.", data: result.data });
  } catch (error) {
    console.error("[invoice.controller] send-whatsapp failed:", error.message);
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to send invoice on WhatsApp." });
  }
};

module.exports = {
  createInvoice,
  getInvoiceBySession,
  getInvoiceById,
  listInvoices,
  getInvoicePdf,
  sendInvoiceWhatsApp,
};
