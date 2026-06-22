import { useState } from "react";
// import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import axios from "axios"
import { useNavigate } from "react-router-dom";


export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault();

    const response = await axios.post(`${import.meta.env.VITE_API_URL}/users/register`,{email,password})

    if(response.status === 201){
      navigate("/")
    }

    setEmail("")
    setPassword("")
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

          {/* <p className="text-xs text-slate-400">
            © Crazy Kids
          </p> */}
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-10 shadow-xl shadow-slate-900/5">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold">Create an account</h2>

            <p className="mt-2 text-sm text-slate-500">Sign up for your console.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="test@example.com"
                className="flex h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
              />
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
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="flex h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            {/* Button */}
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 text-white font-medium transition hover:bg-slate-800"
            >
              Sign up
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center text-sm text-slate-500">
              <>
                Already have an account?{" "}
                <Link to="/"
                  className="font-medium text-slate-950 underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </>
          </div>
        </div>
      </div>
    </div>
  );
}