const crypto = require("crypto");
const Invoice = require("../models/invoice.model");
const Session = require("../models/session.model");
const KOT = require("../models/cafe.model");
const PriceSetting = require("../models/price.model");
const { calculateInvoiceCharges } = require("../services/billing.service");
const whatsappService = require("../services/whatsapp.service");
const { getNextFormattedNumber } = require("../services/counter.service");
const { getDisplayName } = require("../utils/customerDisplay");

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
  // Same exemption rules as session.controller.js:completesession —
  // birthday sessions earn points normally; only a membership-covered
  // session or a "Birthday Group Booking" are exempt — regardless of which
  // route ends up creating the invoice.
  const loyaltyPointsExempt = calculation.membershipApplied || Boolean(session.groupBooking?.isBirthday);
  const loyaltyPoints = loyaltyPointsExempt ? 0 : Math.floor(Number(calculation.grandTotal || 0) / 100) * pointsPer100;

  return {
    customer: {
      // Falls back to session.children[0].name (the real representative/
      // placeholder child) whenever parentName is blank — mirrors
      // session.controller.js:completesession so the invoice's customer name
      // is never blank regardless of which route creates it.
      parentName: getDisplayName({ parentName: session.parentName, children: session.children }),
      mobileNumber: session.mobileNumber || "",
      bandNumber: session.bandNumber || "",
      sessionNumber: session.sessionNumber || "",
      area: session.area || "",
      city: session.city || "",
    },
    children: calculation.childCharges,
    groupBooking: calculation.groupBooking || undefined,
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

// Buffer-schema fields don't always come back from Mongoose as a true
// Node Buffer — depending on the driver/lean() path they can surface as the
// JSON-round-tripped { type: "Buffer", data: [...] } shape, or a BSON
// Binary wrapper. This matters a lot here: if a non-Buffer object were ever
// handed to res.send(), Express silently JSON.stringifies it via res.json()
// while the Content-Type header (already set to application/pdf at that
// point) is left untouched — so the response claims to be a PDF but its
// body actually starts with "{", which is exactly what "Failed to load
// PDF" in a browser looks like. Coerce to a real Buffer no matter which
// shape we got, so that failure mode can't happen.
const toPdfBuffer = (value) => {
  if (Buffer.isBuffer(value)) return value;
  if (!value) return null;
  if (typeof value.buffer === "function") return Buffer.from(value.buffer()); // BSON Binary
  if (typeof value.value === "function") return Buffer.from(value.value(true)); // older BSON Binary
  if (Array.isArray(value.data)) return Buffer.from(value.data); // {type:"Buffer",data:[...]}
  if (value.buffer instanceof ArrayBuffer) {
    return Buffer.from(value.buffer, value.byteOffset || 0, value.byteLength ?? value.buffer.byteLength);
  }
  return null;
};

// Every well-formed PDF starts with these exact bytes ("%PDF-").
const PDF_MAGIC = "%PDF-";

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

    // Diagnostic only — confirms whether the bytes are already valid at the
    // moment they're received, so a corrupt PDF on GET can be traced back
    // to "the client sent bad bytes" vs. "storage/retrieval corrupted
    // them" instead of guessing.
    const uploadFirst20 = req.body.subarray(0, 20);
    const uploadIsValidPdf = req.body.subarray(0, PDF_MAGIC.length).toString("latin1") === PDF_MAGIC;
    console.log("[invoice.controller] upload-pdf: received buffer", {
      invoiceId,
      sizeBytes: req.body.length,
      first20Bytes: Array.from(uploadFirst20),
      first20BytesAscii: uploadFirst20.toString("latin1"),
      isValidPdf: uploadIsValidPdf,
    });

    // Reject up front rather than storing bytes we already know aren't a
    // PDF — the client-side check in Runningbills.jsx should catch this
    // first, but a server-side gate means a bad blob can never make it into
    // storage regardless of what the client sends.
    if (!uploadIsValidPdf) {
      console.error("[invoice.controller] upload-pdf: rejected — body does not start with %PDF-", {
        invoiceId,
        first20BytesAscii: uploadFirst20.toString("latin1"),
      });
      return res.status(400).json({ message: "Uploaded file is not a valid PDF (missing %PDF- header)" });
    }

    const uploadedLength = req.body.length;

    await Invoice.findByIdAndUpdate(
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

    // Step 3 verification: don't trust that the write landed the way we
    // sent it — re-read the document from Mongo and compare length + magic
    // bytes against what was uploaded, so silent corruption in the
    // write/driver layer is caught here instead of surfacing later as a
    // TrdAI "invalid media" failure.
    const stored = await Invoice.findById(invoiceId).select("pdf").lean();
    if (!stored) {
      console.error("[invoice.controller] upload-pdf: invoice not found", { invoiceId });
      return res.status(404).json({ message: "Invoice not found" });
    }

    const storedBuffer = toPdfBuffer(stored.pdf?.data);
    const storedIsValidPdf = Boolean(
      storedBuffer && storedBuffer.subarray(0, PDF_MAGIC.length).toString("latin1") === PDF_MAGIC
    );
    const readbackMatches = Boolean(storedBuffer && storedBuffer.length === uploadedLength && storedIsValidPdf);
    console.log("[invoice.controller] upload-pdf: readback verification", {
      invoiceId,
      uploadedLength,
      storedLength: storedBuffer?.length ?? null,
      storedIsValidPdf,
      readbackMatches,
    });

    if (!readbackMatches) {
      console.error("[invoice.controller] upload-pdf: readback verification FAILED — stored bytes do not match upload", {
        invoiceId,
        uploadedLength,
        storedLength: storedBuffer?.length ?? null,
        storedIsValidPdf,
      });
      return res.status(500).json({ message: "Stored PDF is corrupted (readback verification failed)" });
    }

    console.log("[invoice.controller] upload-pdf: stored and verified successfully", { invoiceId, uploadedLength });
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
  const { invoiceId } = req.params;
  console.log("[invoice.controller] get-pdf: invoked", { invoiceId });

  try {
    const invoice = await Invoice.findById(invoiceId).select("invoiceNumber pdf").lean();

    if (!invoice) {
      console.error("[invoice.controller] get-pdf: invoice not found", { invoiceId });
      return res.status(404).json({ message: "Invoice not found" });
    }
    console.log("[invoice.controller] get-pdf: invoice found", {
      invoiceId,
      hasStoredPdf: Boolean(invoice.pdf?.data),
      storedContentType: invoice.pdf?.contentType,
      generatedAt: invoice.pdf?.generatedAt,
    });

    if (!invoice.pdf?.data) {
      console.error("[invoice.controller] get-pdf: no stored PDF for invoice", { invoiceId });
      return res.status(404).json({ message: "Invoice PDF not found" });
    }

    const pdfBuffer = toPdfBuffer(invoice.pdf.data);
    if (!pdfBuffer || pdfBuffer.length === 0) {
      console.error("[invoice.controller] get-pdf: stored PDF data could not be read as a buffer", {
        invoiceId,
        storedValueType: typeof invoice.pdf.data,
        wasBufferInstance: Buffer.isBuffer(invoice.pdf.data),
      });
      return res.status(500).json({ message: "Invoice PDF is corrupted" });
    }

    const first10 = pdfBuffer.subarray(0, 10);
    const isValidPdf = pdfBuffer.subarray(0, PDF_MAGIC.length).toString("latin1") === PDF_MAGIC;
    console.log("[invoice.controller] get-pdf: generated PDF buffer", {
      invoiceId,
      sizeBytes: pdfBuffer.length,
      first10Bytes: Array.from(first10),
      first10BytesAscii: first10.toString("latin1"),
      isValidPdf,
    });

    if (!isValidPdf) {
      console.error("[invoice.controller] get-pdf: stored data does not start with \"%PDF-\" — not a valid PDF", {
        invoiceId,
      });
      return res.status(500).json({ message: "Invoice PDF is corrupted" });
    }

    const filename = `Invoice_${invoice.invoiceNumber || invoice._id}.pdf`;
    res.setHeader("Content-Type", invoice.pdf.contentType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "no-cache");
    console.log("[invoice.controller] get-pdf: response headers", {
      invoiceId,
      "Content-Type": res.getHeader("Content-Type"),
      "Content-Disposition": res.getHeader("Content-Disposition"),
      "Content-Length": res.getHeader("Content-Length"),
      "Accept-Ranges": res.getHeader("Accept-Ranges"),
      "Cache-Control": res.getHeader("Cache-Control"),
    });

    // res.end(buffer) writes the exact bytes with no type-sniffing — unlike
    // res.send(), which would fall back to JSON.stringify for anything it
    // doesn't recognize as a Buffer/string.
    return res.end(pdfBuffer);
  } catch (error) {
    if (error.name === "CastError") {
      console.error("[invoice.controller] get-pdf: invalid invoice id", { invoiceId });
      return res.status(404).json({ message: "Invoice not found" });
    }
    console.error("[invoice.controller] get-pdf failed:", { invoiceId, message: error.message, stack: error.stack });
    return res.status(500).json({ message: error.message || "Unable to load invoice PDF" });
  }
};

// Step 5/6 verification: fetches the exact URL TrdAI is about to be handed
// and confirms it actually serves the same PDF we have stored, *before*
// spending a TrdAI call on it. This is what turns an opaque "TrdAI rejected
// media" or "failed to send" into an actionable reason (404, wrong
// content-type, HTML error page instead of a PDF, or a byte-level mismatch
// against what's in Mongo) — and it catches corruption introduced by
// anything between storage and the public response (proxy, header
// mangling, etc.), not just corruption at upload time.
const verifyPublicPdfUrl = async ({ mediaUrl, expectedBuffer, invoiceId }) => {
  let response;
  try {
    response = await fetch(mediaUrl, { signal: AbortSignal.timeout(15000) });
  } catch (networkError) {
    console.error("[invoice.controller] send-whatsapp: media URL self-check network error", {
      invoiceId,
      mediaUrl,
      name: networkError.name,
      message: networkError.message,
    });
    const error = new Error(
      networkError.name === "TimeoutError"
        ? "Public PDF URL timed out — TrdAI would not be able to fetch it either."
        : "Public PDF URL is not reachable from the server."
    );
    error.statusCode = 502;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  const bodyBuffer = Buffer.from(await response.arrayBuffer());
  const bodyFirst20 = bodyBuffer.subarray(0, 20);
  const bodyIsValidPdf = bodyBuffer.subarray(0, PDF_MAGIC.length).toString("latin1") === PDF_MAGIC;
  const expectedHash = crypto.createHash("sha256").update(expectedBuffer).digest("hex");
  const bodyHash = crypto.createHash("sha256").update(bodyBuffer).digest("hex");
  const hashesMatch = expectedHash === bodyHash;

  console.log("[invoice.controller] send-whatsapp: media URL self-check", {
    invoiceId,
    mediaUrl,
    httpStatus: response.status,
    contentType,
    bodySizeBytes: bodyBuffer.length,
    expectedSizeBytes: expectedBuffer.length,
    bodyFirst20BytesAscii: bodyFirst20.toString("latin1"),
    bodyIsValidPdf,
    expectedHash,
    bodyHash,
    hashesMatch,
  });

  if (response.status === 404) {
    const error = new Error("Public PDF URL returned 404 — the invoice PDF is not accessible at that address.");
    error.statusCode = 502;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`Public PDF URL returned HTTP ${response.status}.`);
    error.statusCode = 502;
    throw error;
  }
  if (contentType && !contentType.toLowerCase().includes("application/pdf")) {
    const error = new Error(
      `Public PDF URL returned Content-Type "${contentType}" instead of application/pdf — it likely served an HTML error page instead of the PDF.`
    );
    error.statusCode = 502;
    throw error;
  }
  if (!bodyIsValidPdf) {
    const error = new Error("Public PDF URL did not return a valid PDF (missing %PDF- header) — stored PDF may be corrupted.");
    error.statusCode = 502;
    throw error;
  }
  if (!hashesMatch) {
    const error = new Error("Public PDF URL served different bytes than what is stored — the PDF was altered somewhere between storage and delivery.");
    error.statusCode = 502;
    throw error;
  }
};

// Receive invoice id -> fetch invoice -> fetch session -> fetch parent
// name/mobile/reward points -> locate the public PDF url -> verify the
// public URL actually serves the exact stored bytes -> call TrdAI ->
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

    const parentName = getDisplayName({
      parentName: session?.parentName || invoice.customer?.parentName || "",
      children: session?.children || invoice.children || [],
    });
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

    const mediaUrl = `${publicBaseUrl.replace(/\/$/, "")}/api/invoice/${invoice._id}/pdf`;
    console.log("[invoice.controller] send-whatsapp: generated media URL", { invoiceId, mediaUrl });

    const expectedBuffer = toPdfBuffer(invoice.pdf.data);
    if (!expectedBuffer || expectedBuffer.length === 0) {
      console.error("[invoice.controller] send-whatsapp: stored PDF could not be read as a buffer", { invoiceId });
      return res.status(500).json({ message: "Stored PDF is corrupted." });
    }

    await verifyPublicPdfUrl({ mediaUrl, expectedBuffer, invoiceId });

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
