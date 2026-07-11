const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoice.controller");
const authmiddleware = require("../middlewares/user.middleware");

router.post("/create/:id", authmiddleware.isloggedin, authmiddleware.isdesk, invoiceController.createInvoice);
router.get("/session/:id", authmiddleware.isloggedin, authmiddleware.isdesk, invoiceController.getInvoiceBySession);
router.get("/list", authmiddleware.isloggedin, authmiddleware.isdesk, invoiceController.listInvoices);
router.get("/:id", authmiddleware.isloggedin, authmiddleware.isdesk, invoiceController.getInvoiceById);

module.exports = router;
