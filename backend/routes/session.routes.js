const express = require('express')
const router = express.Router()
const sessioncontroller = require('../controllers/session.controller')
const authmiddleware = require('../middlewares/user.middleware')

router.post('/create',authmiddleware.isloggedin,authmiddleware.isdesk,sessioncontroller.createsession)

module.exports = router