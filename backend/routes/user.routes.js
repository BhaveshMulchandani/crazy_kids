const expres = require("express");
const router = expres.Router();
const usercontroller = require("../controllers/user.controller")


router.post("/register",usercontroller.register)


module.exports = router;