const express = require('express');
const router = express.Router()
const usermiddleware = require('../middlewares/user.middleware')
const menucontroller = require('../controllers/menu.controller')

router.post("/create",usermiddleware.isLoggedInAsDesk,menucontroller.createmenu)
router.get("/getall",menucontroller.getmenus)
router.put("/update/:id",usermiddleware.isLoggedInAsDesk,menucontroller.updatemenu)
router.delete("/delete/:id",usermiddleware.isLoggedInAsDesk,menucontroller.deletemenu)

module.exports = router