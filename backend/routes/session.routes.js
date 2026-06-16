const express = require('express')
const router = express.Router()
const sessioncontroller = require('../controllers/session.controller')
const authmiddleware = require('../middlewares/user.middleware')

router.post('/create',authmiddleware.isloggedin,authmiddleware.isdesk,sessioncontroller.createsession)
router.get('/booked',authmiddleware.isloggedin,authmiddleware.isdesk,sessioncontroller.bookedsession)
router.get('/running/',authmiddleware.isloggedin,authmiddleware.isdesk,sessioncontroller.runningsession)
router.patch('/start/:id',authmiddleware.isloggedin,authmiddleware.isdesk,sessioncontroller.startsession)
router.patch('/pause/:id',authmiddleware.isloggedin,authmiddleware.isdesk,sessioncontroller.pausesession)
router.patch('/extend/:id',authmiddleware.isloggedin,authmiddleware.isdesk,sessioncontroller.extendsession)
router.patch('/resume/:id',authmiddleware.isloggedin,authmiddleware.isdesk,sessioncontroller.resumesession)
router.patch("/complete/:id",authmiddleware.isloggedin,authmiddleware.isdesk,sessioncontroller.completesession);


module.exports = router