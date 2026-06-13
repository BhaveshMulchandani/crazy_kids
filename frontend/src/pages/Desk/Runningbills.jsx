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
  IndianRupee,
  ChevronDown,
  X,
} from "lucide-react";

// Mock data
const MOCK_PRICING = {
  base_rate_per_hour_under_3: 120,
  base_rate_per_hour_3_plus: 100,
  socks_cost: 30,
  points_per_100: 5,
};

const MOCK_CUSTOMERS = [
  {
    id: "c1",
    parent_name: "Riya Sharma",
    mobile: "9800000001",
    customer_code: "C001",
    visit_count: 5,
    total_spent: 1200,
    reward_points: 30,
  },
];

const MOCK_OFFERS = [
  {
    id: "o1",
    name: "Weekend Special",
    type: "percent",
    value: 10,
    active: true,
  },
  {
    id: "o2",
    name: "Group Discount",
    type: "flat",
    value: 100,
    active: true,
  },
];

let MOCK_RUNNING_BILLS = [
  {
    id: "b1",
    customer_id: "c1",
    customer: MOCK_CUSTOMERS[0],
    status: "open",
    session_status: "active",
    session_start: new Date(Date.now() - 30 * 60000).toISOString(),
    session_end: null,
    socks: true,
    socks_cost: 30,
    reference: "REF-001",
    mode_of_payment: "Cash",
    paid_amount: 0,
    pending_amount: 0,
    paused_at: null,
    paused_seconds: 0,
    notes: null,
    offer_id: null,
    offer: null,
    children: [
      {
        id: "bc1",
        bill_id: "b1",
        child_id: "ch1",
        child_name: "Asha",
        child_dob: "2022-05-15",
        age_years: 2,
      },
    ],
    items: [],
    invoice_no: null,
    closed_at: null,
  },
];

let MOCK_CLOSED_BILLS = [
  {
    id: "b100",
    customer_id: "c1",
    customer: MOCK_CUSTOMERS[0],
    status: "closed",
    session_status: "completed",
    session_start: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    session_end: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 45 * 60000).toISOString(),
    socks: false,
    socks_cost: 0,
    paused_at: null,
    paused_seconds: 0,
    notes: "Birthday party",
    reference: "REF-100",
    mode_of_payment: "Card",
    paid_amount: 200,
    pending_amount: 160,
    offer_id: "o1",
    offer: MOCK_OFFERS[0],
    children: [
      {
        id: "bc100",
        bill_id: "b100",
        child_id: "ch1",
        child_name: "Asha",
        child_dob: "2022-05-15",
        age_years: 2,
      },
    ],
    items: [
      { id: "bi1", name: "Hot Chocolate", quantity: 1, total: 120 },
      { id: "bi2", name: "Muffin", quantity: 2, total: 100 },
    ],
    invoice_no: "INV-2026-001",
    session_charges: 180,
    cafe_total: 220,
    subtotal: 400,
    discount: 40,
    total: 360,
    points_earned: 18,
    closed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 45 * 60000).toISOString(),
  },
];

// Helper functions
const ageInYears = (dob) => {
  if (!dob) return null;
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
};

const elapsedSeconds = (bill) => {
  const start = new Date(bill.session_start);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  const total = Math.floor(diff / 1000);
  const paused = bill.paused_seconds || 0;
  return total - paused;
};

const formatHMS = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const billedHours = (secs) => {
  const hours = secs / 3600;
  const totalHours = Math.ceil(hours);
  return { hours, totalHours };
};

