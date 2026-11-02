import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("This field is required");
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/users/forgot-password`, {
        email: trimmedEmail,
      });

      // Backend always returns a generic success response, whether or not
      // the email is registered — never reveal account existence here.
      setSent(true);
    } catch (error) {
      setError(
        error.response?.data?.message || "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-10 shadow-xl shadow-slate-900/5">
        <div className="mb-8">
          <h2 className="text-3xl font-semibold">Forgot password</h2>
          <p className="mt-2 text-sm text-slate-500">
            Enter your registered email and we'll send you a link to reset
            your password.
          </p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              If that email is registered, a password reset link has been
              sent. Please check your inbox.
            </div>

            <Link
              to="/"
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 text-white font-medium transition hover:bg-slate-800"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-700"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                placeholder="test@example.com"
                className={`flex h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none transition focus:ring-2 ${
                  error
                    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                    : "border-slate-300 focus:border-slate-950 focus:ring-slate-200"
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 text-white font-medium transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </button>

            <div className="text-center text-sm text-slate-500">
              <Link
                to="/"
                className="font-medium text-slate-950 underline-offset-4 hover:underline"
              >
                Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
