import { useEffect, useState } from "react";
import axios from "axios";
import { StatCard } from "../../components/stat-card";
import { getDisplayName } from "../../utils/customerDisplay";
import {
  Receipt,
  IndianRupee,
  Users,
  TrendingUp,
  Coffee,
  Timer,
  AlertTriangle,
  Tag,
  Percent,
  CalendarCheck,
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

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [membershipAnalytics, setMembershipAnalytics] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/admin/dashboard`,
          { withCredentials: true },
        );
        if (!cancelled) setStats(response.data);
      } catch (error) {
        console.warn("Unable to load dashboard stats", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
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

  const totalRevenue = Number(stats.totals?.totalRevenue || 0);
  const todaySales = Number(stats.today?.sales || 0);
  const dailyCustomers = Number(stats.today?.customers || 0);
  const weekSales = Number(stats.week?.sales || 0);
  const monthSales = Number(stats.month?.sales || 0);
  const cafeRevenue = Number(stats.totals?.cafeRevenue || 0);
  const cafeWeek = Number(stats.week?.cafeSales || 0);
  const totalOrders = Number(stats.totals?.totalOrders || 0);
  const repeat = Number(stats.repeatCustomers || 0);
  const newCustomers = Number(stats.newCustomersThisWeek || 0);

  const activeSessions = stats.activeSessions || [];
  const expiringSessions = activeSessions.filter(
    (s) => new Date(s.scheduledEndTime).getTime() - now < 10 * 60_000,
  );

  const topCustomers = stats.topCustomers || [];

  const lineData = (stats.revenueTrend || []).map((r) => ({
    date: r.date.slice(5),
    revenue: r.revenue,
  }));

  const offerData = (stats.offerUsage || []).map((o) => ({
    name: o._id,
    value: o.value,
  }));

  const cafeData = (stats.bestSellingCafeItems || []).map((c) => ({
    name: c._id,
    qty: c.qty,
  }));

  const areaRevenueData = (stats.revenueByArea || []).map((a) => ({
    name: a.area,
    revenue: a.revenue,
    customerCount: a.customerCount || 0,
  }));

  const recentTransactions = stats.recentTransactions || [];

  return (
    <div className="w-full max-w-[1920px] mx-auto space-y-6 lg:space-y-8 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div>
        <h1 className="text-[clamp(1.5rem,1vw+1.1rem,1.875rem)] font-semibold">Welcome back, Admin</h1>
        <p className="text-muted-foreground mt-1">
          Live snapshot of your store. Auto-refreshing.
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 lg:gap-5">
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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 lg:gap-5">
          <StatCard label="Memberships Sold" value={membershipAnalytics.totalSold} icon={Users} accent="oklch(0.58 0.21 260)" />
          <StatCard label="Memberships Sold in Last 30 Days" value={membershipAnalytics.soldLast30Days} hint="Rolling 30-day count" icon={CalendarCheck} accent="oklch(0.72 0.16 200)" />
          <StatCard label="Active Memberships" value={membershipAnalytics.active} hint={`${membershipAnalytics.expired} expired`} icon={Timer} accent="oklch(0.65 0.18 145)" />
          <StatCard label="Membership Revenue" value={`₹${Number(membershipAnalytics.revenue).toLocaleString()}`} icon={IndianRupee} accent="oklch(0.78 0.17 75)" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
          <div className="surface-card p-5 min-w-0"><h3 className="font-semibold">Membership overview</h3><p className="mt-2 text-sm text-muted-foreground">Most popular plan: <span className="font-medium text-foreground">{membershipAnalytics.popularPlan?._id || "No sales yet"}</span></p></div>
          <div className="surface-card p-5 min-w-0"><h3 className="font-semibold">Recently purchased memberships</h3><div className="mt-2 space-y-1 text-sm">{membershipAnalytics.recent.slice(0, 3).map((item) => <div key={item._id} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5"><span className="min-w-0 truncate">{getDisplayName({ parentName: item.customer?.parentName, children: item.registeredChildren })} · {item.planName}</span><span className="text-muted-foreground shrink-0">{new Date(item.purchaseDate).toLocaleDateString()}</span></div>)}{membershipAnalytics.recent.length === 0 && <span className="text-muted-foreground">No memberships purchased yet.</span>}</div></div>
        </div>
      </>}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 lg:gap-5">
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
          value={totalOrders}
          icon={Receipt}
          accent="oklch(0.78 0.17 75)"
        />
      </div>

      {stats.offerAnalytics && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 lg:gap-5">
          <StatCard
            label="Most Used Offer"
            value={stats.offerAnalytics.mostUsedOffer || "—"}
            hint={
              stats.offerAnalytics.mostUsedOffer
                ? `${stats.offerAnalytics.mostUsedOfferCount} times used`
                : "No offers used yet"
            }
            icon={Tag}
            accent="oklch(0.58 0.21 260)"
          />
          <StatCard
            label="Offer Usage Count"
            value={stats.offerAnalytics.usageCount}
            hint="Invoices with an offer applied"
            icon={Percent}
            accent="oklch(0.65 0.18 145)"
          />
          <StatCard
            label="Total Discount Given"
            value={`₹${Number(stats.offerAnalytics.totalDiscountGiven).toLocaleString()}`}
            icon={IndianRupee}
            accent="oklch(0.62 0.23 25)"
          />
        </div>
      )}

      {activeSessions.length > 0 && (
        <div className="surface-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Active sessions
            </h3>
            <span className="text-xs text-muted-foreground">
              {activeSessions.length} running
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
            {activeSessions.slice(0, 8).map((s) => {
              const remaining = Math.max(
                0,
                new Date(s.scheduledEndTime).getTime() - now,
              );
              const m = Math.floor(remaining / 60_000),
                sec = Math.floor((remaining % 60_000) / 1000);
              const exp = remaining < 10 * 60_000;
              return (
                <div
                  key={String(s._id)}
                  className={[
                    "rounded-xl border p-3 min-w-0",
                    exp
                      ? "border-amber-400/60 bg-amber-50/40 dark:bg-amber-500/10"
                      : "bg-secondary/40",
                  ].join(" ")}
                >
                  <div className="text-xs text-muted-foreground">
                    {s.bandNumber || s.sessionNumber}
                  </div>
                  <div className="font-semibold text-sm truncate">
                    {getDisplayName(s)}
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-5">
        <div className="xl:col-span-2 surface-card p-4 sm:p-6 min-w-0">
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

        <div className="surface-card p-4 sm:p-6 min-w-0">
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-5">
        <div className="xl:col-span-2 surface-card p-4 sm:p-6 min-w-0">
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

        <div className="surface-card p-4 sm:p-6 min-w-0">
          <h3 className="font-semibold mb-4">Top customers</h3>
          <div className="space-y-2">
            {topCustomers.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No customers yet.
              </div>
            )}
            {topCustomers.map((c, i) => (
              <div
                key={c._id}
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
                      {getDisplayName(c)}
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
            {recentTransactions.map((b) => (
              <div
                key={b.invoiceNumber || String(b._id)}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/60"
              >
                <div>
                  <div className="text-sm font-medium">
                    {getDisplayName({ parentName: b.customer?.parentName, children: b.children })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {b.customer?.bandNumber || b.customer?.sessionNumber}
                  </div>
                </div>
                <div className="text-sm font-semibold">
                  ₹{Number(b.charges?.grandTotal ?? 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="surface-card p-4 sm:p-6 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold">Revenue by area</h3>
            <p className="text-xs text-muted-foreground">All-time revenue and customers per play area</p>
          </div>
        </div>
        <div className="h-72">
          {areaRevenueData.length === 0 ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">
              No revenue recorded yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={areaRevenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis yAxisId="revenue" stroke="#94a3b8" fontSize={12} />
                <YAxis yAxisId="customers" orientation="right" stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                <Tooltip
                  formatter={(value, name) =>
                    name === "Revenue"
                      ? [`₹${Number(value).toLocaleString()}`, "Revenue"]
                      : [Number(value).toLocaleString(), "Customers"]
                  }
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="revenue" dataKey="revenue" name="Revenue" radius={[8, 8, 0, 0]} fill="#3b82f6" />
                <Bar yAxisId="customers" dataKey="customerCount" name="Customers" radius={[8, 8, 0, 0]} fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
