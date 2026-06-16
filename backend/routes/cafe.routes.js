const express = require('express')
const router = express.Router()
const authmiddleware = require('../middlewares/user.middleware')
const cafecontroller = require('../controllers/cafe.controller')

router.get("/search/",authmiddleware.isloggedin,authmiddleware.isdesk,cafecontroller.searchCustomer);
router.post("/create",authmiddleware.isloggedin,authmiddleware.isdesk,cafecontroller.createKOT);
router.get("/session/:sessionId",authmiddleware.isloggedin,authmiddleware.isdesk,cafecontroller.getSessionKOTs);
router.get("/:id",authmiddleware.isloggedin,authmiddleware.isdesk,cafecontroller.getKOT);





module.exports = router