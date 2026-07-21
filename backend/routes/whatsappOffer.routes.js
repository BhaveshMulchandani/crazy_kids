const express = require("express");
const router = express.Router();
const { isloggedin, isadmin } = require("../middlewares/user.middleware");
const whatsappOfferController = require("../controllers/whatsappOffer.controller");

router.post("/send", isloggedin, isadmin, whatsappOfferController.sendOfferCampaign);

module.exports = router;
