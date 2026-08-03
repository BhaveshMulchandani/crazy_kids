const express = require('express')
const router = express.Router()
const sessioncontroller = require('../controllers/session.controller')
const authmiddleware = require('../middlewares/user.middleware')

router.get("/billing/search",authmiddleware.isLoggedInAsDesk,sessioncontroller.searchBillingCustomer);
router.post('/create',authmiddleware.isLoggedInAsDesk,sessioncontroller.createsession)
router.get('/booked',authmiddleware.isLoggedInAsDesk,sessioncontroller.bookedsession)
router.get('/running/',authmiddleware.isLoggedInAsDesk,sessioncontroller.runningsession)
router.get('/completed/recent',authmiddleware.isLoggedInAsDesk,sessioncontroller.recentCompletedSessions)
router.patch('/start/:id',authmiddleware.isLoggedInAsDesk,sessioncontroller.startsession)
router.patch('/pause/:id',authmiddleware.isLoggedInAsDesk,sessioncontroller.pausesession)
router.patch('/extend/:id',authmiddleware.isLoggedInAsDesk,sessioncontroller.extendsession)
router.patch('/resume/:id',authmiddleware.isLoggedInAsDesk,sessioncontroller.resumesession)
router.patch("/complete/:id",authmiddleware.isLoggedInAsDesk,sessioncontroller.completesession);
router.patch("/cancel/:id",authmiddleware.isLoggedInAsDesk,sessioncontroller.cancelsession);
router.patch("/settle-payment/:id",authmiddleware.isLoggedInAsDesk,sessioncontroller.settlePendingPayment);
router.patch('/pause-child/:id/:index',authmiddleware.isLoggedInAsDesk,sessioncontroller.pauseChild)
router.patch('/resume-child/:id/:index',authmiddleware.isLoggedInAsDesk,sessioncontroller.resumeChild)


module.exports = router