const express = require('express');
const router = express.Router()
const usermiddleware = require('../middlewares/user.middleware')
const menucontroller = require('../controllers/menu.controller')

router.post("/create",usermiddleware.isloggedin,usermiddleware.isdesk,menucontroller.createmenu)
router.get("/getall",menucontroller.getmenus)
router.put("/update/:id",usermiddleware.isloggedin,usermiddleware.isdesk,menucontroller.updatemenu)
router.delete("/delete/:id",usermiddleware.isloggedin,usermiddleware.isdesk,menucontroller.deletemenu)

module.exports = router