const express = require('express');
const router = express.Router();
const {isLoggedInAsAdmin} = require('../middlewares/user.middleware');
const admincontroller = require('../controllers/admin.controller');

router.get('/customers', isLoggedInAsAdmin, admincontroller.fetchcustomers);
router.get('/dashboard', isLoggedInAsAdmin, admincontroller.dashboardStats);
router.get('/reports/daily', isLoggedInAsAdmin, admincontroller.dailyCustomerReport);
router.get('/reports/daily/pdf', isLoggedInAsAdmin, admincontroller.dailyCustomerReportPdf);
router.get('/reports/monthly', isLoggedInAsAdmin, admincontroller.monthlyCustomerReport);
router.get('/reports/monthly/pdf', isLoggedInAsAdmin, admincontroller.monthlyCustomerReportPdf);
router.get('/reports/yearly', isLoggedInAsAdmin, admincontroller.yearlyCustomerReport);
router.get('/reports/yearly/pdf', isLoggedInAsAdmin, admincontroller.yearlyCustomerReportPdf);

module.exports = router;
