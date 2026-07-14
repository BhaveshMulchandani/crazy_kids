const express = require('express');
const router = express.Router();
const {isloggedin, isadmin} = require('../middlewares/user.middleware');
const admincontroller = require('../controllers/admin.controller');

router.get('/customers', isloggedin, isadmin, admincontroller.fetchcustomers);

module.exports = router;