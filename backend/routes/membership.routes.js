const express = require("express");
const router = express.Router();
const auth = require("../middlewares/user.middleware");
const controller = require("../controllers/membership.controller");

router.get("/active/:mobileNumber", auth.isloggedin, auth.isdesk, controller.getActiveForCustomer);
router.get("/analytics", auth.isloggedin, auth.isadmin, controller.analytics);
module.exports = router;
