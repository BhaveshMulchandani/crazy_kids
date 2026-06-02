const expres = require("express");
const router = expres.Router();
const usercontroller = require("../controllers/user.controller")


router.post("/register",usercontroller.register)
router.post("/login",usercontroller.login)
router.post("/logout",usercontroller.logout)
router.post("/admin",usercontroller.admin)


module.exports = router;