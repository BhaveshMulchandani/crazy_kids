const express = require("express")
const router = express.Router()
const authmiddleware = require('../middlewares/user.middleware')
const offercontroller = require('../controllers/offer.controller')

router.post('/createoffer', authmiddleware.isloggedin, authmiddleware.isadmin, offercontroller.createOffer)

router.get("/", authmiddleware.isloggedin, authmiddleware.isadmin, offercontroller.getoffer);

router.get("/active", authmiddleware.isloggedin, offercontroller.getactiveoffers);

router.patch("/:id/toggle", authmiddleware.isloggedin, authmiddleware.isadmin, offercontroller.toggleoffer);

router.delete("/:id", authmiddleware.isloggedin, authmiddleware.isadmin, offercontroller.deleteoffer);

module.exports = router