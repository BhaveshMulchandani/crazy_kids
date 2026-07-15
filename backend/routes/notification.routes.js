const express = require('express');
const router = express.Router();
const { isloggedin, isdesk } = require('../middlewares/user.middleware');
const notificationcontroller = require('../controllers/notification.controller');

router.get('/pending', isloggedin, isdesk, notificationcontroller.listPending);
router.patch('/:id/read', isloggedin, isdesk, notificationcontroller.markRead);

module.exports = router;
