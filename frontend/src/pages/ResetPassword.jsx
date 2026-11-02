import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [checkingToken, setCheckingToken] = useState(!!token);
  const [tokenValid, setTokenValid] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const verify = async () => {
      try {
        await axios.post(`${import.meta.env.VITE_API_URL}/users/verify-reset-token`, {
          token,
        });
        if (!cancelled) setTokenValid(true);
      } catch {
        if (!cancelled) setTokenValid(false);
      } finally {
        if (!cancelled) setCheckingToken(false);
      }
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};

    if (!password) {
      nextErrors.password = "This field is required";
    } else if (password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters";
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "This field is required";
    } else if (password && confirmPassword !== password) {
      nextErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/users/reset-password`, {
        token,
        password,
        confirmPassword,
      });

      setSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (error) {
      setErrors({
        form: error.response?.data?.message || "Something went wrong. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  let content;

  if (checkingToken) {
    content = <p className="text-sm text-slate-500">Checking your reset link…</p>;
  } else if (!tokenValid) {
    content = (
      <div className="space-y-6">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          This reset link is invalid or has expired. Please request a new one.
        </div>

        <Link
          to="/forgot-password"
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 text-white font-medium transition hover:bg-slate-800"
        >
          Request a new link
        </Link>
      </div>
    );
  } else if (success) {
    content = (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        Password reset successfully. Redirecting you to login…
      </div>
    );
  } else {
    content = (
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {errors.form && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
            {errors.form}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            New password
          </label>

          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              autoFocus
              minLength={6}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((prev) => ({ ...prev, password: "", form: "" }));
              }}
              placeholder="••••••••"
              className={`flex h-11 w-full rounded-xl border bg-white px-4 pr-16 text-sm outline-none transition focus:ring-2 ${
                errors.password
                  ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                  : "border-slate-300 focus:border-slate-950 focus:ring-slate-200"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center px-4 text-xs font-medium text-slate-500 hover:text-slate-950"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
            Confirm password
          </label>

          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            name="confirmPassword"
            autoComplete="new-password"
            minLength={6}
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setErrors((prev) => ({ ...prev, confirmPassword: "", form: "" }));
            }}
            placeholder="••••••••"
            className={`flex h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none transition focus:ring-2 ${
              errors.confirmPassword
                ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                : "border-slate-300 focus:border-slate-950 focus:ring-slate-200"
            }`}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-red-500">{errors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 text-white font-medium transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Resetting…" : "Reset password"}
        </button>
      </form>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-10 shadow-xl shadow-slate-900/5">
        <div className="mb-8">
          <h2 className="text-3xl font-semibold">Reset password</h2>
          <p className="mt-2 text-sm text-slate-500">
            Choose a new password for your account.
          </p>
        </div>

        {content}
      </div>
    </div>
  );
}
