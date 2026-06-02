import {
  LayoutDashboard,
  Receipt,
  Coffee,
  Users,
  Tag,
  Timer,
  MessageCircle,
  Settings,
  UtensilsCrossed,
  Sparkles,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Billing", icon: Receipt, path: "/billing" },
  { label: "Sessions", icon: Timer, path: "/sessions" },
  { label: "Cafe POS", icon: Coffee, path: "/cafepos" },
  { label: "Cafe Menu", icon: UtensilsCrossed, path: "/cafemenu" },
  { label: "Customers", icon: Users, path: "/customers" },
  { label: "Offers", icon: Tag, path: "/offers" },
  { label: "WhatsApp", icon: MessageCircle, path: "/whatsapp" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export default function Desksidenav() {
  return (
    <aside className="w-64 min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6 flex items-center gap-3 border-b border-white/10">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
          <Sparkles className="h-5 w-5" />
        </div>

        <div>
          <h2 className="font-semibold tracking-tight">Crazy Kids</h2>

          <p className="text-xs text-white/50">Desk Suite</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.label}
              to={item.path}
              className={({ isActive }) =>
                `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition
          ${
            isActive
              ? "bg-white/15 text-white"
              : "text-white/70 hover:bg-white/10 hover:text-white"
          }`
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom User */}
      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-xs text-white/50">Signed in as</p>

          <p className="truncate text-sm font-medium">admin@example.com</p>

          <button className="mt-3 w-full rounded-lg bg-white/10 px-3 py-2 text-sm transition hover:bg-white/20">
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
