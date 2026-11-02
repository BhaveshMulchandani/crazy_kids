// Thin Nodemailer wrapper for transactional emails (currently just password
// reset). Follows the same readConfig()-and-throw-with-statusCode shape as
// whatsapp.service.js so missing SMTP config fails the same way missing
// WhatsApp config does.

const nodemailer = require("nodemailer");

const readConfig = () => ({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM,
});

let cachedTransporter = null;

// Cached across calls — building a transporter per email would reopen/verify
// the SMTP connection pool every send for no benefit.
const getTransporter = () => {
  const { host, port, user, pass } = readConfig();

  if (!host || !port || !user || !pass) {
    const error = new Error("Email sending is not configured on the server.");
    error.statusCode = 500;
    throw error;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    });
  }

  return cachedTransporter;
};

const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  const { from, user } = readConfig();
  const transporter = getTransporter();

  await transporter.sendMail({
    from: from || user,
    to,
    subject: "Reset your Crazy Kids password",
    html: `
      <p>We received a request to reset your Crazy Kids account password.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
    `,
  });
};

module.exports = { sendPasswordResetEmail };
