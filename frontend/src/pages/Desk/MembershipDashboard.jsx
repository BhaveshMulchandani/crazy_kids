import * as React from "react";
import { ChevronLeft, ChevronRight, Search, IdCard, ArrowUpDown } from "lucide-react";
import axios from "axios";
import { getDisplayName } from "../../utils/customerDisplay";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const Input = React.forwardRef(
  ({ className, type = "text", ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "active", label: "Active" },
  { key: "expiring_soon", label: "Expiring Soon" },
  { key: "expired", label: "Expired" },
];

const STATUS_BADGE = {
  active: "bg-green-500/15 text-green-700 dark:text-green-400",
  expiring_soon: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  expired: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

const STATUS_LABEL = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
};

const SORT_OPTIONS = [
  { key: "purchaseDate", label: "Purchase Date" },
  { key: "expiryDate", label: "Expiry Date" },
  { key: "remainingPlayHours", label: "Remaining Hours" },
  { key: "planName", label: "Plan" },
  { key: "parentName", label: "Parent/Guardian Name" },
];

function MembershipDashboardPage() {
  const API_BASE = import.meta.env.VITE_API_URL;
  const [q, setQ] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [sortBy, setSortBy] = React.useState("purchaseDate");
  const [sortDir, setSortDir] = React.useState("desc");
  const [memberships, setMemberships] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  // Debounce the search box so pagination + search don't fire a request per
  // keystroke — only the settled query reaches the server. A new search
  // always starts back at page 1.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  React.useEffect(() => {
    let cancelled = false;

    const fetchMemberships = async () => {
      try {
        setLoading(true);

        const res = await axios.get(`${API_BASE}/memberships/list`, {
          params: {
            page,
            limit: PAGE_SIZE,
            search: search || undefined,
            status: status || undefined,
            sortBy,
            sortDir,
          },
          withCredentials: true,
        });

        if (cancelled) return;
        setMemberships(res.data.memberships || []);
        setTotal(res.data.total ?? 0);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMemberships();
    return () => {
      cancelled = true;
    };
  }, [API_BASE, page, search, status, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto space-y-6 lg:space-y-8 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[clamp(1.5rem,1vw+1.1rem,1.875rem)] font-semibold">Membership Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {total} membership{total === 1 ? "" : "s"}
          </p>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search parent, mobile, plan, child…"
            className="pl-9 h-10"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key || "all"}
              type="button"
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors",
                status === tab.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-white text-foreground hover:bg-secondary/40",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground shrink-0">Sort by</label>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
          <button
            type="button"
            title={sortDir === "asc" ? "Ascending" : "Descending"}
            onClick={() => {
              setSortDir((d) => (d === "asc" ? "desc" : "asc"));
              setPage(1);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input shadow-sm hover:bg-accent"
          >
            <ArrowUpDown className={cn("h-3.5 w-3.5 transition-transform", sortDir === "asc" && "rotate-180")} />
          </button>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                <Th>Customer Name</Th>
                <Th>Parent/Guardian Name</Th>
                <Th>Mobile Number</Th>
                <Th onClick={() => toggleSort("planName")}>Membership Plan</Th>
                <Th onClick={() => toggleSort("purchaseDate")}>Purchase Date</Th>
                <Th onClick={() => toggleSort("expiryDate")}>Expiry Date</Th>
                <Th>Status</Th>
                <Th className="text-right" onClick={() => toggleSort("remainingPlayHours")}>Remaining Hrs</Th>
                <Th className="text-right">Used Hrs</Th>
                <Th className="text-right">Total Hrs</Th>
              </tr>
            </thead>
            <tbody>
              {memberships.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-muted-foreground">
                    <IdCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {loading ? "Loading memberships…" : "No memberships found."}
                  </td>
                </tr>
              ) : (
                memberships.map((m) => (
                  <tr
                    key={m._id}
                    className="border-t border-border hover:bg-secondary/40 transition"
                  >
                    <td className="px-5 py-3.5 font-medium">
                      {getDisplayName({ parentName: m.customer?.parentName, children: m.registeredChildren })}
                    </td>
                    <td className="px-5 py-3.5">{m.customer?.parentName || "-"}</td>
                    <td className="px-5 py-3.5">{m.customer?.mobileNumber || "-"}</td>
                    <td className="px-5 py-3.5">{m.planName}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {m.purchaseDate ? new Date(m.purchaseDate).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_BADGE[m.displayStatus])}>
                        {STATUS_LABEL[m.displayStatus] || m.displayStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium">{Number(m.remainingPlayHours ?? 0)}</td>
                    <td className="px-5 py-3.5 text-right">{Number(m.usedPlayHours ?? 0)}</td>
                    <td className="px-5 py-3.5 text-right">{Number(m.totalPlayHours ?? 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total} total
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "", onClick }) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "text-left px-5 py-3 font-medium text-xs uppercase tracking-wider",
        onClick && "cursor-pointer select-none hover:text-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

export default MembershipDashboardPage;
