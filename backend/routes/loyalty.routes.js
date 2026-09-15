const express = require('express');
const router = express.Router();
const { isLoggedInAsDesk } = require('../middlewares/user.middleware');
const loyaltycontroller = require('../controllers/loyalty.controller');

// Desk-side only — loyalty redemption/adjustment is deliberately not
// reachable from the admin session cookie (isLoggedInAsAdmin), per the
// desk-only scope of this feature. Admin keeps reading balances via the
// shared loyalty.service, just with no write action attached.
router.get('/:mobileNumber', isLoggedInAsDesk, loyaltycontroller.getLoyaltyDetails);
router.post('/:mobileNumber/redeem', isLoggedInAsDesk, loyaltycontroller.redeemPoints);
router.post('/:mobileNumber/adjust', isLoggedInAsDesk, loyaltycontroller.adjustPoints);

module.exports = router;
