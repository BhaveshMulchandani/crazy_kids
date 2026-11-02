const usermodel = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const { COOKIE_NAMES, TOKEN_TTL_MS } = require("../middlewares/user.middleware")
const { sendPasswordResetEmail } = require("../services/email.service")

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000

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

const forgotPassword = async (req, res) => {

    const { email } = req.body

    if (!email) {
        return res.status(400).json({ message: "Please provide an email address" })
    }

    // Always the same response, whether or not the email is registered —
    // never reveal account existence through this endpoint.
    const genericResponse = { message: "If that email is registered, a password reset link has been sent." }

    try {
        const user = await usermodel.findOne({ email })

        if (user) {
            const rawToken = crypto.randomBytes(32).toString("hex")
            const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")

            user.resetPasswordTokenHash = tokenHash
            user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS)
            await user.save()

            const resetUrl = `${process.env.FRONTEND_URL}/#/reset-password?token=${rawToken}`

            try {
                await sendPasswordResetEmail({ to: user.email, resetUrl })
            } catch (emailError) {
                // Logged for ops visibility only — swallowed so an SMTP outage
                // can't be used to probe which emails are registered.
                console.error("[user.controller] forgotPassword: failed to send reset email", emailError.message)
            }
        }

        return res.status(200).json(genericResponse)

    } catch (err) {
        console.error("[user.controller] forgotPassword error", err.message)
        return res.status(200).json(genericResponse)
    }
}

const verifyResetToken = async (req, res) => {

    const { token } = req.body

    if (!token) {
        return res.status(400).json({ message: "Reset token is required" })
    }

    try {
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

        const user = await usermodel.findOne({
            resetPasswordTokenHash: tokenHash,
            resetPasswordExpires: { $gt: new Date() }
        })

        if (!user) {
            return res.status(400).json({ message: "This reset link is invalid or has expired" })
        }

        return res.status(200).json({ message: "Token is valid" })

    } catch (err) {
        return res.status(500).json({ message: "Server error", error: err.message })
    }
}

const resetPassword = async (req, res) => {

    const { token, password, confirmPassword } = req.body

    if (!token || !password || !confirmPassword) {
        return res.status(400).json({ message: "Please fill all the fields" })
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" })
    }

    if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" })
    }

    try {
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

        const user = await usermodel.findOne({
            resetPasswordTokenHash: tokenHash,
            resetPasswordExpires: { $gt: new Date() }
        })

        if (!user) {
            return res.status(400).json({ message: "This reset link is invalid or has expired" })
        }

        const salt = await bcrypt.genSalt(10)
        user.password = await bcrypt.hash(password, salt)

        // Single-use: invalidate the token immediately so the same link
        // can't reset the password a second time.
        user.resetPasswordTokenHash = null
        user.resetPasswordExpires = null

        await user.save()

        return res.status(200).json({ message: "Password has been reset successfully" })

    } catch (err) {
        return res.status(500).json({ message: "Server error", error: err.message })
    }
}

module.exports = {
    register,
    login,
    logout,
    admin,
    forgotPassword,
    verifyResetToken,
    resetPassword
}