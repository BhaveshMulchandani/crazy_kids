const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoice.controller");
const authmiddleware = require("../middlewares/user.middleware");

router.post("/create/:id", authmiddleware.isloggedin, authmiddleware.isdesk, invoiceController.createInvoice);
router.get("/session/:id", authmiddleware.isloggedin, authmiddleware.isdesk, invoiceController.getInvoiceBySession);
router.get("/list", authmiddleware.isloggedin, authmiddleware.isdesk, invoiceController.listInvoices);
router.post("/:invoiceId/send-whatsapp", authmiddleware.isloggedin, authmiddleware.isdesk, invoiceController.sendInvoiceWhatsApp);
// Body is a raw PDF (Content-Type: application/pdf), not JSON — the
// desk client uploads the exact bytes it rendered from the print invoice.
router.post(
  "/:invoiceId/pdf",
  authmiddleware.isloggedin,
  authmiddleware.isdesk,
  express.raw({ type: "application/pdf", limit: "20mb" }),
  invoiceController.uploadInvoicePdf
);
// No auth — TrdAI's servers fetch this URL directly to attach the PDF to
// the WhatsApp message, so it can't require a login cookie.
router.get("/:invoiceId/pdf", invoiceController.getInvoicePdf);
router.get("/:id", authmiddleware.isloggedin, authmiddleware.isdesk, invoiceController.getInvoiceById);

module.exports = router;
