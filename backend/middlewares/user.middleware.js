const jwt = require('jsonwebtoken')
const usermodel = require('../models/user.model')

// Matches login's jwt.sign(..., { expiresIn: "1d" }) — the cookie's own
// lifetime must match the token's, otherwise the browser can (and does, in
// production) drop the cookie before the token itself has actually expired,
// silently logging someone out mid-session.
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

// One cookie per role instead of a single shared "token" cookie. Cookies are
// per-browser, not per-tab/person — on a shared front-desk kiosk, an admin
// logging in on one tab used to silently overwrite a desk session open in
// another tab (whoever logged in last "won"), which is what was surfacing as
// random 403 "forbidden" errors for the other person. Separate cookie names
// let an admin and a desk session coexist on the same browser.
const COOKIE_NAMES = { admin: "admin_token", desk: "desk_token" }

// Shared JWT-verify + user-lookup, parameterized by which role's cookie to
// read. Returns null (not found / no cookie) or throws (invalid/expired
// token) — never partially populates req.user.
const verifyCookie = async (req, cookieName) => {
    const token = req.cookies[cookieName]
    if (!token) return null

    const { id } = jwt.verify(token, process.env.JWT_SECRET)
    return usermodel.findById(id)
}

// Role-agnostic — accepts either an admin or a desk session. Only for routes
// that genuinely don't care which role is calling (offers list, price
// settings — read by both sections of the app). Every role-specific route
// uses isLoggedInAsAdmin/isLoggedInAsDesk below instead.
const isloggedin = async (req, res, nxt) => {
    let user = null

    try {
        user = (await verifyCookie(req, COOKIE_NAMES.admin)) || (await verifyCookie(req, COOKIE_NAMES.desk))
    } catch (error) {
        return res.status(401).json({ message: "please login first" })
    }

    if (!user) {
        return res.status(401).json({ msg: "Unauthorized" })
    }

    req.user = user
    nxt()
}

// Combines the old isloggedin+isadmin / isloggedin+isdesk pair into one
// middleware per role, so there's no ambiguity about which cookie a given
// route should trust (isloggedin alone can't know which role a route
// requires until the isadmin/isdesk check runs after it).
const makeRoleGuard = (role) => async (req, res, nxt) => {
    let user = null

    try {
        user = await verifyCookie(req, COOKIE_NAMES[role])
    } catch (error) {
        return res.status(401).json({ message: "please login first" })
    }

    if (!user) {
        return res.status(401).json({ message: "please login first" })
    }

    // Defense in depth only — a token stored under admin_token/desk_token
    // should already carry the matching role; this just guards against a
    // corrupted/forged cookie rather than trusting the cookie name alone.
    if (user.role !== role) {
        return res.status(403).json({ message: "forbidden" })
    }

    req.user = user
    nxt()
}

const isLoggedInAsAdmin = makeRoleGuard("admin")
const isLoggedInAsDesk = makeRoleGuard("desk")

module.exports = { isloggedin, isLoggedInAsAdmin, isLoggedInAsDesk, COOKIE_NAMES, TOKEN_TTL_MS }
