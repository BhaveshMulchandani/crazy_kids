import * as React from "react";
import { Award, ChevronLeft, ChevronRight, Search, Users as UsersIcon } from "lucide-react";
import axios from "axios";

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

function CustomersPage() {
  const API_BASE = import.meta.env.VITE_API_URL;
  const [q, setQ] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [customers, setCustomers] = React.useState([]);
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

    const fetchCustomers = async () => {
      try {
        setLoading(true);

        const res = await axios.get(`${API_BASE}/admin/customers`, {
          params: { page, limit: PAGE_SIZE, search: search || undefined },
          withCredentials: true,
        });

        if (cancelled) return;
        setCustomers(res.data.customers || []);
        setTotal(res.data.total ?? res.data.count ?? 0);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCustomers();
    return () => {
      cancelled = true;
    };
  }, [API_BASE, page, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Customers</h1>
          <p className="text-muted-foreground mt-1">
            {total} registered {total === 1 ? "user" : "users"}
          </p>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search child, parent, mobile, ID…"
            className="pl-9 h-10"
          />
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <Th>Customer ID</Th>
              <Th>Child</Th>
              <Th>Parent</Th>
              <Th>Mobile</Th>
              <Th className="text-right">Visits</Th>
              <Th className="text-right">Points</Th>
              <Th className="text-right">Total Spent</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="text-center py-12 text-muted-foreground"
                >
                  <UsersIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  {loading
                    ? "Loading customers…"
                    : "No customers yet. Generate a bill to create one."}
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-t border-border hover:bg-secondary/40 transition"
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-primary">
                    {customer.sessionNumber}
                  </td>
                  <td className="px-5 py-3.5 font-medium">
                    {customer.children?.length
                      ? customer.children.map((child) => child.name).join(", ")
                      : "-"}
                  </td>
                  <td className="px-5 py-3.5">{customer.parentName}</td>
                  <td className="px-5 py-3.5">{customer.mobileNumber}</td>
                  <td className="px-5 py-3.5 text-right">
                    {customer.visit_count}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                      <Award className="h-3 w-3" /> {customer.reward_points}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium">
                    ₹{Number(customer.total_spent).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between px-1">
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

function Th({ children, className = "" }) {
  return (
    <th
      className={cn(
        "text-left px-5 py-3 font-medium text-xs uppercase tracking-wider",
        className,
      )}
    >
      {children}
    </th>
  );
}

export default CustomersPage;
