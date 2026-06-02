import { Bell, Search } from "lucide-react";

export default function Desktopnav() {
  return (
    <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between">
      {/* Search */}
      <div className="relative w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          type="text"
          placeholder="Search customers, invoices, offers..."
          className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
        />
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-4">
        <button className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 transition hover:bg-slate-100">
          <Bell className="h-4 w-4" />
        </button>

        <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-sm font-semibold text-white">
          A
        </div>
      </div>
    </header>
  );
}