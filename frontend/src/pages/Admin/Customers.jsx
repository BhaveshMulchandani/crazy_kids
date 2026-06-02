import * as React from "react";
import { Award, Search, Users as UsersIcon } from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const Input = React.forwardRef(({ className, type = "text", ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

const MOCK_CUSTOMERS = [
  { id: "c1", customer_code: "C001", child_name: "Asha", parent_name: "Rita", mobile: "9800000001", visit_count: 5, reward_points: 30, total_spent: 1200, created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "c2", customer_code: "C002", child_name: "Rahul", parent_name: "Sunil", mobile: "9800000002", visit_count: 2, reward_points: 10, total_spent: 300, created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "c3", customer_code: "C003", child_name: "Isha", parent_name: "Amit", mobile: "9800000003", visit_count: 3, reward_points: 18, total_spent: 550, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
];

function CustomersPage() {
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return MOCK_CUSTOMERS;
    return MOCK_CUSTOMERS.filter((customer) =>
      customer.child_name.toLowerCase().includes(query) ||
      customer.parent_name.toLowerCase().includes(query) ||
      customer.mobile.includes(query) ||
      customer.customer_code.toLowerCase().includes(query),
    );
  }, [q]);

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Customers</h1>
          <p className="text-muted-foreground mt-1">{MOCK_CUSTOMERS.length} kids registered</p>
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
                <td colSpan={8} className="text-center py-12 text-muted-foreground">
                  <UsersIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No customers yet. Generate a bill to create one.
                </td>
              </tr>
            ) : (
              filtered.map((customer) => (
                <tr key={customer.id} className="border-t border-border hover:bg-secondary/40 transition">
                  <td className="px-5 py-3.5 font-mono text-xs text-primary">{customer.customer_code}</td>
                  <td className="px-5 py-3.5 font-medium">{customer.child_name}</td>
                  <td className="px-5 py-3.5">{customer.parent_name}</td>
                  <td className="px-5 py-3.5">{customer.mobile}</td>
                  <td className="px-5 py-3.5 text-right">{customer.visit_count}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                      <Award className="h-3 w-3" /> {customer.reward_points}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium">₹{Number(customer.total_spent).toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{new Date(customer.created_at).toLocaleDateString()}</td>
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
    <th className={cn("text-left px-5 py-3 font-medium text-xs uppercase tracking-wider", className)}>
      {children}
    </th>
  );
}

export default CustomersPage;
