const expres = require("express");
const router = expres.Router();
const rateLimit = require("express-rate-limit");
const usercontroller = require("../controllers/user.controller")

// Throttles forgot-password requests per IP so the endpoint can't be used to
// spam an inbox or brute-force-probe registered emails.
const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many password reset requests. Please try again later." }
})

router.post("/register",usercontroller.register)
router.post("/login",usercontroller.login)
router.post("/logout",usercontroller.logout)
router.post("/admin",usercontroller.admin)
router.post("/forgot-password",forgotPasswordLimiter,usercontroller.forgotPassword)
router.post("/verify-reset-token",usercontroller.verifyResetToken)
router.post("/reset-password",usercontroller.resetPassword)


module.exports = router;