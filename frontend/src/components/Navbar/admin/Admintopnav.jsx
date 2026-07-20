import { Bell, Search } from "lucide-react";

export default function Admintopnav() {
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Search */}
      <div className="relative w-full max-w-md min-w-0 flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          type="text"
          placeholder="Search customers, invoices, offers..."
          className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
        />
      </div>

      {/* Right Side */}
      <div className="flex shrink-0 items-center gap-4">
        <button className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 transition hover:bg-slate-100">
          <Bell className="h-4 w-4" />
        </button>

        <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-sm font-semibold text-white">
          {user?.email?.charAt(0)?.toUpperCase() || "A"}
        </div>
      </div>
    </header>
  );
}