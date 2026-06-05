const jwt = require('jsonwebtoken')
const usermodel = require('../models/user.model')

const isloggedin =async (req, res, nxt) => {

    const token = req.cookies.token

    if (!token) {
        return res.status(401).json({ msg: "Unauthorized" })
    }

    try {

        const { id } = jwt.verify(token, process.env.JWT_SECRET)

        const user = await usermodel.findById(id)

        if (!user) {
            return res.status(401).json({ message: "user not found, please login again" })
        }

        req.user = user
        nxt()
    } catch (error) {

        return res.status(401).json({ message: "please login first" })

    }
}

const isdesk = async (req, res, nxt) => {

    if (req.user.role !== "desk") {
        return res.status(403).json({ message: "forbidden" })
    }
    nxt()
}

const isadmin = (req, res, nxt) => {

    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "forbidden" })
    }
    nxt()
}

module.exports = { isloggedin, isdesk, isadmin }