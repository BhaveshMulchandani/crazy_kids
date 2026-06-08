import * as React from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Receipt,
  Printer,
  Loader2,
  Sparkles,
  Timer,
  Search,
  Wand2,
  Award,
  Clock,
  TrendingUp,
  Check,
  ChevronDown,
} from "lucide-react";

const {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useContext,
  forwardRef,
} = React;

const cn = (...classes) => classes.filter(Boolean).join(" ");

const buttonVariantClasses = {
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

const buttonSizeClasses = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-10 rounded-md px-8",
  icon: "h-9 w-9",
};

const Button = forwardRef(
  (
    {
      className,
      variant = "default",
      size = "default",
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      type={type}
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        buttonVariantClasses[variant],
        buttonSizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

const Input = forwardRef(({ className, type = "text", ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

const Label = forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";

const Switch = forwardRef(
  (
    { className, checked = false, onCheckedChange, disabled, ...props },
    ref,
  ) => {
    const handleClick = () => {
      if (disabled) return;
      onCheckedChange?.(!checked);
    };

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        ref={ref}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-input",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    );
  },
);
Switch.displayName = "Switch";

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
      prev[itemValue] === label ? prev : { ...prev, [itemValue]: label },
    );
  }, []);

  const valueLabel = value != null ? (items[value] ?? value) : "";

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
        className={cn("relative inline-flex w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SelectContext.Provider>
  );
};

const SelectTrigger = forwardRef(({ className, children, ...props }, ref) => {
  const ctx = useContext(SelectContext);
  return (
    <button
      type="button"
      ref={ref}
      disabled={ctx?.disabled}
      onClick={() => ctx?.setOpen?.((prev) => !prev)}
      className={cn(
        "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

const SelectValue = ({ placeholder }) => {
  const ctx = useContext(SelectContext);
  return <span>{ctx?.value ? ctx.valueLabel : placeholder}</span>;
};

const SelectContent = forwardRef(
  ({ className, children, position = "popper", ...props }, ref) => {
    const ctx = useContext(SelectContext);
    if (!ctx?.open) return null;
    return (
      <div
        ref={ref}
        className={cn(
          "absolute left-0 top-full z-20 mt-2 min-w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
          className,
        )}
        {...props}
      >
        <div className={cn("p-1", position === "popper" ? "w-full" : "")}>
          {children}
        </div>
      </div>
    );
  },
);
SelectContent.displayName = "SelectContent";

const SelectItem = forwardRef(
  ({ className, children, value, ...props }, ref) => {
    const ctx = useContext(SelectContext);
    const label = typeof children === "string" ? children : "";

    useEffect(() => {
      ctx?.registerItem?.(value, label);
    }, [ctx, value, label]);

    const active = ctx?.value === value;

    return (
      <button
        type="button"
        ref={ref}
        className={cn(
          "flex w-full cursor-default select-none items-center justify-between rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none transition-colors",
          active
            ? "bg-accent text-accent-foreground"
            : "hover:bg-accent hover:text-accent-foreground",
          className,
        )}
        onClick={() => {
          ctx?.onValueChange?.(value);
          ctx?.setOpen?.(false);
        }}
        {...props}
      >
        <span>{children}</span>
        {active && (
          <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
            <Check className="h-4 w-4" />
          </span>
        )}
      </button>
    );
  },
);
SelectItem.displayName = "SelectItem";

const DialogContext = React.createContext(null);

const Dialog = ({ open, onOpenChange, children }) => (
  <DialogContext.Provider value={{ open, onOpenChange }}>
    {children}
  </DialogContext.Provider>
);

const DialogContent = forwardRef(({ className, children, ...props }, ref) => {
  const ctx = useContext(DialogContext);
  if (!ctx?.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="fixed inset-0 bg-black/80"
        onClick={() => ctx.onOpenChange?.(false)}
      />
      <div
        ref={ref}
        className={cn(
          "relative z-10 grid w-full max-w-lg gap-4 overflow-auto rounded-2xl border bg-background p-6 shadow-lg",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  );
});
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = forwardRef(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const SOCKS_COST = 30;
const API_BASE = "http://localhost:3000";
const MOCK_PRICING = [
  { id: "p1", minutes: 30, price: 150 },
  { id: "p2", minutes: 60, price: 300 },
  { id: "p3", minutes: 90, price: 420 },
  { id: "p4", minutes: 120, price: 520 },
];
const MOCK_CUSTOMERS = [
  {
    id: "c1",
    child_name: "Asha",
    parent_name: "Rita",
    mobile: "9800000001",
    customer_code: "C001",
    visit_count: 5,
    total_spent: 1200,
    reward_points: 30,
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "c2",
    child_name: "Rahul",
    parent_name: "Sunil",
    mobile: "9800000002",
    customer_code: "C002",
    visit_count: 2,
    total_spent: 300,
    reward_points: 10,
    updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
const MOCK_BILLS = [
  {
    id: "b1",
    customer_id: "c1",
    offer_id: "1",
    duration_minutes: 60,
    socks: true,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "b2",
    customer_id: "c2",
    offer_id: "2",
    duration_minutes: 90,
    socks: false,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
const MOCK_CAFE_ORDERS = [
  {
    id: "f1",
    customer_id: "c1",
    item_name: "Cookie",
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: "f2",
    customer_id: "c1",
    item_name: "Latte",
    created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
];

const BillingPage = () => {
  const { data: offers = [] } = useQuery({
    queryKey: ["offers", "active"],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/offers/active`, {
        withCredentials: true,
      });
      return Array.isArray(response.data.offers)
        ? response.data.offers.map((offer) => ({
            ...offer,
            id: offer.id || offer._id,
          }))
        : [];
    },
  });
  const { data: pricing = [] } = useQuery({
    queryKey: ["time_pricing"],
    queryFn: async () => MOCK_PRICING,
  });

  const [lookup, setLookup] = useState("");
  const [existingCustomer, setExistingCustomer] = useState(null);
  const [suggestions, setSuggestions] = useState(null);

  const [childName, setChildName] = useState("");
  const [parentName, setParentName] = useState("");
  const [mobile, setMobile] = useState("");
  const [socks, setSocks] = useState(false);
  const [offerId, setOfferId] = useState("none");
  const [minutes, setMinutes] = useState(60);
  const [customMins, setCustomMins] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [invoice, setInvoice] = useState(null);

  const finalMinutes = customMins ? Number(customMins) : minutes;

  const baseAmount = useMemo(() => {
    if (!pricing.length) return 0;
    const exact = pricing.find((p) => p.minutes === finalMinutes);
    if (exact) return Number(exact.price);
    const sorted = [...pricing].sort((a, b) => a.minutes - b.minutes);
    const ref =
      sorted.find((p) => p.minutes >= finalMinutes) ??
      sorted[sorted.length - 1];
    const rate = Number(ref.price) / Number(ref.minutes);
    return Math.round(rate * finalMinutes);
  }, [pricing, finalMinutes]);

  const offer = offers.find((o) => o.id === offerId);
  const { socksCost, discount, total } = useMemo(() => {
    const sc = socks ? SOCKS_COST : 0;
    const sub = baseAmount + sc;
    let d = 0;
    if (offer) {
      if (offer.type === "flat" || offer.type === "combo")
        d = Math.min(Number(offer.value), sub);
      if (offer.type === "percent") d = (sub * Number(offer.value)) / 100;
    }
    return {
      socksCost: sc,
      discount: Math.round(d),
      total: Math.max(0, Math.round(sub - d)),
    };
  }, [baseAmount, socks, offer]);

  const findCustomer = async () => {
    const q = lookup.trim();
    if (!q) return;
    const found = MOCK_CUSTOMERS.find(
      (customer) =>
        customer.mobile === q ||
        customer.customer_code === q ||
        customer.parent_name.toLowerCase().includes(q.toLowerCase()) ||
        customer.child_name.toLowerCase().includes(q.toLowerCase()),
    );
    if (!found) {
      toast.error("No customer found — fill new details below");
      setExistingCustomer(null);
      setSuggestions(null);
      return;
    }

    const pastBills = MOCK_BILLS.filter(
      (b) => b.customer_id === found.id,
    ).slice(-20);
    const pastCafe = MOCK_CAFE_ORDERS.filter(
      (o) => o.customer_id === found.id,
    ).slice(-50);
    const last = pastBills[pastBills.length - 1];
    const freq = (arr, key) => {
      const counts = {};
      arr.forEach((item) => {
        const k = item[key];
        if (k != null) counts[String(k)] = (counts[String(k)] ?? 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    };
    const itemFreq = (() => {
      const counts = {};
      pastCafe.forEach((o) => {
        counts[o.item_name] = (counts[o.item_name] ?? 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    })();

    const sug = {
      offerId: freq(pastBills, "offer_id"),
      minutes:
        last?.duration_minutes ??
        Number(freq(pastBills, "duration_minutes") ?? 60),
      socks: last?.socks ?? false,
      topItem: itemFreq,
    };

    setExistingCustomer(found);
    setChildName(found.child_name);
    setParentName(found.parent_name);
    setMobile(found.mobile);
    setSuggestions(sug);
    toast.success(
      `Welcome back, ${found.child_name}! Visit #${(found.visit_count ?? 0) + 1}`,
    );
  };

  const applySuggestions = () => {
    if (!suggestions) return;
    if (suggestions.offerId) setOfferId(suggestions.offerId);
    if (suggestions.minutes) {
      const m = suggestions.minutes;
      if ([30, 60, 90, 120].includes(m)) {
        setMinutes(m);
        setCustomMins("");
      } else {
        setCustomMins(m);
      }
    }
    if (typeof suggestions.socks === "boolean") setSocks(suggestions.socks);
    toast.success("Applied smart suggestions");
  };

  const submit = async () => {
    if (!childName || !parentName || !mobile) {
      toast.error("Fill child, parent and mobile");
      return;
    }
    if (!finalMinutes || finalMinutes <= 0) {
      toast.error("Pick a session duration");
      return;
    }
    setSubmitting(true);

    try {
      let customer =
        existingCustomer || MOCK_CUSTOMERS.find((c) => c.mobile === mobile);
      if (!customer) {
        const newCustomer = {
          id: `c${Date.now()}`,
          child_name: childName,
          parent_name: parentName,
          mobile,
          customer_code: `C${String(MOCK_CUSTOMERS.length + 1).padStart(3, "0")}`,
          visit_count: 0,
          total_spent: 0,
          reward_points: 0,
          updated_at: new Date().toISOString(),
        };
        MOCK_CUSTOMERS.push(newCustomer);
        customer = newCustomer;
      }

      const now = new Date();
      const end = new Date(now.getTime() + finalMinutes * 60_000);
      const points = Math.floor(total / 50);
      customer = {
        ...customer,
        visit_count: (customer.visit_count ?? 0) + 1,
        total_spent: Number(customer.total_spent ?? 0) + total,
        reward_points: (customer.reward_points ?? 0) + points,
        updated_at: now.toISOString(),
      };
      if (existingCustomer && existingCustomer.id === customer.id) {
        setExistingCustomer(customer);
      }
      const bill = {
        id: `b${Date.now()}`,
        invoice_no: `INV-${Date.now()}`,
        customer_id: customer.id,
        customer,
        base_amount: baseAmount,
        time_charges: baseAmount,
        socks,
        socks_cost: socksCost,
        offer_id: offer?.id ?? null,
        discount,
        cafe_total: 0,
        total,
        points_earned: points,
        duration_minutes: finalMinutes,
        session_start: now.toISOString(),
        session_end: end.toISOString(),
        notes: notes || null,
        created_at: now.toISOString(),
      };
      MOCK_BILLS.push(bill);

      const session = {
        id: `s${Date.now()}`,
        customer_id: customer.id,
        bill_id: bill.id,
        duration_minutes: finalMinutes,
        start_time: now.toISOString(),
        end_time: end.toISOString(),
        amount: baseAmount,
        status: "active",
      };

      customer.visit_count = (customer.visit_count ?? 0) + 1;
      customer.total_spent = Number(customer.total_spent ?? 0) + total;
      customer.reward_points = (customer.reward_points ?? 0) + points;
      customer.updated_at = now.toISOString();

      setInvoice({ ...bill, customer, offer: offer ?? null, session });
      toast.success("Bill generated & session started");
    } catch (e) {
      toast.error((e || {}).message ?? "Unable to generate bill");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setChildName("");
    setParentName("");
    setMobile("");
    setSocks(false);
    setOfferId("none");
    setMinutes(60);
    setCustomMins("");
    setNotes("");
    setExistingCustomer(null);
    setSuggestions(null);
    setLookup("");
    setInvoice(null);
  };

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">New Billing</h1>
          <p className="text-muted-foreground mt-1">
            Start a timed play session and generate an invoice.
          </p>
        </div>
      </div>

      <div className="surface-card p-5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Smart customer lookup
        </Label>
        <div className="mt-2 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-11"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="Mobile, Customer ID or Parent Name"
              onKeyDown={(e) => e.key === "Enter" && findCustomer()}
            />
          </div>
          <Button
            onClick={findCustomer}
            className="h-11 px-6"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Search className="h-4 w-4 mr-2" /> Find
          </Button>
        </div>
        {existingCustomer && (
          <div className="mt-4 grid grid-cols-5 gap-3 animate-in-up">
            <Pill
              label="Visits"
              value={String(existingCustomer.visit_count ?? 0)}
            />
            <Pill
              label="Total spent"
              value={`₹${Number(existingCustomer.total_spent ?? 0).toLocaleString()}`}
            />
            <Pill
              label="Reward pts"
              value={String(existingCustomer.reward_points ?? 0)}
              icon={Award}
            />
            <Pill
              label="Last visit"
              value={
                existingCustomer.updated_at
                  ? new Date(existingCustomer.updated_at).toLocaleDateString()
                  : "—"
              }
              icon={Clock}
            />
            <Pill
              label="Customer ID"
              value={existingCustomer.customer_code}
              mono
            />
          </div>
        )}
        {suggestions && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-4 animate-in-up">
            <Wand2 className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 text-sm">
              <div className="font-medium">Smart suggestions from history</div>
              <div className="text-muted-foreground text-xs mt-0.5">
                {suggestions.minutes ? `${suggestions.minutes} min` : "—"} ·
                socks: {suggestions.socks ? "yes" : "no"} ·{" "}
                {suggestions.offerId
                  ? `last offer reused`
                  : "no preferred offer"}{" "}
                ·{" "}
                {suggestions.topItem
                  ? ` favourite cafe item: ${suggestions.topItem}`
                  : " no cafe history"}
              </div>
            </div>
            <Button size="sm" onClick={applySuggestions} variant="outline">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Apply
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 surface-card p-8 space-y-6">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" /> Session duration
            </Label>
            <div className="mt-3 grid grid-cols-5 gap-3">
              {pricing.map((p) => {
                const active = !customMins && minutes === p.minutes;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setMinutes(p.minutes);
                      setCustomMins("");
                    }}
                    className={[
                      "rounded-2xl p-4 text-left border transition-all",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-lg scale-[1.02]"
                        : "bg-card hover:border-primary/40 hover:-translate-y-0.5",
                    ].join(" ")}
                  >
                    <div className="text-xl font-semibold">
                      {p.minutes}
                      <span className="text-xs ml-1 opacity-70">min</span>
                    </div>
                    <div
                      className={[
                        "text-sm mt-1",
                        active ? "opacity-90" : "text-muted-foreground",
                      ].join(" ")}
                    >
                      ₹{Number(p.price).toLocaleString()}
                    </div>
                  </button>
                );
              })}
              <div
                className={[
                  "rounded-2xl p-3 border transition-all",
                  customMins ? "border-primary bg-primary/5" : "bg-card",
                ].join(" ")}
              >
                <div className="text-xs text-muted-foreground mb-1">Custom</div>
                <Input
                  type="number"
                  min={1}
                  placeholder="min"
                  value={customMins}
                  onChange={(e) =>
                    setCustomMins(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Child Name</Label>
              <Input
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="Aarav"
              />
            </div>
            <div className="space-y-2">
              <Label>Parent Name</Label>
              <Input
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Riya Sharma"
              />
            </div>
            <div className="space-y-2">
              <Label>Mobile Number</Label>
              <Input
                value={mobile}
                onChange={(e) =>
                  setMobile(e.target.value.replace(/\D/g, "").slice(0, 15))
                }
                placeholder="98XXXXXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>Offer</Label>
              <Select value={offerId} onValueChange={setOfferId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an offer (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No offer</SelectItem>
                  {offers.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} ·{" "}
                      {o.type === "percent" ? `${o.value}%` : `₹${o.value}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Socks Required?</Label>
              <div className="h-10 flex items-center gap-3 px-4 rounded-lg border bg-secondary/50">
                <Switch checked={socks} onCheckedChange={setSocks} />
                <span className="text-sm">
                  {socks ? `Yes — ₹${SOCKS_COST} added` : "No"}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Birthday, special request…"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={submit}
              disabled={submitting}
              className="h-11 px-8"
              style={{ background: "var(--gradient-primary)" }}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Receipt className="mr-2 h-4 w-4" />
              Start Session & Generate Invoice
            </Button>
            <Button variant="outline" onClick={reset} className="h-11">
              Reset
            </Button>
          </div>
        </div>

        <div className="surface-card p-8 sticky top-24 h-fit">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Bill Summary</h3>
          </div>
          <dl className="space-y-3 text-sm">
            <Row
              k={`Time charges (${finalMinutes} min)`}
              v={`₹${baseAmount.toLocaleString()}`}
            />
            <Row k="Socks cost" v={`₹${socksCost}`} />
            <Row k="Offer discount" v={`− ₹${discount}`} />
            <div className="h-px bg-border my-3" />
            <div className="flex justify-between items-baseline">
              <dt className="text-muted-foreground">Total payable</dt>
              <dd className="text-3xl font-semibold gradient-text">
                ₹{total.toLocaleString()}
              </dd>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Earns {Math.floor(total / 50)} reward points
            </p>
          </dl>
        </div>
      </div>

      <InvoiceDialog invoice={invoice} onClose={() => setInvoice(null)} />
    </div>
  );
};

const Row = ({ k, v }) => {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
};

const Pill = ({ label, value, icon: Icon, mono }) => {
  return (
    <div className="rounded-xl border bg-secondary/50 px-3 py-2">
      <div className="text-[11px] text-muted-foreground flex items-center gap-1 uppercase tracking-wide">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div
        className={[
          "font-semibold text-sm mt-0.5",
          mono ? "font-mono text-primary" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
};

const InvoiceDialog = ({ invoice, onClose }) => {
  const [layout, setLayout] = useState("a4");
  if (!invoice) return null;

  const print = () => {
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    const html = document.getElementById("invoice-print")?.innerHTML ?? "";
    const styles =
      layout === "thermal"
        ? `@page{size:80mm auto;margin:4mm} body{font-family:'Courier New',monospace;width:72mm;font-size:12px;color:#000} h1,h2{margin:4px 0} .thermal-row{display:flex;justify-content:space-between} .thermal-hr{border-top:1px dashed #000;margin:6px 0} .center{text-align:center}`
        : `body{font-family:Inter,system-ui,sans-serif;padding:32px;color:#0b1220} h1,h2,h3{font-family:'Space Grotesk',sans-serif} table{width:100%;border-collapse:collapse;margin-top:12px} td,th{padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:left;font-size:13px} .muted{color:#64748b;font-size:12px} .brand{background:linear-gradient(135deg,#3b82f6,#60a5fa);color:white;padding:16px 20px;border-radius:14px;display:flex;justify-content:space-between;align-items:center}`;
    w.document.write(
      `<html><head><title>Invoice ${invoice.invoice_no}</title><style>${styles}</style></head><body>${html}</body></html>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Invoice generated</span>
            <div className="flex gap-1 text-xs">
              <Button
                size="sm"
                variant={layout === "a4" ? "default" : "outline"}
                onClick={() => setLayout("a4")}
              >
                A4
              </Button>
              <Button
                size="sm"
                variant={layout === "thermal" ? "default" : "outline"}
                onClick={() => setLayout("thermal")}
              >
                Thermal
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div id="invoice-print" className="max-h-[60vh] overflow-auto">
          {layout === "a4" ? (
            <A4Layout invoice={invoice} />
          ) : (
            <ThermalLayout invoice={invoice} />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={print}
            style={{ background: "var(--gradient-primary)" }}
          >
            <Printer className="mr-2 h-4 w-4" /> Print{" "}
            {layout === "thermal" ? "receipt" : "invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const A4Layout = ({ invoice }) => {
  return (
    <div>
      <div
        className="brand"
        style={{
          background: "linear-gradient(135deg,#3b82f6,#60a5fa)",
          color: "white",
          padding: "16px 20px",
          borderRadius: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            PlayKit Activity Store
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Tax Invoice</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
            {invoice.invoice_no}
          </div>
          <div style={{ fontSize: 12 }}>
            {new Date(invoice.created_at).toLocaleString()}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <div>
          <div className="muted">Billed to</div>
          <div style={{ fontWeight: 600 }}>{invoice.customer.child_name}</div>
          <div style={{ fontSize: 13 }}>
            Parent: {invoice.customer.parent_name}
          </div>
          <div style={{ fontSize: 13 }}>Mobile: {invoice.customer.mobile}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="muted">Customer ID</div>
          <div style={{ fontWeight: 600 }}>
            {invoice.customer.customer_code}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Session
          </div>
          <div style={{ fontSize: 13 }}>{invoice.duration_minutes} min</div>
          <div style={{ fontSize: 12 }}>
            {new Date(invoice.session_start).toLocaleTimeString()} →{" "}
            {new Date(invoice.session_end).toLocaleTimeString()}
          </div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style={{ textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Time charges ({invoice.duration_minutes} min)</td>
            <td style={{ textAlign: "right" }}>
              ₹
              {Number(
                invoice.time_charges || invoice.base_amount,
              ).toLocaleString()}
            </td>
          </tr>
          {invoice.socks && (
            <tr>
              <td>Socks</td>
              <td style={{ textAlign: "right" }}>
                ₹{Number(invoice.socks_cost).toLocaleString()}
              </td>
            </tr>
          )}
          {invoice.offer && (
            <tr>
              <td>Offer — {invoice.offer.name}</td>
              <td style={{ textAlign: "right" }}>
                − ₹{Number(invoice.discount).toLocaleString()}
              </td>
            </tr>
          )}
          {Number(invoice.cafe_total) > 0 && (
            <tr>
              <td>Cafe orders</td>
              <td style={{ textAlign: "right" }}>
                ₹{Number(invoice.cafe_total).toLocaleString()}
              </td>
            </tr>
          )}
          <tr>
            <td style={{ fontWeight: 700 }}>Total</td>
            <td style={{ textAlign: "right", fontSize: 22, fontWeight: 700 }}>
              ₹{Number(invoice.total).toLocaleString()}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 12 }}>
        Reward points earned: {invoice.points_earned} · Thank you for visiting
        PlayKit!
      </p>
    </div>
  );
};

const ThermalLayout = ({ invoice }) => {
  return (
    <div
      style={{
        fontFamily: "'Courier New', monospace",
        width: "72mm",
        fontSize: 12,
        color: "#000",
        padding: 8,
      }}
    >
      <div className="center" style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>PLAYKIT</div>
        <div>Activity Store</div>
        <div
          className="thermal-hr"
          style={{ borderTop: "1px dashed #000", margin: "6px 0" }}
        />
      </div>
      <div>Invoice: {invoice.invoice_no}</div>
      <div>Date: {new Date(invoice.created_at).toLocaleString()}</div>
      <div>
        Cust: {invoice.customer.child_name} ({invoice.customer.customer_code})
      </div>
      <div>Mob: {invoice.customer.mobile}</div>
      <div
        className="thermal-hr"
        style={{ borderTop: "1px dashed #000", margin: "6px 0" }}
      />
      <div>Session: {invoice.duration_minutes} min</div>
      <div>
        {new Date(invoice.session_start).toLocaleTimeString()} →{" "}
        {new Date(invoice.session_end).toLocaleTimeString()}
      </div>
      <div
        className="thermal-hr"
        style={{ borderTop: "1px dashed #000", margin: "6px 0" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Time charges</span>
        <span>₹{Number(invoice.time_charges || invoice.base_amount)}</span>
      </div>
      {invoice.socks && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Socks</span>
          <span>₹{Number(invoice.socks_cost)}</span>
        </div>
      )}
      {invoice.offer && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Offer {invoice.offer.name}</span>
          <span>-₹{Number(invoice.discount)}</span>
        </div>
      )}
      <div
        className="thermal-hr"
        style={{ borderTop: "1px dashed #000", margin: "6px 0" }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        <span>TOTAL</span>
        <span>₹{Number(invoice.total)}</span>
      </div>
      <div
        className="thermal-hr"
        style={{ borderTop: "1px dashed #000", margin: "6px 0" }}
      />
      <div className="center" style={{ textAlign: "center" }}>
        <div>Rewards: +{invoice.points_earned} pts</div>
        <div style={{ marginTop: 4 }}>Thank you!</div>
      </div>
    </div>
  );
};

export default BillingPage;
