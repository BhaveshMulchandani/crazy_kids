const usermodel = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { COOKIE_NAMES, TOKEN_TTL_MS } = require("../middlewares/user.middleware")

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

        // A separate cookie per role (admin_token / desk_token) so an admin
        // and a desk session can coexist on the same shared browser without
        // one login silently overwriting the other's session. maxAge matches
        // the token's own "1d" expiresIn — without it, this was a browser
        // session cookie that could vanish well before the token actually
        // expired, logging people out (and losing unsaved form data) with no
        // warning.
        res.cookie(COOKIE_NAMES[user.role] || COOKIE_NAMES.desk, token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: TOKEN_TTL_MS,
        });

        return res.status(200).json({ message: "User logged in successfully", user })

    } catch (err) {
        return res.status(500).json({ message: "Server error", error: err.message })
    }

}

const logout = async (req, res) => {
    // Only clears the calling role's own cookie when told which one (the
    // admin/desk navbars each pass their own role) — a desk logout must
    // never also kill an admin session open in another tab of the same
    // shared browser, and vice versa. Falls back to clearing both when the
    // caller doesn't specify (e.g. an older cached frontend build).
    const { role } = req.body || {}

    if (role === "admin" || role === "desk") {
        res.clearCookie(COOKIE_NAMES[role])
    } else {
        res.clearCookie(COOKIE_NAMES.admin)
        res.clearCookie(COOKIE_NAMES.desk)
    }

    return res.status(200).json({ message: "User logged out successfully" })
}

const admin = async (req, res) => {
    try {
        const existingadmin = await usermodel.findOne({ email: "desaiswatib@gmail.com" })

        if (existingadmin) return res.status(409).json({ message: "admin already exists." })
        const hashpassword = await bcrypt.hash("240126", 12)


        const admin = await usermodel.create({

            username: "Admin",
            email: "desaiswatib@gmail.com",
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