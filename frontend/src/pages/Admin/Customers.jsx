import * as React from "react";
import { Award, Search, Users as UsersIcon } from "lucide-react";
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

function CustomersPage() {
  const API_BASE = import.meta.env.VITE_API_URL;
  const [q, setQ] = React.useState("");
  const [customers, setCustomers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const fetchCustomers = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${API_BASE}/admin/customers`, {
        withCredentials: true,
      });

      setCustomers(res.data.customers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchCustomers();
  }, []);

  const filtered = React.useMemo(() => {
  const query = q.trim().toLowerCase();

  if (!query) return customers;

  return customers.filter((customer) => {
    const childNames = customer.children
      ?.map((child) => child.name.toLowerCase())
      .join(" ") || "";

    return (
      childNames.includes(query) ||
      customer.parentName?.toLowerCase().includes(query) ||
      customer.mobileNumber?.includes(query) ||
      customer.sessionNumber?.toLowerCase().includes(query)
    );
  });
}, [q, customers]);

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Customers</h1>
          <p className="text-muted-foreground mt-1">
            {customers.length} registered users
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
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="text-center py-12 text-muted-foreground"
                >
                  <UsersIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No customers yet. Generate a bill to create one.
                </td>
              </tr>
            ) : (
              filtered.map((customer) => (
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
