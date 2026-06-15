import React, { useEffect, useState, useRef, useCallback, useContext } from "react";
import { toast } from "sonner";
import {
  Timer,
  Pause,
  Play,
  CheckCircle2,
  Receipt,
  Coffee,
  Printer,
  Baby,
  PlayCircle,
  Clock,
  ChevronDown,
} from "lucide-react";

import axios from "axios"

// Helper functions
const elapsedSeconds = (bill) => {
  if (!bill.startTime) return 0;
  const start = new Date(bill.startTime);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / 1000));
};

const formatHMS = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// UI Components
const Button = ({ className, variant = "default", size = "default", type = "button", children, ...props }) => {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
    destructive:
      "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
    outline:
      "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
    secondary:
      "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  };

  const sizes = {
    default: "h-9 px-4 py-2",
    sm: "h-8 rounded-md px-3 text-xs",
    lg: "h-10 rounded-md px-8",
    icon: "h-9 w-9",
  };

  return (
    <button
      type={type}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className || ""}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ className, type = "text", ...props }) => (
  <input
    type={type}
    className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ${className || ""}`}
    {...props}
  />
);

const Label = ({ className, children, ...props }) => (
  <label
    className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className || ""}`}
    {...props}
  >
    {children}
  </label>
);

const SelectContext = React.createContext(null);

const Select = ({
  value,
  onValueChange,
  children,
  disabled,
  className,
  ...props
}) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState({});
  const rootRef = useRef(null);

  const registerItem = useCallback((itemValue, label) => {
    setItems((prev) =>
      prev[itemValue] === label ? prev : { ...prev, [itemValue]: label }
    );
  }, []);

  const valueLabel = value != null ? items[value] ?? value : "";

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange,
        open,
        setOpen,
        registerItem,
        valueLabel,
        disabled,
      }}
    >
      <div
        ref={rootRef}
        className={`relative inline-flex w-full ${className || ""}`}
        {...props}
      >
        {children}
      </div>
    </SelectContext.Provider>
  );
};

