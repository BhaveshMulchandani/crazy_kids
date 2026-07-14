import { useEffect, useState } from "react";
import axios from "axios";
import { StatCard } from "../../components/stat-card";
import {
  Receipt,
  IndianRupee,
  Users,
  TrendingUp,
  Coffee,
  Timer,
  AlertTriangle,
} from "lucide-react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

function startOf(period) {
  const d = new Date();
  if (period === "day") d.setHours(0, 0, 0, 0);
  if (period === "week") d.setDate(d.getDate() - 7);
  if (period === "month") d.setDate(d.getDate() - 30);
  return d.toISOString();
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function makeMockStats() {
  const customers = [
    {
      id: 1,
      child_name: "Asha",
      parent_name: "Rita",
      customer_code: "C001",
      visit_count: 5,
      total_spent: 1200,
      reward_points: 30,
      created_at: isoDaysAgo(10),
    },
    {
      id: 2,
      child_name: "Rahul",
      parent_name: "Sunil",
      customer_code: "C002",
      visit_count: 2,
      total_spent: 300,
      reward_points: 10,
      created_at: isoDaysAgo(6),
    },
    {
      id: 3,
      child_name: "Mia",
      parent_name: "Kiran",
      customer_code: "C003",
      visit_count: 1,
      total_spent: 150,
      reward_points: 5,
      created_at: isoDaysAgo(2),
    },
  ];

  const offers = [
    { id: 1, name: "Welcome" },
    { id: 2, name: "Summer" },
  ];

  const bills = [
    {
      id: 11,
      total: 200,
      created_at: isoDaysAgo(0),
      offer_id: 1,
      customer_id: 1,
    },
    {
      id: 12,
      total: 150,
      created_at: isoDaysAgo(1),
      offer_id: 2,
      customer_id: 2,
    },
    { id: 13, total: 300, created_at: isoDaysAgo(3), customer_id: 1 },
    { id: 14, total: 120, created_at: isoDaysAgo(8), customer_id: 3 },
  ];

  const cafe = [
    { item_name: "Latte", quantity: 2, total: 200, created_at: isoDaysAgo(0) },
    { item_name: "Cookie", quantity: 3, total: 150, created_at: isoDaysAgo(2) },
    {
      item_name: "Hot Chocolate",
      quantity: 1,
      total: 120,
      created_at: isoDaysAgo(5),
    },
  ];

  const sessions = [
    {
      id: 1,
      status: "active",
      end_time: new Date(Date.now() + 20 * 60000).toISOString(),
      customer_id: 1,
      duration_minutes: 30,
      customer: { child_name: "Asha", customer_code: "C001" },
    },
  ];

  return { bills, customers, cafe, offers, sessions };
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [membershipAnalytics, setMembershipAnalytics] = useState(null);

  useEffect(() => {
    // load mock data and auto-refresh every 30s
    function load() {
      setIsLoading(true);
      const s = makeMockStats();
      setStats(s);
      setIsLoading(false);
    }
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const loadMembershipAnalytics = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/memberships/analytics`, { withCredentials: true });
        setMembershipAnalytics(response.data);
      } catch (error) {
        console.warn("Unable to load membership analytics", error);
      }
    };
    loadMembershipAnalytics();
    const id = setInterval(loadMembershipAnalytics, 30_000);
    return () => clearInterval(id);
  }, []);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (isLoading || !stats)
    return <div className="text-muted-foreground">Loading dashboard…</div>;

  const today = startOf("day"),
    week = startOf("week"),
    month = startOf("month");
  const totalRevenue = stats.bills.reduce(
    (s, b) => s + Number(b.total || 0),
    0,
  );
  const todaySales = stats.bills
    .filter((b) => b.created_at >= today)
    .reduce((s, b) => s + Number(b.total), 0);
  const weekSales = stats.bills
    .filter((b) => b.created_at >= week)
    .reduce((s, b) => s + Number(b.total), 0);
  const monthSales = stats.bills
    .filter((b) => b.created_at >= month)
    .reduce((s, b) => s + Number(b.total), 0);
  const cafeRevenue = stats.cafe.reduce((s, c) => s + Number(c.total || 0), 0);
  const cafeWeek = stats.cafe
    .filter((c) => c.created_at >= week)
    .reduce((s, c) => s + Number(c.total || 0), 0);
  const dailyCustomers = new Set(
    stats.bills.filter((b) => b.created_at >= today).map((b) => b.customer_id),
  ).size;
  const newCustomers = stats.customers.filter(
    (c) => c.created_at >= week,
  ).length;
  const repeat = stats.customers.filter((c) => (c.visit_count ?? 0) > 1).length;


  const activeSessions = stats.sessions.filter(
    (s) => s.status === "active" && new Date(s.end_time).getTime() > now,
  );
  const expiringSessions = activeSessions.filter(
    (s) => new Date(s.end_time).getTime() - now < 10 * 60_000,
  );

  const topCustomers = [...stats.customers]
    .sort((a, b) => Number(b.total_spent ?? 0) - Number(a.total_spent ?? 0))
    .slice(0, 5);

  const daily = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    daily[d.toISOString().slice(0, 10)] = 0;
  }
  stats.bills.forEach((b) => {
    const k = new Date(b.created_at).toISOString().slice(0, 10);
    if (k in daily) daily[k] += Number(b.total);
  });
  const lineData = Object.entries(daily).map(([d, v]) => ({
    date: d.slice(5),
    revenue: v,
  }));

  const offerMap = Object.fromEntries(stats.offers.map((o) => [o.id, o.name]));
  const offerCounts = {};
  stats.bills.forEach((b) => {
    if (b.offer_id) {
      const n = offerMap[b.offer_id] ?? "Other";
      offerCounts[n] = (offerCounts[n] ?? 0) + 1;
    }
  });
  const offerData = Object.entries(offerCounts).map(([name, value]) => ({
    name,
    value,
  }));

  const cafeMap = {};
  stats.cafe.forEach((c) => {
    cafeMap[c.item_name] = (cafeMap[c.item_name] ?? 0) + Number(c.quantity);
  });
  const cafeData = Object.entries(cafeMap)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 6);

  return (
    <div className="space-y-8 px-6 py-8">
      <div>
        <h1 className="text-3xl font-semibold">Welcome back, Admin</h1>
        <p className="text-muted-foreground mt-1">
          Live snapshot of your store. Auto-refreshing.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-5">
        <StatCard
          label="Total Revenue"
          value={`₹${totalRevenue.toLocaleString()}`}
          hint="All time"
          icon={IndianRupee}
          accent="var(--primary)"
        />
        <StatCard
          label="Today's Sales"
          value={`₹${todaySales.toLocaleString()}`}
          hint={`${dailyCustomers} customers today`}
          icon={TrendingUp}
          accent="oklch(0.78 0.17 75)"
        />
        <StatCard
          label="Active Sessions"
          value={activeSessions.length}
          hint={`${expiringSessions.length} expiring soon`}
          icon={Timer}
          accent="oklch(0.65 0.18 145)"
        />
        <StatCard
          label="Cafe Revenue"
          value={`₹${cafeRevenue.toLocaleString()}`}
          hint={`₹${cafeWeek.toLocaleString()} this week`}
          icon={Coffee}
          accent="oklch(0.62 0.23 25)"
        />
      </div>

      {membershipAnalytics && <>
        <div className="grid grid-cols-4 gap-5">
          <StatCard label="Memberships Sold" value={membershipAnalytics.totalSold} icon={Users} accent="oklch(0.58 0.21 260)" />
          <StatCard label="Active Memberships" value={membershipAnalytics.active} hint={`${membershipAnalytics.expired} expired`} icon={Timer} accent="oklch(0.65 0.18 145)" />
          <StatCard label="Membership Revenue" value={`₹${Number(membershipAnalytics.revenue).toLocaleString()}`} icon={IndianRupee} accent="oklch(0.78 0.17 75)" />
          <StatCard label="Hours Consumed" value={`${membershipAnalytics.hoursConsumed}h`} hint={`${membershipAnalytics.remainingHours}h remaining`} icon={TrendingUp} accent="oklch(0.62 0.23 25)" />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="surface-card p-5"><h3 className="font-semibold">Membership overview</h3><p className="mt-2 text-sm text-muted-foreground">Most popular plan: <span className="font-medium text-foreground">{membershipAnalytics.popularPlan?._id || "No sales yet"}</span></p><p className="mt-1 text-sm text-muted-foreground">{membershipAnalytics.expiringSoon.length} memberships expire within 7 days.</p></div>
          <div className="surface-card p-5"><h3 className="font-semibold">Recently purchased memberships</h3><div className="mt-2 space-y-1 text-sm">{membershipAnalytics.recent.slice(0, 3).map((item) => <div key={item._id} className="flex justify-between"><span>{item.customer?.parentName} · {item.planName}</span><span className="text-muted-foreground">{new Date(item.purchaseDate).toLocaleDateString()}</span></div>)}{membershipAnalytics.recent.length === 0 && <span className="text-muted-foreground">No memberships purchased yet.</span>}</div></div>
        </div>
      </>}

      <div className="grid grid-cols-4 gap-5">
        <StatCard
          label="This Week"
          value={`₹${weekSales.toLocaleString()}`}
          icon={IndianRupee}
          accent="oklch(0.58 0.21 260)"
        />
        <StatCard
          label="This Month"
          value={`₹${monthSales.toLocaleString()}`}
          icon={IndianRupee}
          accent="oklch(0.72 0.16 200)"
        />
        <StatCard
          label="Repeat Customers"
          value={repeat}
          hint={`${newCustomers} new this week`}
          icon={Users}
          accent="oklch(0.65 0.18 145)"
        />
        <StatCard
          label="Total Orders"
          value={stats.bills.length}
          icon={Receipt}
          accent="oklch(0.78 0.17 75)"
        />
      </div>

      {activeSessions.length > 0 && (
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Active sessions
            </h3>
            <span className="text-xs text-muted-foreground">
              {activeSessions.length} running
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {activeSessions.slice(0, 8).map((s) => {
              const remaining = Math.max(
                0,
                new Date(s.end_time).getTime() - now,
              );
              const m = Math.floor(remaining / 60_000),
                sec = Math.floor((remaining % 60_000) / 1000);
              const exp = remaining < 10 * 60_000;
              return (
                <div
                  key={s.id}
                  className={[
                    "rounded-xl border p-3",
                    exp
                      ? "border-amber-400/60 bg-amber-50/40 dark:bg-amber-500/10"
                      : "bg-secondary/40",
                  ].join(" ")}
                >
                  <div className="text-xs text-muted-foreground">
                    {s.customer?.customer_code}
                  </div>
                  <div className="font-semibold text-sm truncate">
                    {s.customer?.child_name}
                  </div>
                  <div className="mt-1 flex items-center gap-1 font-mono text-lg tabular-nums">
                    {exp && (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    {String(m).padStart(2, "0")}:{String(sec).padStart(2, "0")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 surface-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold">Revenue trend</h3>
              <p className="text-xs text-muted-foreground">Last 14 days</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(0,0,0,0.06)"
                />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-6">
          <h3 className="font-semibold">Most used offers</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribution</p>
          <div className="h-72">
            {offerData.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                No offer usage yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={offerData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {offerData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 surface-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Coffee className="h-4 w-4 text-primary" /> Best selling cafe
                items
              </h3>
              <p className="text-xs text-muted-foreground">By quantity sold</p>
            </div>
          </div>
          <div className="h-64">
            {cafeData.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                No cafe orders yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cafeData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(0,0,0,0.06)"
                  />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <Bar dataKey="qty" radius={[8, 8, 0, 0]} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="surface-card p-6">
          <h3 className="font-semibold mb-4">Top customers</h3>
          <div className="space-y-2">
            {topCustomers.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No customers yet.
              </div>
            )}
            {topCustomers.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/60"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-7 w-7 rounded-full grid place-items-center text-xs font-semibold"
                    style={{
                      background:
                        i === 0 ? "var(--gradient-primary)" : "oklch(0.92 0 0)",
                      color: i === 0 ? "white" : "var(--foreground)",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {c.child_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.visit_count ?? 0} visits · {c.reward_points ?? 0} pts
                    </div>
                  </div>
                </div>
                <div className="text-sm font-semibold">
                  ₹{Number(c.total_spent ?? 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <h3 className="font-semibold mt-6 mb-4">Recent transactions</h3>
          <div className="space-y-1 max-h-48 overflow-auto">
            {stats.bills.slice(0, 6).map((b) => {
              const cust = stats.customers.find((c) => c.id === b.customer_id);
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/60"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {cust?.child_name ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {cust?.customer_code}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">
                    ₹{Number(b.total).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
