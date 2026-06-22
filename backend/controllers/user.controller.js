const usermodel = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")

const register = async (req, res) => {

    const { email, password } = req.body

    try {

        if (!email || !password) {
            return res.status(400).json({ message: "Please fill all the fields" })
        }

        const existinguser = await usermodel.findOne({ email })

        if (existinguser) {
            return res.status(400).json({ message: "User already exists" })
        }

        const salt = await bcrypt.genSalt(10)
        const hashpassword = await bcrypt.hash(password, salt)

        const user = await usermodel.create({
            email,
            password: hashpassword
        })

        return res.status(201).json({ message: "User registered successfully", user })

    } catch (err) {
        return res.status(500).json({ message: "Server error", error: err.message })
    }
}


const login = async (req, res) => {

    const { email, password } = req.body

    try {
        if (!email || !password) {
            return res.status(400).json({ message: "Please fill all the fields" })
        }

        const user = await usermodel.findOne({ email })

        if (!user) {
            return res.status(400).json({ message: "User does not exist" })
        }

        const ispassword = await bcrypt.compare(password, user.password)

        if (!ispassword) {
            return res.status(400).json({ message: "Invalid credentials" })
        }

        let token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" })

        res.cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
        });

        return res.status(200).json({ message: "User logged in successfully", user })

    } catch (err) {
        return res.status(500).json({ message: "Server error", error: err.message })
    }

}

const logout = async (req, res) => {
    res.clearCookie("token")
    return res.status(200).json({ message: "User logged out successfully" })
}

const admin = async (req, res) => {
    try {
        const existingadmin = await usermodel.findOne({ email: "admin@me.com" })

        if (existingadmin) return res.status(409).json({ message: "admin already exists." })

        const hashpassword = await bcrypt.hash("admin@1234", 12)


        const admin = await usermodel.create({

            username: "Admin",
            email: "admin@me.com",
            password: hashpassword,
            role: "admin"
        })

        res.status(201).json({ message: "admin created successfully" })
    } catch (error) {
        res.status(500).json({ message: "Internal server error", error });
    }
}

module.exports = {
    register,
    login,
    logout,
    admin
}