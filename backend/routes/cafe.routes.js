const express = require('express')
const router = express.Router()
const authmiddleware = require('../middlewares/user.middleware')
const cafecontroller = require('../controllers/cafe.controller')

router.get("/search/",authmiddleware.isLoggedInAsDesk,cafecontroller.searchCustomer);
router.post("/create",authmiddleware.isLoggedInAsDesk,cafecontroller.createKOT);
router.get("/session/:sessionId",authmiddleware.isLoggedInAsDesk,cafecontroller.getSessionKOTs);
router.get("/:id",authmiddleware.isLoggedInAsDesk,cafecontroller.getKOT);





module.exports = router