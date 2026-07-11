const express = require('express')
const router = express.Router()
const authmiddleware = require('../middlewares/user.middleware')
const pricecontroller = require('../controllers/price.controller')

router.get('/prices', authmiddleware.isloggedin,pricecontroller.getSettings)
router.put('/updateprices', authmiddleware.isloggedin, authmiddleware.isadmin, pricecontroller.updateSettings)

module.exports = router 