const sessionChargesFor = (children, secs, pricing) => {
  const { totalHours } = billedHours(secs);
  const perChild = children.map((c) => {
    const isUnder3 = c.age_years < 3;
    const ratePerHour = isUnder3
      ? pricing.base_rate_per_hour_under_3
      : pricing.base_rate_per_hour_3_plus;
    const first = ratePerHour;
    const ext = ratePerHour * (totalHours - 1);
    return {
      name: c.child_name,
      age: c.age_years,
      first,
      ext,
      total: first + ext,
    };
  });
  const total = perChild.reduce((sum, pc) => sum + pc.total, 0);
  return { perChild, total };
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

const BillCard = ({ bill, pricing, onPause, onResume, onCheckout }) => {
  const secs = elapsedSeconds(bill);
  const { totalHours } = billedHours(secs);
  const children = bill.children ?? [];
  const sess = pricing
    ? sessionChargesFor(children, secs, pricing)
    : { perChild: [], total: 0 };
  const cafeTotal = (bill.items ?? []).reduce((s, i) => s + Number(i.total), 0);
  const socksCost = Number(bill.socks_cost ?? 0);
  const subtotal = sess.total + cafeTotal + socksCost;
  const paused = bill.session_status === "paused";

  return (
    <div
      className={`surface-card p-5 transition-all ${
        paused ? "ring-2 ring-amber-400/60" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground font-mono">
            {bill.customer?.customer_code}
          </div>
          <div className="font-semibold text-lg leading-tight">
            {bill.customer?.parent_name}
          </div>
          <div className="text-xs text-muted-foreground">
            {bill.customer?.mobile}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            paused
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
              : "bg-green-500/15 text-green-700 dark:text-green-400"
          }`}
        >
          {paused ? (
            <Pause className="h-3 w-3" />
          ) : (
            <Timer className="h-3 w-3" />
          )}{" "}
          {paused ? "Paused" : "Active"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {children.map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs"
          >
            <Baby className="h-3 w-3" /> {c.child_name} · {c.age_years}y
          </span>
        ))}
      </div>

      <div className="mt-4 font-mono text-3xl font-semibold tabular-nums gradient-text">
        {formatHMS(secs)}
      </div>
      <div className="text-xs text-muted-foreground">
        billed as {totalHours} hr · started{" "}
        {new Date(bill.session_start).toLocaleTimeString()}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-secondary/50 p-2">
          <div className="text-muted-foreground">Session</div>
          <div className="font-semibold">₹{sess.total}</div>
        </div>
        <div className="rounded-lg bg-secondary/50 p-2">
          <div className="text-muted-foreground">Cafe</div>
          <div className="font-semibold">₹{cafeTotal}</div>
        </div>
        <div
          className="rounded-lg p-2"
          style={{ background: "var(--gradient-primary)", color: "white" }}
        >
          <div className="opacity-80">Total</div>
          <div className="font-semibold">₹{subtotal}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <div className="rounded-lg bg-secondary/50 p-2">
          <div className="font-semibold">Ref</div>
          <div>{bill.reference || "—"}</div>
        </div>
        <div className="rounded-lg bg-secondary/50 p-2">
          <div className="font-semibold">Payment</div>
          <div>{bill.mode_of_payment || "—"}</div>
        </div>
        <div className="rounded-lg bg-secondary/50 p-2">
          <div className="font-semibold">Pending</div>
          <div>₹{Number(bill.pending_amount || 0)}</div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {paused ? (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={onResume}
          >
            <Play className="h-3.5 w-3.5 mr-1" /> Resume
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={onPause}
          >
            <Pause className="h-3.5 w-3.5 mr-1" /> Pause
          </Button>
        )}
        <Button size="sm" variant="outline" className="flex-1">
          <Coffee className="h-3.5 w-3.5 mr-1" /> Add cafe
        </Button>
        <Button
          size="sm"
          className="flex-1"
          style={{ background: "var(--gradient-primary)" }}
          onClick={onCheckout}
        >
          <Receipt className="h-3.5 w-3.5 mr-1" /> Checkout
        </Button>
      </div>
    </div>
  );
};

