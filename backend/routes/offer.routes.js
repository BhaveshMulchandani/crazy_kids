const express = require("express")
const router = express.Router()
const authmiddleware = require('../middlewares/user.middleware')
const offercontroller = require('../controllers/offer.controller')

router.post('/createoffer', authmiddleware.isLoggedInAsAdmin, offercontroller.createOffer)

router.get("/", authmiddleware.isLoggedInAsAdmin, offercontroller.getoffer);

// Read by both sections (desk Billing.jsx loads it when booking, admin
// Offers.jsx manages it) — role-agnostic, either an admin or desk session is fine.
router.get("/active", authmiddleware.isloggedin, offercontroller.getactiveoffers);

router.patch("/:id/toggle", authmiddleware.isLoggedInAsAdmin, offercontroller.toggleoffer);

router.put("/:id", authmiddleware.isLoggedInAsAdmin, offercontroller.updateoffer);

router.delete("/:id", authmiddleware.isLoggedInAsAdmin, offercontroller.deleteoffer);

module.exports = router