const SelectTrigger = ({ className, children, ...props }) => {
  const ctx = useContext(SelectContext);
  return (
    <button
      type="button"
      disabled={ctx?.disabled}
      onClick={() => ctx?.setOpen?.((prev) => !prev)}
      className={`flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 ${className || ""}`}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
};

const SelectValue = ({ placeholder }) => {
  const ctx = useContext(SelectContext);
  return <span>{ctx?.value ? ctx.valueLabel : placeholder}</span>;
};

const SelectContent = ({
  className,
  children,
  position = "popper",
  ...props
}) => {
  const ctx = useContext(SelectContext);
  if (!ctx?.open) return null;
  return (
    <div
      className={`absolute left-0 top-full z-20 mt-2 min-w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md ${className || ""}`}
      {...props}
    >
      <div className={position === "popper" ? "w-full p-1" : "p-1"}>
        {children}
      </div>
    </div>
  );
};

const SelectItem = ({ className, children, value, ...props }) => {
  const ctx = useContext(SelectContext);
  const label = typeof children === "string" ? children : "";

  useEffect(() => {
    ctx?.registerItem?.(value, label);
  }, [ctx, value, label]);

  const active = ctx?.value === value;

  return (
    <button
      type="button"
      className={`flex w-full cursor-default select-none items-center justify-between rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none transition-colors ${
        active
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent hover:text-accent-foreground"
      } ${className || ""}`}
      onClick={() => {
        ctx?.onValueChange?.(value);
        ctx?.setOpen?.(false);
      }}
      {...props}
    >
      <span>{children}</span>
      {active && (
        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
          <CheckCircle2 className="h-4 w-4" />
        </span>
      )}
    </button>
  );
};

const DialogContext = React.createContext(null);

const Dialog = ({ open, onOpenChange, children }) => (
  <DialogContext.Provider value={{ open, onOpenChange }}>
    {children}
  </DialogContext.Provider>
);

const DialogContent = ({ className, children, ...props }) => {
  const ctx = useContext(DialogContext);
  if (!ctx?.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="fixed inset-0 bg-black/80"
        onClick={() => ctx.onOpenChange?.(false)}
      />
      <div
        className={`relative z-10 grid w-full max-w-lg gap-4 overflow-auto rounded-2xl border bg-background p-6 shadow-lg ${className || ""}`}
        onClick={(event) => event.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  );
};

const DialogHeader = ({ className, ...props }) => (
  <div
    className={`flex flex-col space-y-1.5 text-center sm:text-left ${className || ""}`}
    {...props}
  />
);

const DialogFooter = ({ className, ...props }) => (
  <div
    className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className || ""}`}
    {...props}
  />
);

const DialogTitle = ({ className, ...props }) => (
  <h2
    className={`text-lg font-semibold leading-none tracking-tight ${className || ""}`}
    {...props}
  />
);

const Row = ({ k, v }) => (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{k}</span>
    <span className="font-medium">{v}</span>
  </div>
);

const BillCard = ({ bill, onPause, onResume, onCheckout, onStart, onExtend }) => {
  const secs = elapsedSeconds(bill);
  const children = bill.children ?? [];
  const paused = bill.status === "paused";

  const getTimerText = () => {
    if (bill.status === "running") {
      return formatHMS(secs);
    }
    if (bill.status === "booked") {
      return "Not Started";
    }
    if (bill.status === "paused") {
      return "Paused";
    }
    return bill.status || "Not Started";
  };

  return (
    <div
      className={`surface-card p-5 transition-all ${
        paused ? "ring-2 ring-amber-400/60" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground font-mono">
            {bill.sessionNumber}
          </div>
          <div className="font-semibold text-lg leading-tight">
            {bill.parentName}
          </div>
          <div className="text-xs text-muted-foreground">
            {bill.mobileNumber}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            paused
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
              : bill.status === "booked"
              ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
              : "bg-green-500/15 text-green-700 dark:text-green-400"
          }`}
        >
          {paused ? (
            <Pause className="h-3 w-3" />
          ) : bill.status === "booked" ? (
            <Clock className="h-3 w-3" />
          ) : (
            <Timer className="h-3 w-3" />
          )}{" "}
          {paused ? "Paused" : bill.status === "booked" ? "Booked" : "Active"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {children.map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs"
          >
            <Baby className="h-3 w-3" /> {c.name} · {c.age}y
          </span>
        ))}
      </div>

      <div className="mt-4 font-mono text-3xl font-semibold tabular-nums gradient-text">
        {getTimerText()}
      </div>
      <div className="text-xs text-muted-foreground">
        billed as {bill.totalHours ?? 0} hr
        {bill.startTime ? ` · started ${new Date(bill.startTime).toLocaleTimeString()}` : ""}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-secondary/50 p-2">
          <div className="text-muted-foreground">Session</div>
          <div className="font-semibold">--</div>
        </div>
        <div className="rounded-lg bg-secondary/50 p-2">
          <div className="text-muted-foreground">Cafe</div>
          <div className="font-semibold">--</div>
        </div>
        <div
          className="rounded-lg p-2"
          style={{ background: "var(--gradient-primary)", color: "white" }}
        >
          <div className="opacity-80">Total</div>
          <div className="font-semibold">--</div>
        </div>
      </div>
      {/* Reference, Payment and Pending removed per UI request */}

      <div className="mt-4 flex gap-2">
        {bill.status === "booked" && (
          <Button
            size="sm"
            className="flex-1"
            style={{ background: "var(--gradient-primary)" }}
            onClick={onStart}
          >
            <Play className="h-3.5 w-3.5 mr-1" /> Start session
          </Button>
        )}

        {bill.status === "running" && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={onPause}
          >
            <Pause className="h-3.5 w-3.5 mr-1" /> Pause
          </Button>
        )}

        {bill.status === "paused" && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={onResume}
          >
            <Play className="h-3.5 w-3.5 mr-1" /> Resume
          </Button>
        )}

        {(bill.status === "running" || bill.status === "paused") && (
          <>
            <Button size="sm" variant="outline" className="flex-1">
              <Coffee className="h-3.5 w-3.5 mr-1" /> Add cafe
            </Button>

            <Button size="sm" variant="outline" className="flex-1" onClick={onExtend}>
              <Clock className="h-3.5 w-3.5 mr-1" /> Extend 1 hr
            </Button>

            <Button
              size="sm"
              className="flex-1"
              style={{ background: "var(--gradient-primary)" }}
              onClick={onCheckout}
            >
              <Receipt className="h-3.5 w-3.5 mr-1" /> Checkout
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

const CheckoutDialog = ({
  billId,
  bills,
  offers = [],
  onClose,
  onCompleted,
}) => {
  const bill = bills.find((b) => b._id === billId);
  const [offerId, setOfferId] = useState("none");
  const [submitting, setSubmitting] = useState(false);

  if (!bill) return null;

  const confirm = () => {
    setSubmitting(true);
    setTimeout(() => {
      const updatedBill = {
        ...bill,
        status: "completed",
        closed_at: new Date().toISOString(),
        invoice_no: `INV-${Date.now()}`,
      };

      toast.success(`Invoice ${updatedBill.invoice_no} generated`);
      onCompleted(updatedBill);
      setSubmitting(false);
    }, 500);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Checkout · {bill.parentName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Row
            k={`Session (${bill.children?.length ?? 0} child · ${bill.totalHours ?? 0} hr)`}
            v="--"
          />
          {bill.children?.map((c, i) => (
            <div key={i} className="text-xs text-muted-foreground pl-3">
              ↳ {c.name} ({c.age}y): --
            </div>
          ))}
          <Row k="Cafe items" v="--" />
          <div className="h-px bg-border" />
          <div className="space-y-1.5">
            <Label className="text-xs">Apply offer</Label>
            <Select value={offerId} onValueChange={() => {}} disabled>
              <SelectTrigger>
                <SelectValue placeholder="No offer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No offer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Extra discount (₹)</Label>
            <Input
              type="text"
              value="--"
              disabled
            />
          </div>
          <div className="h-px bg-border" />
          <Row k="Subtotal" v="--" />
          <Row k="Discount" v="--" />
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-muted-foreground">Final total</span>
            <span className="text-3xl font-semibold gradient-text">
              --
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Earns -- reward points
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={submitting}
            style={{ background: "var(--gradient-primary)" }}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm checkout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const InvoiceDialog = ({ invoice, onClose }) => {
  if (!invoice) return null;

  const print = () => {
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    const html = document.getElementById("invoice-print")?.innerHTML ?? "";
    w.document.write(`<html><head><title>Invoice ${invoice.invoice_no}</title>
      <style>body{font-family:system-ui;padding:32px;color:#000;max-width:680px;margin:auto}
      h1{margin:0 0 4px} table{width:100%;border-collapse:collapse;margin:12px 0}
      td,th{padding:6px 8px;border-bottom:1px solid #eee;text-align:left;font-size:13px}
      .row{display:flex;justify-content:space-between;padding:3px 0}.bold{font-weight:700}
      </style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const ch = invoice.children ?? [];
  const start = invoice.startTime
    ? new Date(invoice.startTime)
    : null;
  const end = invoice.closed_at ? new Date(invoice.closed_at) : null;
  const durMin =
    start && end
      ? Math.round((end.getTime() - start.getTime()) / 60000)
      : 0;

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Invoice {invoice.invoice_no}</DialogTitle>
        </DialogHeader>
        <div id="invoice-print">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontSize: 22 }}>PLAYKIT</h1>
              <div style={{ fontSize: 12, color: "#666" }}>Tax invoice</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 12 }}>
              <div className="bold">{invoice.invoice_no}</div>
              <div>
                {invoice.closed_at
                  ? new Date(invoice.closed_at).toLocaleString()
                  : ""}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, fontSize: 13 }}>
            <div>
              <b>Parent:</b> {invoice.parentName} · {invoice.mobileNumber}
            </div>
            <div>
              <b>Customer:</b> {invoice.sessionNumber}
            </div>
            <div>
              <b>Paid:</b> --
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Child</th>
                <th>DOB</th>
                <th>Age</th>
              </tr>
            </thead>
            <tbody>
              {ch.map((c, i) => (
                <tr key={i}>
                  <td>{c.name}</td>
                  <td>{c.dob ? new Date(c.dob).toLocaleDateString() : "—"}</td>
                  <td>{c.age}y</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ fontSize: 13, marginTop: 8 }}>
            <div>
              <b>Session:</b> {start?.toLocaleString()} → {end?.toLocaleString()}{" "}
              ({durMin} min billed)
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Session charges ({ch.length} child)</td>
                <td>—</td>
                <td style={{ textAlign: "right" }}>--</td>
              </tr>
              <tr>
                <td>Cafe items</td>
                <td>—</td>
                <td style={{ textAlign: "right" }}>--</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #ddd" }}>
            <div className="row">
              <span>Subtotal</span>
              <span>--</span>
            </div>
            <div className="row">
              <span>Discount</span>
              <span>--</span>
            </div>
            <div
              className="row bold"
              style={{ fontSize: 18, marginTop: 6 }}
            >
              <span>TOTAL</span>
              <span>--</span>
            </div>
            <div
              className="row"
              style={{ marginTop: 6, color: "#666", fontSize: 12 }}
            >
              <span>Reward points earned</span>
              <span>--</span>
            </div>
          </div>
          <div
            style={{
              textAlign: "center",
              marginTop: 20,
              fontSize: 12,
              color: "#666",
            }}
          >
            Thank you for visiting PlayKit!
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={print}
            style={{ background: "var(--gradient-primary)" }}
          >
            <Printer className="h-4 w-4 mr-2" /> Print invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function SessionsPage() {
  const [, force] = useState(0);
  const [checkoutBillId, setCheckoutBillId] = useState(null);
  const [finalInvoice, setFinalInvoice] = useState(null);
  const [bills, setBills] = useState([]);
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Load booked sessions from backend
  useEffect(() => {
    const loadBookedSessions = async () => {
      try {
        const res = await axios.get(
          "http://localhost:3000/session/booked",
          {
            withCredentials: true,
          }
        );

        setBills(res.data.sessions);
      } catch (error) {
        console.log(error);
        toast.error(
          error.response?.data?.message ||
            "Failed to load sessions"
        );
      }
    };

    loadBookedSessions();
  }, []);

  const booked = bills.filter((b) => b.status === "booked");
  const running = bills.filter((b) => b.status === "running" || b.status === "paused");
  const completed = bills.filter((b) => b.status === "completed").slice(0, 20);

  const pause = (b) => {
    const updated = {
      ...b,
      status: "paused",
    };
    setBills(bills.map((bl) => (bl._id === b._id ? updated : bl)));
    toast.success("Paused");
  };

  const resume = (b) => {
    const updated = {
      ...b,
      status: "running",
    };
    setBills(bills.map((bl) => (bl._id === b._id ? updated : bl)));
    toast.success("Resumed");
  };

  const checkout = (b) => setCheckoutBillId(b._id);

  const startSession = (b) => {
    const updated = {
      ...b,
      status: 'running',
      startTime: new Date().toISOString(),
    };
    setBills((prev) => prev.map((bl) => (bl._id === b._id ? updated : bl)));
    toast.success('Session started');
  };

  const extendHour = (b) => {
    const start = new Date(b.startTime || Date.now());
    const newStart = new Date(start.getTime() - 60 * 60 * 1000).toISOString();
    const updated = { ...b, startTime: newStart };
    setBills((prev) => prev.map((bl) => (bl._id === b._id ? updated : bl)));
    toast.success('Extended by 1 hour');
  };

  const handleCheckoutComplete = (completedBill) => {
    setBills((prevBills) => {
      const filtered = prevBills.filter((b) => b._id !== completedBill._id);
      return [completedBill, ...filtered];
    });
    setCheckoutBillId(null);
    setFinalInvoice(completedBill);
  };

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Running Bills</h1>
          <p className="text-muted-foreground mt-1">
            Live unified bills — sessions, cafe and offers accrue together.
          </p>
        </div>
        <Button style={{ background: "var(--gradient-primary)" }}>
          <PlayCircle className="h-4 w-4 mr-2" /> Start session
        </Button>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <h2 className="font-semibold">
            Booked sessions{" "}
            <span className="text-muted-foreground font-normal">
              ({booked.length})
            </span>
          </h2>
        </div>
        {booked.length === 0 ? (
          <div className="surface-card p-10 text-center text-muted-foreground">
            No booked sessions.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {booked.map((b) => (
              <BillCard
                key={b._id}
                bill={b}
                onPause={() => pause(b)}
                onResume={() => resume(b)}
                onCheckout={() => checkout(b)}
                onStart={() => startSession(b)}
                onExtend={() => extendHour(b)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <h2 className="font-semibold">
            Running sessions{" "}
            <span className="text-muted-foreground font-normal">
              ({running.length})
            </span>
          </h2>
        </div>
        {running.length === 0 ? (
          <div className="surface-card p-10 text-center text-muted-foreground">
            No running sessions. Start a session to open one.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {running.map((b) => (
              <BillCard
                key={b._id}
                bill={b}
                onPause={() => pause(b)}
                onResume={() => resume(b)}
                onCheckout={() => checkout(b)}
                onStart={() => startSession(b)}
                onExtend={() => extendHour(b)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">Recently closed</h2>
        <div className="surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Invoice</th>
                <th className="text-left px-4 py-2.5 font-medium">
                  Customer
                </th>
                <th className="text-left px-4 py-2.5 font-medium">
                  Children
                </th>
                <th className="text-left px-4 py-2.5 font-medium">Closed</th>
                <th className="text-right px-4 py-2.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {completed.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No completed bills yet.
                  </td>
                </tr>
              )}
              {completed.map((b) => (
                <tr
                  key={b._id}
                  className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                  onClick={() => setFinalInvoice(b)}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">
                    {b.invoice_no}
                  </td>
                  <td className="px-4 py-2.5">
                    {b.parentName}
                    <div className="text-xs text-muted-foreground">
                      {b.mobileNumber}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{b.children?.length ?? 0}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {b.closed_at
                      ? new Date(b.closed_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">
                    --
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {checkoutBillId && (
        <CheckoutDialog
          billId={checkoutBillId}
          bills={bills}
          offers={offers}
          onClose={() => setCheckoutBillId(null)}
          onCompleted={handleCheckoutComplete}
        />
      )}
      <InvoiceDialog invoice={finalInvoice} onClose={() => setFinalInvoice(null)} />
    </div>
  );
}

export default SessionsPage;