const CheckoutDialog = ({
  billId,
  pricing,
  bills,
  onClose,
  onCompleted,
}) => {
  const bill = bills.find((b) => b.id === billId);
  const [offerId, setOfferId] = useState(bill?.offer_id ?? "none");
  const [extraDiscount, setExtraDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  if (!bill || !pricing) return null;

  const secs = elapsedSeconds(bill);
  const sess = sessionChargesFor(bill.children ?? [], secs, pricing);
  const cafeTotal = (bill.items ?? []).reduce((s, i) => s + Number(i.total), 0);
  const socksCost = Number(bill.socks_cost ?? 0);
  const subtotal = sess.total + cafeTotal + socksCost;

  const offer = MOCK_OFFERS.find((o) => o.id === offerId);
  let offerDiscount = 0;
  if (offer) {
    if (offer.type === "percent")
      offerDiscount = (subtotal * Number(offer.value)) / 100;
    else offerDiscount = Number(offer.value);
  }
  const discount = Math.min(
    subtotal,
    Math.round(offerDiscount + (extraDiscount || 0))
  );
  const total = Math.max(0, subtotal - discount);
  const points = Math.floor((total / 100) * Number(pricing.points_per_100));

  const confirm = () => {
    setSubmitting(true);
    setTimeout(() => {
      const updatedBill = {
        ...bill,
        status: "closed",
        session_status: "completed",
        session_end: new Date().toISOString(),
        session_charges: sess.total,
        cafe_total: cafeTotal,
        offer_id: offer?.id ?? null,
        offer: offer ?? null,
        discount,
        subtotal,
        total,
        points_earned: points,
        invoice_no: `INV-${Date.now()}`,
        closed_at: new Date().toISOString(),
      };

      // Update mock data
      const billIdx = MOCK_RUNNING_BILLS.findIndex((b) => b.id === billId);
      if (billIdx >= 0) {
        MOCK_RUNNING_BILLS.splice(billIdx, 1);
        MOCK_CLOSED_BILLS.unshift(updatedBill);
      }

      toast.success(`Invoice ${updatedBill.invoice_no} generated`);
      onCompleted(updatedBill);
      setSubmitting(false);
    }, 500);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Checkout · {bill.customer?.parent_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Row
            k={`Session (${sess.perChild.length} child · ${billedHours(secs).totalHours} hr)`}
            v={`₹${sess.total}`}
          />
          {sess.perChild.map((c, i) => (
            <div key={i} className="text-xs text-muted-foreground pl-3">
              ↳ {c.name} ({c.age}y): ₹{c.first} + ₹{c.ext} ext
            </div>
          ))}
          <Row k="Cafe items" v={`₹${cafeTotal}`} />
          {socksCost > 0 && <Row k="Socks" v={`₹${socksCost}`} />}
          <div className="h-px bg-border" />
          <div className="space-y-1.5">
            <Label className="text-xs">Apply offer</Label>
            <Select value={offerId} onValueChange={setOfferId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No offer</SelectItem>
                {MOCK_OFFERS.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name} ·{" "}
                    {o.type === "percent" ? `${o.value}%` : `₹${o.value}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Extra discount (₹)</Label>
            <Input
              type="number"
              min={0}
              value={extraDiscount}
              onChange={(e) => setExtraDiscount(Number(e.target.value) || 0)}
            />
          </div>
          <div className="h-px bg-border" />
          <Row k="Subtotal" v={`₹${subtotal}`} />
          <Row k="Discount" v={`− ₹${discount}`} />
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-muted-foreground">Final total</span>
            <span className="text-3xl font-semibold gradient-text">
              ₹{total.toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Earns {points} reward points
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
  const items = invoice.items ?? [];
  const start = invoice.session_start
    ? new Date(invoice.session_start)
    : null;
  const end = invoice.session_end ? new Date(invoice.session_end) : null;
  const durMin =
    start && end
      ? Math.round(
          (end.getTime() -
            start.getTime() -
            (invoice.paused_seconds ?? 0) * 1000) /
            60000
        )
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
              <b>Parent:</b> {invoice.customer?.parent_name} ·{" "}
              {invoice.customer?.mobile}
            </div>
            <div>
              <b>Customer:</b> {invoice.customer?.customer_code}
            </div>
            <div>
              <b>Reference:</b> {invoice.reference || "—"}
            </div>
            <div>
              <b>Payment:</b> {invoice.mode_of_payment || "—"}
            </div>
            <div>
              <b>Paid:</b> ₹{Number(invoice.paid_amount ?? 0)} · <b>Pending:</b> ₹{Number(invoice.pending_amount ?? 0)}
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
                  <td>{c.child_name}</td>
                  <td>{c.child_dob}</td>
                  <td>{c.age_years}y</td>
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
                <td style={{ textAlign: "right" }}>
                  ₹{Number(invoice.session_charges)}
                </td>
              </tr>
              {Number(invoice.socks_cost) > 0 && (
                <tr>
                  <td>Socks</td>
                  <td>1</td>
                  <td style={{ textAlign: "right" }}>
                    ₹{Number(invoice.socks_cost)}
                  </td>
                </tr>
              )}
              {items.map((it, i) => (
                <tr key={i}>
                  <td>{it.name}</td>
                  <td>{it.quantity}</td>
                  <td style={{ textAlign: "right" }}>₹{Number(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #ddd" }}>
            <div className="row">
              <span>Subtotal</span>
              <span>₹{Number(invoice.subtotal)}</span>
            </div>
            <div className="row">
              <span>
                Discount{invoice.offer ? ` (${invoice.offer.name})` : ""}
              </span>
              <span>− ₹{Number(invoice.discount)}</span>
            </div>
            <div
              className="row bold"
              style={{ fontSize: 18, marginTop: 6 }}
            >
              <span>TOTAL</span>
              <span>₹{Number(invoice.total)}</span>
            </div>
            <div
              className="row"
              style={{ marginTop: 6, color: "#666", fontSize: 12 }}
            >
              <span>Reward points earned</span>
              <span>+{invoice.points_earned}</span>
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
  const [bills, setBills] = useState([...MOCK_RUNNING_BILLS, ...MOCK_CLOSED_BILLS]);

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const open = bills.filter((b) => b.status === "open");
  const closed = bills.filter((b) => b.status === "closed").slice(0, 20);

  const pause = (b) => {
    const updated = {
      ...b,
      session_status: "paused",
      paused_at: new Date().toISOString(),
    };
    setBills(bills.map((bl) => (bl.id === b.id ? updated : bl)));
    toast.success("Paused");
  };

  const resume = (b) => {
    const addSeconds = b.paused_at
      ? Math.floor((Date.now() - new Date(b.paused_at).getTime()) / 1000)
      : 0;
    const updated = {
      ...b,
      session_status: "active",
      paused_at: null,
      paused_seconds: (b.paused_seconds ?? 0) + addSeconds,
    };
    setBills(bills.map((bl) => (bl.id === b.id ? updated : bl)));
    toast.success("Resumed");
  };

  const checkout = (b) => setCheckoutBillId(b.id);

  const handleCheckoutComplete = (completedBill) => {
    setBills((prevBills) => {
      const filtered = prevBills.filter((b) => b.id !== completedBill.id);
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
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <h2 className="font-semibold">
            Open bills{" "}
            <span className="text-muted-foreground font-normal">
              ({open.length})
            </span>
          </h2>
        </div>
        {open.length === 0 ? (
          <div className="surface-card p-10 text-center text-muted-foreground">
            No open bills. Start a session to open one.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {open.map((b) => (
              <BillCard
                key={b.id}
                bill={b}
                pricing={MOCK_PRICING}
                onPause={() => pause(b)}
                onResume={() => resume(b)}
                onCheckout={() => checkout(b)}
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
              {closed.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No completed bills yet.
                  </td>
                </tr>
              )}
              {closed.map((b) => (
                <tr
                  key={b.id}
                  className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                  onClick={() => setFinalInvoice(b)}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">
                    {b.invoice_no}
                  </td>
                  <td className="px-4 py-2.5">
                    {b.customer?.parent_name}
                    <div className="text-xs text-muted-foreground">
                      {b.customer?.mobile}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{b.children?.length ?? 0}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {b.closed_at
                      ? new Date(b.closed_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">
                    ₹{Number(b.total).toLocaleString()}
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
          pricing={MOCK_PRICING}
          bills={bills}
          onClose={() => setCheckoutBillId(null)}
          onCompleted={handleCheckoutComplete}
        />
      )}
      <InvoiceDialog invoice={finalInvoice} onClose={() => setFinalInvoice(null)} />
    </div>
  );
}

export default SessionsPage;
