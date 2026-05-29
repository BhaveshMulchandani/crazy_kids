export function StatCard({ label, value, hint, trend, icon: Icon, accent = "var(--primary)" }) {
  return (
    <div className="surface-card p-6 hover-lift relative overflow-hidden">
      <div
        className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div
          className="h-11 w-11 rounded-xl grid place-items-center text-white shadow-md"
          style={{ background: accent }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className={`mt-4 inline-flex items-center gap-1 text-xs font-medium ${trend.positive ? "text-success" : "text-destructive"}`}>
          <span>{trend.positive ? "▲" : "▼"}</span>
          {Math.abs(trend.value)}% vs last week
        </div>
      )}
    </div>
  );
}

export default StatCard;
