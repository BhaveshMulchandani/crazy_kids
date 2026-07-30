const express = require("express");
const router = express.Router();
const auth = require("../middlewares/user.middleware");
const controller = require("../controllers/membership.controller");

router.get("/active/:mobileNumber", auth.isLoggedInAsDesk, controller.getActiveForCustomer);
router.get("/analytics", auth.isLoggedInAsAdmin, controller.analytics);
// Read by both sections (Desk's Membership Dashboard page, and any other
// consumer) — role-agnostic, either an admin or desk session is fine, same
// as offer.routes.js's "/active".
router.get("/list", auth.isloggedin, controller.list);
module.exports = router;
