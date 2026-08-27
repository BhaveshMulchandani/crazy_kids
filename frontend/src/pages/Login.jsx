import { useState } from "react";
// import { Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      nextErrors.email = "This field is required";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      nextErrors.password = "This field is required";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/users/login`,
        { email: trimmedEmail, password },
        { withCredentials: true },
      );

      localStorage.setItem("user", JSON.stringify(response.data.user));

      if (response.data.user.role === "desk") {
        navigate("/desk/billing");
      } else if (response.data.user.role === "admin") {
        navigate("/admin/dashboard");
      }
    } catch (error) {
      const status = error.response?.status;
      setErrors({
        form:
          status === 400 || status === 401
            ? "Incorrect email or password"
            : error.response?.data?.message || "Something went wrong. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Left Side */}
      <div className="relative flex items-center justify-center bg-slate-950 text-white px-8 py-12">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 opacity-90" />

        <div className="relative z-10 flex h-full w-full flex-col justify-between gap-10">
          {/* <div>
            <div className="inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold shadow-lg shadow-slate-950/20 backdrop-blur-md">
              <Sparkles className="h-5 w-5" />
              Crazy Kids
            </div>
          </div> */}

          <div className="space-y-6">
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              Billing built for
              <br />
              kids activity stores.
            </h1>

            <p className="max-w-xl text-slate-300">
              Manage entries, cafe orders, offers and loyalty points in one
              premium dashboard. Fast workflow for billing operators.
            </p>

            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
              {[
                "Billing",
                "Cafe Counter",
                "Loyalty",
                "Offers",
                "Analytics",
                "Customers",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-center"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* <p className="text-xs text-slate-400">© Crazy Kids</p> */}
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-10 shadow-xl shadow-slate-900/5">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold">Desk login</h2>

            <p className="mt-2 text-sm text-slate-500">
              Sign in to your console.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {errors.form && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                {errors.form}
              </div>
            )}

            {/* Email */}
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
                  setErrors((prev) => ({ ...prev, email: "", form: "" }));
                }}
                placeholder="test@example.com"
                className={`flex h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none transition focus:ring-2 ${
                  errors.email
                    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                    : "border-slate-300 focus:border-slate-950 focus:ring-slate-200"
                }`}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-slate-700"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                minLength={6}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrors((prev) => ({ ...prev, password: "", form: "" }));
                }}
                placeholder="••••••••"
                className={`flex h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none transition focus:ring-2 ${
                  errors.password
                    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                    : "border-slate-300 focus:border-slate-950 focus:ring-slate-200"
                }`}
              />
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            {/* Button */}
            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 text-white font-medium transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Toggle */}
          {/* <div className="mt-6 text-center text-sm text-slate-500">
            <>
              No account yet?{" "}
              <Link
                to="/signup"
                className="font-medium text-slate-950 underline-offset-4 hover:underline"
              >
                Create one
              </Link>
            </>
          </div> */}
        </div>
      </div>
    </div>
  );
}
