const express = require("express");
const router = express.Router();
const auth = require("../middlewares/user.middleware");
const controller = require("../controllers/membership.controller");

router.get("/active/:mobileNumber", auth.isLoggedInAsDesk, controller.getActiveForCustomer);
router.get("/analytics", auth.isLoggedInAsAdmin, controller.analytics);
module.exports = router;
