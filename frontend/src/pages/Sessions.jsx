import * as React from "react";
import { AlertTriangle, CheckCircle2, PlayCircle, Timer } from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const buttonVariantClasses = {
  default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
  outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
};

const buttonSizeClasses = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
};

const Button = React.forwardRef(({ className, variant = "default", size = "default", type = "button", ...props }, ref) => (
  <button
    type={type}
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
      buttonVariantClasses[variant],
      buttonSizeClasses[size],
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";

const Progress = ({ value, className }) => (
  <div className={cn("rounded-full bg-muted/40 overflow-hidden", className)}>
    <div
      className="h-2 rounded-full bg-primary transition-all"
      style={{ width: `${Math.max(0, Math.min(100, Number(value)))}%` }}
    />
  </div>
);

const MOCK_SESSIONS = [
  {
    id: "s1",
    status: "active",
    duration_minutes: 60,
    start_time: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
    amount: 300,
    customer: {
      child_name: "Asha",
      parent_name: "Rita",
      mobile: "9800000001",
      customer_code: "C001",
    },
  },
  {
    id: "s2",
    status: "completed",
    duration_minutes: 45,
    start_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() - 1.25 * 60 * 60 * 1000).toISOString(),
    amount: 225,
    customer: {
      child_name: "Rahul",
      parent_name: "Sunil",
      mobile: "9800000002",
      customer_code: "C002",
    },
  },
  {
    id: "s3",
    status: "expired",
    duration_minutes: 30,
    start_time: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    amount: 150,
    customer: {
      child_name: "Isha",
      parent_name: "Amit",
      mobile: "9800000010",
      customer_code: "C003",
    },
  },
];

function formatCountdown(endTime, now) {
  const remaining = Math.max(0, new Date(endTime).getTime() - now);
  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function StatusBadge({ status }) {
  const map = {
    active: { label: "Active", cls: "bg-green-500/15 text-green-700", icon: PlayCircle },
    completed: { label: "Completed", cls: "bg-blue-500/15 text-blue-700", icon: CheckCircle2 },
    expired: { label: "Expired", cls: "bg-amber-500/15 text-amber-700", icon: AlertTriangle },
  };
  const info = map[status] ?? map.expired;
  const Icon = info.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", info.cls)}>
      <Icon className="h-3 w-3" /> {info.label}
    </span>
  );
}

function SessionCard({ session, now, onComplete }) {
  const total = session.duration_minutes * 60_000;
  const elapsed = now - new Date(session.start_time).getTime();
  const remaining = Math.max(0, new Date(session.end_time).getTime() - now);
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const expiring = remaining < 5 * 60_000;

  return (
    <div className={cn("surface-card p-5 transition-all", expiring ? "ring-2 ring-amber-400/60" : "")}> 
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{session.customer?.customer_code}</div>
          <div className="font-semibold text-lg leading-tight">{session.customer?.child_name}</div>
          <div className="text-xs text-muted-foreground">{session.customer?.mobile}</div>
        </div>
        {expiring ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <Timer className="h-5 w-5 text-primary" />}
      </div>

      <div className="mt-4 font-mono text-4xl font-semibold tabular-nums gradient-text">
        {formatCountdown(session.end_time, now)}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        of {session.duration_minutes} min · ends {new Date(session.end_time).toLocaleTimeString()}
      </div>
      <Progress value={pct} className="mt-4 h-2" />
      <Button size="sm" variant="outline" className="mt-4 w-full" onClick={onComplete}>
        <CheckCircle2 className="h-4 w-4 mr-2" /> Mark complete
      </Button>
    </div>
  );
}

function Sessions() {
  const [sessions, setSessions] = React.useState(MOCK_SESSIONS);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const complete = (id) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === id ? { ...session, status: "completed", end_time: new Date().toISOString() } : session,
      ),
    );
  };

  const derivedSessions = sessions.map((session) => {
    if (session.status !== "active") return session;
    return new Date(session.end_time).getTime() < now ? { ...session, status: "expired" } : session;
  });

  const active = derivedSessions.filter((session) => session.status === "active");
  const others = derivedSessions.filter((session) => session.status !== "active");

  return (
    <div className="space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-semibold">Sessions</h1>
        <p className="text-muted-foreground mt-1">Live timers for every active play session.</p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <h2 className="font-semibold">
            Active sessions <span className="text-muted-foreground font-normal">({active.length})</span>
          </h2>
        </div>
        {active.length === 0 ? (
          <div className="surface-card p-10 text-center text-muted-foreground">No active sessions right now.</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {active.map((session) => (
              <SessionCard key={session.id} session={session} now={now} onComplete={() => complete(session.id)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">Recent</h2>
        <div className="surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                <th className="text-left px-4 py-2.5 font-medium">Duration</th>
                <th className="text-left px-4 py-2.5 font-medium">Started</th>
                <th className="text-left px-4 py-2.5 font-medium">Ended</th>
                <th className="text-left px-4 py-2.5 font-medium">Amount</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {others.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No past sessions yet.
                  </td>
                </tr>
              )}
              {others.map((session) => (
                <tr key={session.id} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{session.customer?.child_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{session.customer?.customer_code}</div>
                  </td>
                  <td className="px-4 py-2.5">{session.duration_minutes} min</td>
                  <td className="px-4 py-2.5">{new Date(session.start_time).toLocaleString()}</td>
                  <td className="px-4 py-2.5">{new Date(session.end_time).toLocaleString()}</td>
                  <td className="px-4 py-2.5">₹{Number(session.amount).toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={session.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default Sessions;
