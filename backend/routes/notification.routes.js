const express = require('express');
const router = express.Router();
const { isLoggedInAsDesk } = require('../middlewares/user.middleware');
const notificationcontroller = require('../controllers/notification.controller');

router.get('/pending', isLoggedInAsDesk, notificationcontroller.listPending);
router.patch('/:id/read', isLoggedInAsDesk, notificationcontroller.markRead);

module.exports = router;
