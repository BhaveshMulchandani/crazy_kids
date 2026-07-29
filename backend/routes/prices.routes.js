const express = require('express')
const router = express.Router()
const authmiddleware = require('../middlewares/user.middleware')
const pricecontroller = require('../controllers/price.controller')

// Read by both sections (desk pages need socks/hourly rates for live
// estimates, admin Settings.jsx manages them) — role-agnostic.
router.get('/prices', authmiddleware.isloggedin,pricecontroller.getSettings)
router.put('/updateprices', authmiddleware.isLoggedInAsAdmin, pricecontroller.updateSettings)

module.exports = router
