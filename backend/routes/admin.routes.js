const express = require('express');
const router = express.Router();
const {isloggedin, isadmin} = require('../middlewares/user.middleware');
const admincontroller = require('../controllers/admin.controller');

router.get('/customers', isloggedin, isadmin, admincontroller.fetchcustomers);
router.get('/dashboard', isloggedin, isadmin, admincontroller.dashboardStats);
router.get('/reports/monthly', isloggedin, isadmin, admincontroller.monthlyCustomerReport);
router.get('/reports/monthly/pdf', isloggedin, isadmin, admincontroller.monthlyCustomerReportPdf);

module.exports = router;