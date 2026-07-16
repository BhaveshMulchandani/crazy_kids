const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoice.controller");
const authmiddleware = require("../middlewares/user.middleware");

router.post("/create/:id", authmiddleware.isloggedin, authmiddleware.isdesk, invoiceController.createInvoice);
router.get("/session/:id", authmiddleware.isloggedin, authmiddleware.isdesk, invoiceController.getInvoiceBySession);
router.get("/list", authmiddleware.isloggedin, authmiddleware.isdesk, invoiceController.listInvoices);
router.post("/:invoiceId/send-whatsapp", authmiddleware.isloggedin, authmiddleware.isdesk, invoiceController.sendInvoiceWhatsApp);
// No auth — TrdAI's servers fetch this URL directly to attach the PDF to
// the WhatsApp message, so it can't require a login cookie.
router.get("/:invoiceId/pdf", invoiceController.getInvoicePdf);
router.get("/:id", authmiddleware.isloggedin, authmiddleware.isdesk, invoiceController.getInvoiceById);

module.exports = router;
