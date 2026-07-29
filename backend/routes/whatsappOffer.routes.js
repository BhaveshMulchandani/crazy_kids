const express = require("express");
const router = express.Router();
const { isLoggedInAsAdmin } = require("../middlewares/user.middleware");
const whatsappOfferController = require("../controllers/whatsappOffer.controller");

router.post("/send", isLoggedInAsAdmin, whatsappOfferController.sendOfferCampaign);

module.exports = router;
