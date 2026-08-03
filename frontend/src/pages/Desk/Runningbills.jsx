import React, {
  useEffect,
  useState,
  useCallback,
  useContext,
  useRef
} from "react";
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
  Clock,
  ChevronDown,
  MessageCircle,
  Loader2,
  Trash2,
  Pencil,
  Plus,
  Minus,
  Save,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toCanvas } from "html-to-image";
import jsPDF from "jspdf";
import { getDisplayName, getInvoiceDisplayName, getKotDisplayName } from "../../utils/customerDisplay";
import ConfirmDialog from "../../components/ConfirmDialog";
import { CafeReceiptMarkup } from "../../components/CafeReceipt";
import { printCafeReceipt } from "../../utils/cafeReceiptPrint";

// Helper functions
const elapsedSeconds = (bill) => {
  if (!bill.startTime) return 0;
  const start = new Date(bill.startTime);
  const now = new Date();
  const pausedMilliseconds = (bill.pauseHistory || []).reduce((total, pause) => {
    if (!pause?.pausedAt) return total;
    const pauseEnd = pause.resumedAt ? new Date(pause.resumedAt) : now;
    return total + Math.max(0, pauseEnd.getTime() - new Date(pause.pausedAt).getTime());
  }, 0);
  const diff = now.getTime() - start.getTime() - pausedMilliseconds;
  return Math.max(0, Math.floor(diff / 1000));
};

const formatHMS = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString()}`;

const OFFER_TYPE_LABELS = {
  discount: "Percentage Discount",
  flat_discount: "Flat Amount Discount",
  special_pricing: "Special Pricing",
  membership: "Membership",
};
const offerTypeLabel = (type) => OFFER_TYPE_LABELS[type] || type || "—";

// Elapsed time for one child, same math as elapsedSeconds(bill) above but
// against the child's own timer.pauseHistory — so an individually paused
// child freezes while the rest of the session keeps counting.
//
// Also caps at the child's own timer.scheduledEndTime (maintained by the
// backend alongside the main session's scheduledEndTime — shifted forward on
// every pause/resume and extension, both main-session and per-child). Once
// "now" passes that cap, `now` is clamped to it, so both the elapsed total
// and the ongoing-pause deduction stop advancing — the child's personal
// timer freezes at their allotted active play time instead of counting up
// forever.
const elapsedSecondsForChild = (bill, child) => {
  if (!bill.startTime) return 0;
  const start = new Date(bill.startTime);
  const rawNow = new Date();
  const cap = child?.timer?.scheduledEndTime ? new Date(child.timer.scheduledEndTime) : null;
  const now = cap && cap < rawNow ? cap : rawNow;
  const pausedMilliseconds = (child?.timer?.pauseHistory || []).reduce((total, pause) => {
    if (!pause?.pausedAt) return total;
    const pausedAt = new Date(pause.pausedAt);
    if (pausedAt >= now) return total;
    const pauseEnd = pause.resumedAt ? new Date(pause.resumedAt) : now;
    const cappedPauseEnd = pauseEnd > now ? now : pauseEnd;
    return total + Math.max(0, cappedPauseEnd.getTime() - pausedAt.getTime());
  }, 0);
  const diff = now.getTime() - start.getTime() - pausedMilliseconds;
  return Math.max(0, Math.floor(diff / 1000));
};

// A group booking has no per-child socksOpted flags to count — it collects a
// single "how many socks does the group need" headcount instead (see
// billing.service.js).
const calculateSocksCharge = (bill, pricingSettings) => {
  const children = bill?.children ?? [];
  const socksQty = bill?.groupBooking?.isGroup
    ? Number(bill.groupBooking.socksRequired || 0)
    : children.filter((child) => child?.socksOpted).length;
  const socksTotal = socksQty * Number(pricingSettings?.socksCost ?? 0);
  return { socksQty, socksTotal };
};

const isBirthdayChild = (child) => {
  if (child?.isBirthdayToday) return true;
  if (!child?.dob) return false;

  const birthday = new Date(child.dob);
  const today = new Date();

  return (
    today.getDate() === birthday.getDate() &&
    today.getMonth() === birthday.getMonth()
  );
};

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const dayName = (date) => new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);

// Mirrors backend/services/billing.service.js:calculateInvoiceCharges so the
// Running Bill / Final Bill preview matches what the invoice will actually
// charge — membership is resolved first and always wins; an offer is only
// looked at when no membership applies, and only takes effect once its own
// configured conditions (e.g. minKids) are satisfied.
const calculateSessionCharge = (bill, pricingSettings) => {
  const children = bill?.children ?? [];
  // A group booking (10-20+ kids, no per-child entries) prices by headcount
  // instead of iterating `children` — see billing.service.js. Every place
  // below that needs "how many kids are on this session" uses `childCount`.
  const groupBooking = bill?.groupBooking?.isGroup ? bill.groupBooking : null;
  const childCount = groupBooking ? Number(groupBooking.totalChildren || 0) : children.length;

  // Group bookings never carry a membership (see session.controller.js), so
  // this can only ever be true for a normal booking.
  const membershipApplied = Boolean(
    !groupBooking &&
      bill?.membership &&
      Number(bill.membership.remainingPlayHours || 0) >= Number(bill.totalHours || 1) &&
      Number(bill.membership.kidsAllowed || 0) >= childCount,
  );

  if (membershipApplied) {
    return { subtotal: 0, total: 0, membershipApplied: true, discountAmount: 0, offer: null, breakdown: [] };
  }

  const offer = bill?.offer?.active === false ? null : bill?.offer || null;
  const specialDayMatches =
    offer?.type === "special_pricing" &&
    String(offer.rules?.day || "").toLowerCase() === dayName(new Date()).toLowerCase();

  const rateFor = (isUnder3) => {
    const normalFirst = isUnder3
      ? Number(pricingSettings?.firstHourUnder3 ?? 0)
      : Number(pricingSettings?.firstHourAbove3 ?? 0);
    const normalExtension = isUnder3
      ? Number(pricingSettings?.extensionUnder3 ?? 0)
      : Number(pricingSettings?.extensionAbove3 ?? 0);
    const firstHourRate = specialDayMatches ? Number(offer.rules?.firstHourPrice || 0) : normalFirst;
    const extensionRate = specialDayMatches ? Number(offer.rules?.nextHourPrice || 0) : normalExtension;
    return firstHourRate + Math.max((bill?.totalHours ?? 1) - 1, 0) * extensionRate;
  };

  // Per-row breakdown for display — two summary rows (above/below 3y) for a
  // group booking, one row per named child otherwise.
  const breakdown = groupBooking
    ? [
        Number(groupBooking.aboveThreeCount || 0) > 0 && {
          name: `Children above 3 years (${groupBooking.aboveThreeCount})`,
          age: null,
          amount: round2(Number(groupBooking.aboveThreeCount || 0) * rateFor(false)),
        },
        Number(groupBooking.belowThreeCount || 0) > 0 && {
          name: `Children below 3 years (${groupBooking.belowThreeCount})`,
          age: null,
          amount: round2(Number(groupBooking.belowThreeCount || 0) * rateFor(true)),
        },
      ].filter(Boolean)
    : children.map((child) => ({
        name: child?.name || "",
        age: child?.age ?? null,
        // Pricing bracket comes from the operator-selected ageCategory, not
        // DOB — falls back to the legacy age-based check only for sessions
        // booked before ageCategory existed (see billing.service.js).
        amount: round2(
          rateFor(
            child?.ageCategory
              ? child.ageCategory === "below_3"
              : (child?.age ?? 0) < 3,
          ),
        ),
      }));

  const subtotal = round2(breakdown.reduce((total, row) => total + row.amount, 0));

  const offerConditionsMet = offer && childCount >= Number(offer.rules?.minKids || Infinity);
  let discountAmount = 0;
  if (offer?.type === "discount" && offerConditionsMet) {
    discountAmount = round2((subtotal * Number(offer.value || 0)) / 100);
  } else if (offer?.type === "flat_discount" && offerConditionsMet) {
    discountAmount = round2(Math.min(Number(offer.value || 0), subtotal));
  }

  return {
    subtotal,
    total: round2(Math.max(subtotal - discountAmount, 0)),
    membershipApplied: false,
    discountAmount,
    offer: discountAmount > 0 || specialDayMatches ? offer : null,
    breakdown,
  };
};

const PAYMENT_METHOD_LABELS = { cash: "Cash", upi: "UPI", card: "Card" };

// `paymentBreakdown` (set once at booking time — see Billing.jsx submit())
// is the only record of which method(s) actually settled a bill: a single
// entry for "paid", multiple for "partially_paid" (split payment), and
// empty for "pending" (nothing collected yet, so there's nothing to show).
// Read-only — this doesn't add or change how payment is captured, only
// surfaces what's already stored.
const formatPaymentMethodLabel = (bill) => {
  const breakdown = Array.isArray(bill?.paymentBreakdown)
    ? bill.paymentBreakdown.filter((entry) => Number(entry?.amount) > 0)
    : [];
  if (breakdown.length === 0) return null;
  if (breakdown.length === 1) {
    const method = breakdown[0]?.method || "cash";
    return PAYMENT_METHOD_LABELS[method] || method;
  }
  return `Split Payment (${breakdown
    .map((entry) => `${PAYMENT_METHOD_LABELS[entry.method] || entry.method} ${formatCurrency(entry.amount)}`)
    .join(" + ")})`;
};

const getSessionPaymentSummary = (bill, sessionCharge) => {
  const paymentStatus = bill?.paymentStatus || "pending";
  const amountPaid = paymentStatus === "pending" ? 0 : Number(bill?.amountPaid || 0);
  const pendingAmount =
    paymentStatus === "pending"
      ? sessionCharge.total
      : Math.max(sessionCharge.total - amountPaid, 0);

  return {
    amountPaid,
    pendingAmount,
    paymentStatusLabel:
      paymentStatus === "paid"
        ? "Paid"
        : paymentStatus === "partially_paid"
          ? "Partially Paid"
          : "Pending",
    paymentMethodLabel: formatPaymentMethodLabel(bill),
  };
};

const calculateLoyaltyPoints = (amount, pricingSettings) => {
  const pointsPer100 = Number(pricingSettings?.loyaltyPointsPer100 ?? 10);
  return Math.floor(Number(amount || 0) / 100) * pointsPer100;
};

const calculateFoodCharge = (bill) => {
  const kots = bill?.kots ?? [];
  const subtotal = kots.reduce(
    (sum, kot) => sum + Number(kot?.totalAmount || 0),
    0,
  );
  const gst = Math.round(subtotal * 0.05 * 100) / 100;
  return {
    subtotal,
    gst,
    total: subtotal + gst,
  };
};

// UI Components
const Button = ({
  className,
  variant = "default",
  size = "default",
  type = "button",
  children,
  ...props
}) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
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

const Row = ({ k, v, bold, accent }) => (
  <div className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-0.5 ${bold ? "text-sm" : ""}`}>
    <span className={`min-w-0 break-words ${bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{k}</span>
    <span
      className={`shrink-0 tabular-nums ${bold ? "font-bold text-base" : "font-medium"}`}
      style={accent ? { color: accent } : undefined}
    >
      {v}
    </span>
  </div>
);

// Small notes textarea matching the look of the Input component above —
// not worth a whole new shared primitive for one usage.
const NotesField = ({ value, onChange, disabled }) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
    placeholder="Remarks / notes…"
    rows={1}
    className="mt-1 flex w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
  />
);

// One cafe order (KOT): view mode shows items + remarks exactly as placed,
// with Reprint / Edit / Delete order actions. Edit mode turns the same
// items list into an editable draft (qty stepper, per-item delete, add-item
// picker, notes) that's only persisted on Save via PATCH /cafe/kot/:id —
// mirrors the existing Cafepos "build a cart, then submit once" pattern.
// `onChanged` is the parent's loadSessions() — it refreshes both `bills`
// and `kotsBySession`, which is the single hook every downstream total
// (card tiles, Checkout dialog, the eventual invoice) already derives from
// live, so nothing else needs to recompute anything by hand.
const CafeOrderCard = ({ kot, orderIndex, bill, menu, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [addMenuId, setAddMenuId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [printing, setPrinting] = useState(false);

  const startEdit = () => {
    setDraftItems(
      (kot.items || []).map((item) => ({
        _id: item._id,
        menuItem: item.menuItem,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        notes: item.notes || "",
      })),
    );
    setAddMenuId("");
    setAddQty(1);
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const setDraftQty = (index, delta) =>
    setDraftItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item)),
    );

  const setDraftNotes = (index, notes) =>
    setDraftItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, notes } : item)));

  const removeDraftItem = (index) => setDraftItems((prev) => prev.filter((_, idx) => idx !== index));

  const addDraftItem = () => {
    const menuItem = menu.find((m) => m.id === addMenuId);
    if (!menuItem) {
      toast.error("Pick a menu item to add");
      return;
    }
    const quantity = Math.max(1, Number(addQty) || 1);
    setDraftItems((prev) => [
      ...prev,
      { menuItem: menuItem.id, name: menuItem.name, price: menuItem.price, quantity, notes: "" },
    ]);
    setAddMenuId("");
    setAddQty(1);
  };

  const save = async () => {
    if (draftItems.length === 0) {
      toast.error("An order needs at least one item — use Delete order to remove the whole order instead");
      return;
    }
    setSaving(true);
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/cafe/kot/${kot._id}`,
        {
          items: draftItems.map((item) => ({
            _id: item._id,
            menuItem: item.menuItem,
            quantity: item.quantity,
            notes: item.notes,
          })),
        },
        { withCredentials: true },
      );
      toast.success("Order updated");
      setEditing(false);
      await onChanged?.();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update order");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/cafe/kot/${kot._id}`, { withCredentials: true });
      toast.success("Order deleted");
      setConfirmDeleteOpen(false);
      await onChanged?.();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete order");
    } finally {
      setDeleting(false);
    }
  };

  const reprint = () => {
    setPrinting(true);
    // Renders the hidden receipt markup for exactly one tick, then prints
    // it — mirrors the just-placed receipt in Cafepos.jsx via the shared
    // components/CafeReceipt.jsx, so the reprint is guaranteed identical
    // (same code, not a re-implementation) rather than approximated.
    requestAnimationFrame(() => {
      printCafeReceipt({ elementId: `cafe-reprint-${kot._id}`, kotNumber: kot.kotNumber || kot._id });
      setPrinting(false);
    });
  };

  const draftTotal = draftItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const availableMenu = menu.filter((m) => m.available !== false);

  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono">Order #{orderIndex + 1} · {kot.kotNumber || kot._id}</span>
        <span>{kot.createdAt ? new Date(kot.createdAt).toLocaleString() : ""}</span>
      </div>

      {!editing ? (
        <>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="pb-1 text-left font-medium">Item</th>
                <th className="pb-1 text-right font-medium">Qty</th>
                <th className="pb-1 text-right font-medium">Price</th>
                <th className="pb-1 text-right font-medium">Total</th>
                <th className="pb-1 text-left font-medium pl-2">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {(kot.items || []).map((item, itemIndex) => (
                <tr key={item._id || itemIndex}>
                  <td className="py-0.5 align-top">{item.name}</td>
                  <td className="py-0.5 text-right align-top">{item.quantity}</td>
                  <td className="py-0.5 text-right align-top">{formatCurrency(item.price)}</td>
                  <td className="py-0.5 text-right align-top font-medium">{formatCurrency(item.total)}</td>
                  <td className="py-0.5 pl-2 align-top text-muted-foreground">{item.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1.5 flex items-center justify-between border-t border-dashed border-border/60 pt-1.5">
            <div className="flex gap-1.5">
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={startEdit}>
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={reprint} disabled={printing}>
                <Printer className="h-3 w-3 mr-1" /> Reprint KOT
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-7 px-2 text-xs"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Delete order
              </Button>
            </div>
            <span className="text-xs font-semibold">Order total: {formatCurrency(kot.totalAmount)}</span>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {draftItems.map((item, index) => (
            <div key={item._id || `new-${index}`} className="rounded-lg border border-border/60 bg-secondary/30 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{item.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatCurrency(item.price)} × {item.quantity} = {formatCurrency(item.price * item.quantity)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => setDraftQty(index, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-5 text-center text-xs font-semibold">{item.quantity}</span>
                  <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => setDraftQty(index, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeDraftItem(index)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
              <NotesField value={item.notes} onChange={(notes) => setDraftNotes(index, notes)} />
            </div>
          ))}

          <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-border/60 p-2">
            <select
              value={addMenuId}
              onChange={(e) => setAddMenuId(e.target.value)}
              className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1.5 text-xs"
            >
              <option value="">Add item…</option>
              {availableMenu.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {formatCurrency(m.price)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              className="h-7 w-14 rounded-md border border-input bg-transparent px-1.5 text-xs"
            />
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={addDraftItem}>
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold">Draft total: {formatCurrency(draftTotal)}</span>
            <div className="flex gap-1.5">
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={cancelEdit} disabled={saving}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2 text-xs"
                style={{ background: "var(--primary)" }}
                onClick={save}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />} Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen — exists only so Reprint can read its innerHTML through
          the exact same pipeline the just-placed receipt uses. Never shown. */}
      <div style={{ position: "absolute", left: -9999, top: -9999 }} aria-hidden="true">
        <CafeReceiptMarkup
          elementId={`cafe-reprint-${kot._id}`}
          kotNumber={kot.kotNumber || kot._id}
          sessionNumber={bill.sessionNumber}
          customerName={getKotDisplayName(bill)}
          tableNumber={kot.tableNumber}
          createdAt={kot.createdAt ? new Date(kot.createdAt) : new Date()}
          items={(kot.items || []).map((item) => ({ name: item.name, qty: item.quantity, price: item.price, notes: item.notes }))}
          total={kot.totalAmount}
        />
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete this order?"
        message={`This removes order ${kot.kotNumber || kot._id} and its items from the bill. This cannot be undone.`}
        confirmLabel="Delete order"
        loading={deleting}
        onCancel={() => !deleting && setConfirmDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

// Full cafe order history for one session — every KOT ever placed against
// it (kots is already the complete, session-scoped list from
// getSessionKOTs, same source calculateFoodCharge already sums), not just
// the latest order. Works identically for normal/membership/group bookings
// since none of this branches on session type. Each order can be edited,
// deleted, or reprinted in place — see CafeOrderCard above. `onChanged`
// (the parent's loadSessions()) is what makes every downstream total
// correct again after an edit; nothing here recomputes billing itself.
const CafeOrdersDialog = ({ bill, kots, onClose, onChanged }) => {
  const [menu, setMenu] = useState([]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${import.meta.env.VITE_API_URL}/menu/getall`, { withCredentials: true })
      .then((response) => {
        if (cancelled) return;
        const apiMenu = response?.data?.menu ?? response?.data ?? [];
        if (Array.isArray(apiMenu)) {
          setMenu(
            apiMenu.map((item) => ({
              id: item._id ?? item.id,
              name: item.name,
              price: Number(item.price),
              available: item.available ?? true,
            })),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!bill) return null;

  const orders = [...kots].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
  );
  const grandTotal = orders.reduce((sum, kot) => sum + Number(kot?.totalAmount || 0), 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Cafe orders · {getDisplayName(bill)}</DialogTitle>
        </DialogHeader>
        {orders.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No cafe orders placed for this session yet.
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {orders.map((kot, orderIndex) => (
              <CafeOrderCard
                key={kot._id || orderIndex}
                kot={kot}
                orderIndex={orderIndex}
                bill={bill}
                menu={menu}
                onChanged={onChanged}
              />
            ))}
            <div className="flex items-center justify-between rounded-xl bg-secondary/40 p-3 text-sm font-bold">
              <span>Cafe Total ({orders.length} order{orders.length === 1 ? "" : "s"})</span>
              <span>{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PAYMENT_MODE_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
];

// Inline "collect the pending amount now" control — shown on a bill card
// only while paymentSummary.pendingAmount > 0. Purely additive UI: it calls
// the new PATCH /session/settle-payment/:id endpoint, it doesn't touch the
// existing booking-time payment fields/flow or the Checkout dialog at all.
// Once settled, the parent's loadSessions() refresh (passed in via
// onSettle, same pattern as onPause/onExtend/etc.) picks up the updated
// paymentStatus/paymentBreakdown and the "Payment Completed Using" row
// takes over from this control automatically.
const SettlePendingPaymentControl = ({ pendingAmount, onSettle }) => {
  const [method, setMethod] = useState("cash");
  const [submitting, setSubmitting] = useState(false);

  const settle = async () => {
    setSubmitting(true);
    try {
      await onSettle(method);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        disabled={submitting}
        className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        {PAYMENT_MODE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        className="h-7 px-2 text-xs"
        style={{ background: "var(--primary)" }}
        onClick={settle}
        disabled={submitting}
      >
        {submitting ? "Settling…" : `Mark ${formatCurrency(pendingAmount)} paid`}
      </Button>
    </div>
  );
};

const BillCard = ({
  bill,
  onPause,
  onResume,
  onCheckout,
  onStart,
  onExtend,
  onPauseChild,
  onResumeChild,
  onSettlePayment,
  onCafeTotal,
  onCancel,
  pricingSettings,
  kotsBySession,
  highlighted,
}) => {
  const secs = elapsedSeconds(bill);
  const children = bill.children ?? [];
  const birthdayChildren = children.filter((child) => isBirthdayChild(child));
  // A Birthday Group Booking has no per-child dob to detect a birthday from
  // (see session.model.js groupBooking.isBirthday) — it's an explicit
  // operator selection instead, but reuses this exact same highlight.
  const hasBirthday = birthdayChildren.length > 0 || Boolean(bill?.groupBooking?.isBirthday);
  const paused = bill.status === "paused";
  const sessionCharge = calculateSessionCharge(bill, pricingSettings);
  const foodCharge = calculateFoodCharge({
    ...bill,
    kots: kotsBySession?.[bill._id] || [],
  });
  const socksCharge = calculateSocksCharge(bill, pricingSettings);
  // Membership plan bought with this visit — billed once, on this session's
  // invoice only (backend mirrors this via session.membershipPurchase).
  const membershipPurchaseTotal = Number(bill?.membershipPurchase?.price || 0);
  const total = sessionCharge.total + foodCharge.total + socksCharge.socksTotal + membershipPurchaseTotal;
  // Must be the combined grand total (session + cafe + socks), not just
  // sessionCharge — otherwise a membership session (sessionCharge.total is
  // always 0, membership covers it) shows ₹0 pending even when there's a
  // real cafe bill still owed.
  const paymentSummary = getSessionPaymentSummary(bill, { total });

  const isOverdue = Boolean(
    bill?.scheduledEndTime && new Date(bill.scheduledEndTime) <= new Date(),
  );

  const getTimerText = () => {
    if (bill.status === "running" || bill.status === "paused") {
      return isOverdue ? "Session Over" : formatHMS(secs);
    }
    if (bill.status === "booked") {
      return "Not Started";
    }
    return bill.status || "Not Started";
  };

  const navigate = useNavigate();

  return (
    <div
      id={`bill-${bill._id}`}
      className={`surface-card p-3.5 transition-all ${
        paused ? "ring-2 ring-amber-400/60" : ""
      } ${hasBirthday ? "ring-2 ring-pink-500 bg-pink-50" : ""} ${
        highlighted ? "ring-2 ring-blue-500 ring-offset-2" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground font-mono tracking-tight">
            {bill.sessionNumber}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="min-w-0 truncate font-bold text-base leading-tight tracking-tight">
              {getDisplayName(bill)}
            </div>

            {hasBirthday && (
              <span className="shrink-0 rounded-full bg-pink-600 px-2 py-0.5 text-xs font-semibold text-white">
                🎂 Birthday
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {bill.mobileNumber}
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            isOverdue
              ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
              : paused
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
          {isOverdue
            ? "Session Over"
            : paused
              ? "Paused"
              : bill.status === "booked"
                ? "Booked"
                : "Active"}
        </span>
      </div>

      <div className="mt-2 space-y-1">
        {children.map((c, i) => {
          const isBirthday = isBirthdayChild(c);
          const timer = c.timer || {};
          const childPaused = timer.status === "paused";
          const childStarted = bill.status === "running" || bill.status === "paused";
          const childSecs = childStarted ? elapsedSecondsForChild(bill, c) : 0;

          return (
            <div
              key={i}
              className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-xs ${
                isBirthday ? "bg-pink-600 text-white" : "bg-secondary"
              }`}
            >
              <span className="flex min-w-0 items-center gap-1">
                {isBirthday ? "🎂" : <Baby className="h-3 w-3 shrink-0" />}
                <span className="truncate font-medium">
                  {c.name}{c.age != null ? ` · ${c.age}y` : ""}
                </span>
                {c.socksOpted && <span title="Socks opted">🧦</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {childStarted && (
                  <span
                    className={`font-mono tabular-nums ${childPaused ? "opacity-70" : ""}`}
                    title={childPaused ? "Paused" : "Running"}
                  >
                    {formatHMS(childSecs)}
                  </span>
                )}
                {bill.status === "running" && (onPauseChild || onResumeChild) && (
                  <button
                    type="button"
                    title={childPaused ? "Resume child" : "Pause child"}
                    onClick={() =>
                      childPaused ? onResumeChild?.(i) : onPauseChild?.(i)
                    }
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/30 hover:bg-white/50"
                  >
                    {childPaused ? (
                      <Play className="h-3 w-3" />
                    ) : (
                      <Pause className="h-3 w-3" />
                    )}
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-primary leading-none">
        {getTimerText()}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">
        billed as {bill.totalHours ?? 0} hr
        {bill.startTime
          ? ` · started ${new Date(bill.startTime).toLocaleTimeString()}`
          : ""}
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg border border-border/60 bg-white p-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Session</div>
          <div className="text-sm font-bold tabular-nums">
            {formatCurrency(sessionCharge.total)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onCafeTotal?.(bill)}
          title="View full cafe order history"
          className="rounded-lg border border-border/60 bg-white p-1.5 cursor-pointer transition-colors hover:border-primary/50 hover:bg-secondary/40"
        >
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Cafe</div>
          <div className="text-sm font-bold tabular-nums">
            {formatCurrency(foodCharge.total)}
          </div>
        </button>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-primary/80">Total</div>
          <div className="text-sm font-bold tabular-nums text-primary">{formatCurrency(total)}</div>
        </div>
      </div>
      <div className="mt-2 rounded-lg border border-border/60 bg-secondary/40 p-2 text-xs space-y-0.5">
        <Row k="Session Charges (18% GST Inclusive)" v={formatCurrency(sessionCharge.subtotal)} />
        {sessionCharge.membershipApplied && (
          <Row k="Membership" v="Applied" />
        )}
        {membershipPurchaseTotal > 0 && (
          <Row
            k={`Membership Purchase — ${bill.membershipPurchase?.planName || ""}`}
            v={formatCurrency(membershipPurchaseTotal)}
          />
        )}
        {!sessionCharge.membershipApplied && sessionCharge.offer && (
          <Row
            k={`Offer Applied — ${sessionCharge.offer.name} (${offerTypeLabel(sessionCharge.offer.type)})`}
            v="Applied"
          />
        )}
        {!sessionCharge.membershipApplied && sessionCharge.discountAmount > 0 && (
          <Row k="Discount Amount" v={`-${formatCurrency(sessionCharge.discountAmount)}`} accent="oklch(0.62 0.17 155)" />
        )}
        <div className="border-t border-dashed border-border/60 pt-0.5">
          <Row k="Final Session Charges" v={formatCurrency(sessionCharge.total)} bold />
        </div>
        {socksCharge.socksQty > 0 && (
          <Row
            k={`Socks (${socksCharge.socksQty} × ${formatCurrency(pricingSettings?.socksCost ?? 0)})`}
            v={formatCurrency(socksCharge.socksTotal)}
          />
        )}
        {/* Cafe is always chargeable regardless of membership/offer, so it
            always gets its own line here — not folded into Session Charges
            above, which membership can zero out. */}
        <Row k="Cafe Total" v={formatCurrency(foodCharge.total)} />
        <div className="border-t border-border/60 pt-0.5 space-y-0.5">
          <Row k="Amount Paid" v={formatCurrency(paymentSummary.amountPaid)} />
          <Row k="Pending Amount" v={formatCurrency(paymentSummary.pendingAmount)} />
          <Row k="Payment Status" v={paymentSummary.paymentStatusLabel} />
          {paymentSummary.paymentMethodLabel && (
            <Row k="Payment Completed Using" v={paymentSummary.paymentMethodLabel} />
          )}
          {paymentSummary.pendingAmount > 0 && onSettlePayment && (
            <SettlePendingPaymentControl
              pendingAmount={paymentSummary.pendingAmount}
              onSettle={(method) => onSettlePayment(method)}
            />
          )}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {bill.status === "booked" && (
          <Button
            size="sm"
            className="flex-1"
            style={{ background: "var(--primary)" }}
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
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() =>
                navigate("/desk/cafepos", {
                  state: {
                    session: bill,
                  },
                })
              }
            >
              <Coffee className="h-3.5 w-3.5 mr-1" />
              Add cafe
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={onExtend}
            >
              <Clock className="h-3.5 w-3.5 mr-1" /> Extend 1 hr
            </Button>

            <Button
              size="sm"
              className="flex-1"
              style={{ background: "var(--primary)" }}
              onClick={onCheckout}
            >
              <Receipt className="h-3.5 w-3.5 mr-1" /> Checkout
            </Button>
          </>
        )}

        {onCancel && (
          <Button
            size="sm"
            variant="destructive"
            title="Cancel this session"
            onClick={() => onCancel(bill)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

const CheckoutDialog = ({
  billId,
  bills,
  pricingSettings,
  kotsBySession = {},
  onClose,
  onCompleted,
}) => {
  const bill = bills.find((b) => b._id === billId);
  const [submitting, setSubmitting] = useState(false);
  const [extraDiscountType, setExtraDiscountType] = useState("flat");
  const [extraDiscountValue, setExtraDiscountValue] = useState("");
  const sessionCharge = calculateSessionCharge(bill, pricingSettings);
  const foodCharge = calculateFoodCharge({
    ...bill,
    kots: kotsBySession?.[bill?._id] || [],
  });
  const socksCharge = calculateSocksCharge(bill, pricingSettings);
  const membershipPurchaseTotal = Number(bill?.membershipPurchase?.price || 0);
  const preDiscountTotal = sessionCharge.total + foodCharge.total + socksCharge.socksTotal + membershipPurchaseTotal;
  // Operator-entered discount on top of any offer/membership pricing — either
  // a flat ₹ amount or a % of the pre-discount total. Clamped so a percentage
  // never exceeds 100%, negative values are rejected, and the resulting
  // amount can never push the payable total below zero. Mirrors the backend
  // clamp in billing.service.js, which is the authority — this is only a
  // live preview.
  const rawExtraDiscountValue = Math.max(Number(extraDiscountValue) || 0, 0);
  const extraDiscountAmount =
    extraDiscountType === "percentage"
      ? round2(preDiscountTotal * (Math.min(rawExtraDiscountValue, 100) / 100))
      : Math.min(rawExtraDiscountValue, preDiscountTotal);
  const total = preDiscountTotal - extraDiscountAmount;
  const paymentSummary = getSessionPaymentSummary(bill, { total });
  // No loyalty points at all when any child in the session has their
  // birthday today — mirrors the same exemption billing.service.js applies
  // at checkout, so this preview never shows points the confirmed invoice
  // won't actually award.
  const hasBirthdayChild = (bill?.children || []).some((child) => isBirthdayChild(child));
  const loyaltyPoints = hasBirthdayChild ? 0 : calculateLoyaltyPoints(total, pricingSettings);

  if (!bill) return null;

  const confirm = async () => {
    setSubmitting(true);

    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/session/complete/${bill._id}`,
        { extraDiscountType, extraDiscountValue: rawExtraDiscountValue },
        { withCredentials: true },
      );

      const invoiceResponse = await axios.get(
        `${import.meta.env.VITE_API_URL}/invoice/session/${bill._id}`,
        { withCredentials: true },
      );

      const invoice = invoiceResponse.data?.invoice;
      const updatedBill = {
        ...bill,
        status: "completed",
        closed_at: new Date().toISOString(),
        invoice_no: invoice?.invoiceNumber || `INV-${Date.now()}`,
        invoiceId: invoice?._id || null,
        invoiceData: invoice || null,
      };

      toast.success(`Invoice ${updatedBill.invoice_no} generated`);
      onCompleted(updatedBill);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to complete session");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Checkout · {getDisplayName(bill)}</DialogTitle>
        </DialogHeader>
        <div className="text-sm">
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-0.5">
            <Row k="Session Charges (18% GST Inclusive)" v={formatCurrency(sessionCharge.subtotal)} />
            {sessionCharge.membershipApplied && (
              <Row k="Membership" v="Applied" />
            )}
            {!sessionCharge.membershipApplied && sessionCharge.offer && (
              <>
                <Row
                  k="Offer Applied"
                  v={`${sessionCharge.offer.name} (${offerTypeLabel(sessionCharge.offer.type)})`}
                />
                {sessionCharge.discountAmount > 0 && (
                  <Row k="Discount Amount" v={`-${formatCurrency(sessionCharge.discountAmount)}`} accent="oklch(0.62 0.17 155)" />
                )}
              </>
            )}
            <div className="border-t border-dashed border-border/60 my-1.5 pt-1">
              <Row k="Final Session Charges" v={formatCurrency(sessionCharge.total)} bold />
            </div>
            {sessionCharge.breakdown?.map((row, i) => (
              <div key={i} className="text-xs text-muted-foreground pl-3">
                ↳ {row.name}{row.age != null ? ` (${row.age}y)` : ""}: {formatCurrency(row.amount)}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 mt-3 space-y-0.5">
            {membershipPurchaseTotal > 0 && (
              <Row
                k={`Membership Purchase — ${bill.membershipPurchase?.planName || ""}`}
                v={formatCurrency(membershipPurchaseTotal)}
              />
            )}
            <Row k="Cafe items" v={formatCurrency(foodCharge.total)} />
            {socksCharge.socksQty > 0 && (
              <Row
                k={`Socks (${socksCharge.socksQty} × ${formatCurrency(pricingSettings?.socksCost ?? 0)})`}
                v={formatCurrency(socksCharge.socksTotal)}
              />
            )}
          </div>

          <div className="space-y-1.5 mt-3">
            <Label className="text-xs">Extra discount</Label>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="extraDiscountType"
                  checked={extraDiscountType === "flat"}
                  onChange={() => setExtraDiscountType("flat")}
                />
                ₹ Flat Amount
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="extraDiscountType"
                  checked={extraDiscountType === "percentage"}
                  onChange={() => setExtraDiscountType("percentage")}
                />
                Percentage (%)
              </label>
            </div>
            <Input
              type="number"
              min="0"
              max={extraDiscountType === "percentage" ? 100 : preDiscountTotal}
              value={extraDiscountValue}
              onChange={(e) => setExtraDiscountValue(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 mt-3 space-y-0.5">
            <Row k="Payment Status" v={paymentSummary.paymentStatusLabel} />
            <Row k="Amount Paid" v={formatCurrency(paymentSummary.amountPaid)} />
            <Row k="Pending Amount" v={formatCurrency(paymentSummary.pendingAmount)} />
            {paymentSummary.paymentMethodLabel && (
              <Row k="Payment Completed Using" v={paymentSummary.paymentMethodLabel} />
            )}
            <Row k="Loyalty Points Earned" v={loyaltyPoints.toString()} />
          </div>

          {extraDiscountAmount > 0 && (
            <div className="mt-3">
              <Row
                k={`Extra Discount (${extraDiscountType === "percentage" ? `${Math.min(rawExtraDiscountValue, 100)}%` : "Flat"})`}
                v={`-${formatCurrency(extraDiscountAmount)}`}
                accent="oklch(0.62 0.17 155)"
                bold
              />
            </div>
          )}

          <div className="mt-3 flex justify-between items-center rounded-xl border-2 border-primary/30 bg-white px-4 py-3">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Final Amount</span>
            <span className="text-2xl font-bold text-primary tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={submitting}
            style={{ background: "var(--primary)" }}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm checkout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Everything under #invoice-print is styled with inline styles rather than
// Tailwind classes or a shared stylesheet: the "Print invoice" flow below
// clones this element's innerHTML into a bare popup window with no Tailwind
// loaded, so any styling that isn't inline (or baked into that popup's own
// <style> block) would silently disappear on the printed copy. Inline styles
// are the only thing guaranteed to render identically on-screen and on paper.
const INVOICE_TEXT = "#1f2937";
const INVOICE_MUTED = "#6b7280";
const INVOICE_BORDER = "#e5e7eb";
const INVOICE_ACCENT = "#0f172a";

// Company details shown on every invoice.
const COMPANY = {
  name: "CRAZY KIDS",
  phone: "+91 6354040807",
  addressLines: [
    "The Gateway, Shop No-201-205,",
    "Opposite Shopper's Gate, Chala,",
    "Vapi - Daman Road - 396191",
  ],
};

const invoiceRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  padding: "2.5px 0",
  fontSize: 11.5,
  color: INVOICE_TEXT,
};

const InvoiceRow = ({ label, value, bold, muted, color }) => (
  <div
    style={{
      ...invoiceRowStyle,
      fontWeight: bold ? 700 : 400,
      color: color || (muted ? INVOICE_MUTED : INVOICE_TEXT),
      fontSize: muted ? 11 : invoiceRowStyle.fontSize,
    }}
  >
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const invoiceThStyle = {
  padding: "5px 7px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "#475569",
  background: "#f1f5f9",
  borderBottom: `1px solid ${INVOICE_BORDER}`,
};

const invoiceTdStyle = {
  padding: "5px 7px",
  fontSize: 11.5,
  color: INVOICE_TEXT,
  borderBottom: `1px solid ${INVOICE_BORDER}`,
};


// Every `<tr>` plus every top-level section of #invoice-print (header, meta
// grid, session-info line, totals block, footer) is treated as an atomic
// block: a page break is never allowed to land inside one. Returns their
// vertical extents in DOM px, relative to the top of `root`, sorted by
// bottom edge — each `bottom` is a safe place to cut a page.
const getAvoidBreakRanges = (root) => {
  const rootTop = root.getBoundingClientRect().top;
  const toRange = (el) => {
    const rect = el.getBoundingClientRect();
    return { top: rect.top - rootTop, bottom: rect.bottom - rootTop };
  };
  const ranges = [];
  Array.from(root.children).forEach((child) => {
    const rows = child.querySelectorAll?.("tr") ?? [];
    if (rows.length > 0) {
      rows.forEach((row) => ranges.push(toRange(row)));
    } else {
      ranges.push(toRange(child));
    }
  });
  return ranges.sort((a, b) => a.bottom - b.bottom);
};

// Rasterizes the exact same #invoice-print DOM node the "Print invoice"
// button reads (see `print()` below) into a PDF Blob, so the document sent
// on WhatsApp is always visually identical to what gets printed — one
// template, not a separate one maintained for WhatsApp.
const generateInvoicePdfBlob = async () => {
  const node = document.getElementById("invoice-print");
  if (!node) return null;

  const avoidBreakRanges = getAvoidBreakRanges(node);
  const nodeWidth = node.getBoundingClientRect().width;

  // html-to-image serializes the node into an SVG <foreignObject> and lets
  // the browser's own engine paint it, so modern CSS (oklch(), color-mix(),
  // etc.) renders natively — html2canvas's hand-rolled CSS parser used to
  // throw "unsupported color function" here before the upload request could
  // ever fire. It also clones only this node rather than the whole
  // document, so styling anywhere else on the page can't break capture.
  const canvas = await toCanvas(node, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
  });

  if (!canvas.width || !canvas.height) {
    throw new Error("Invoice capture produced an empty image (invoice not visible?)");
  }

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Consistent 14mm margin on every side, matching the print stylesheet's
  // @page margin below. The image is always fit to the full printable
  // *width* — never shrunk to force everything onto one page. Height
  // overflow is handled by slicing the canvas across as many pages as the
  // content actually needs.
  const margin = Math.round((14 / 25.4) * 72); // 14mm in pt
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;

  const canvasToPt = maxWidth / canvas.width; // pt per canvas px
  const canvasScale = canvas.width / nodeWidth; // canvas px per DOM px
  const pageHeightInCanvasPx = maxHeight / canvasToPt;

  // Safe cut points, in canvas-pixel space — the bottom edge of every row /
  // section, so a page break never lands inside one.
  const breakPoints = avoidBreakRanges
    .map((r) => r.bottom * canvasScale)
    .filter((y) => y > 0 && y < canvas.height);

  const sliceCanvas = document.createElement("canvas");
  const sliceCtx = sliceCanvas.getContext("2d");

  let currentY = 0;
  let firstPage = true;
  while (currentY < canvas.height - 1) {
    const desiredEnd = Math.min(currentY + pageHeightInCanvasPx, canvas.height);
    let sliceEnd = desiredEnd;
    if (desiredEnd < canvas.height) {
      const safe = breakPoints.filter((y) => y > currentY + 1 && y <= desiredEnd);
      if (safe.length > 0) sliceEnd = safe[safe.length - 1];
    }
    // Guard against an atomic block taller than a full page: fall back to a
    // hard cut so the loop always makes progress.
    if (sliceEnd <= currentY) sliceEnd = desiredEnd;

    const sliceHeight = Math.round(sliceEnd - currentY);
    if (sliceHeight <= 0) break;

    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeight;
    sliceCtx.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    sliceCtx.drawImage(
      canvas,
      0, currentY, canvas.width, sliceHeight,
      0, 0, canvas.width, sliceHeight,
    );

    const sliceImgData = sliceCanvas.toDataURL("image/png");
    const sliceHeightPt = sliceHeight * canvasToPt;

    if (!firstPage) pdf.addPage();
    pdf.addImage(sliceImgData, "PNG", margin, margin, maxWidth, sliceHeightPt);
    firstPage = false;

    currentY = sliceEnd;
  }

  return pdf.output("blob");
};

// Builds the standalone print document for an invoice. Used both by the
// Electron silent-print path (main.js loads this string into a hidden
// window) and the plain-browser fallback (window.open + w.print()), so the
// two paths always render identically.
//
// Width is pinned to 72mm — the EPSON TM-T82X's documented *printable*
// width on an 80mm roll (the extra ~8mm is unprintable margin baked into
// the roll/head, not available page area). Templates that assumed the full
// 80mm minus a small margin (e.g. 74mm) render a couple mm past the
// printhead's actual right edge, which is exactly the clipped
// amount/Grand-Total column seen on paper. `box-sizing:border-box` keeps
// the 2mm side padding *inside* that 72mm rather than adding to it.
//
// Deliberately NOT using table-layout:fixed or fixed-percentage <colgroup>
// widths here — that forces every cell into a rigid box and wraps normal
// short values (dates, ages, "Yes"/"—") onto multiple lines, which is what
// visually "stacked" the receipt vertically. table-layout:auto (the
// default, same as before) lets the browser size columns to their content
// exactly like the reference receipt, and simply shrinking the outer width
// to 72mm is enough on its own to stop the right edge being clipped.
//
// The font is a system stack rather than a Google Fonts `<link>`: the
// previous remote font raced the 350ms print timer (and simply isn't
// reachable if the desk machine has no internet), so print output silently
// fell back to a different font at a different weight than what was
// previewed on screen — the reported "poor/inconsistent font rendering".
// A system font is available offline and renders identically every time.
const buildInvoicePrintHtml = (bodyHtml, invoiceNo) => `<html><head><title>Invoice ${invoiceNo}</title>
      <style>
      *{box-sizing:border-box}
      @page{size:80mm auto;margin:0}
      html,body{margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;width:72mm;margin:0 auto;padding:0 2mm;color:#000;line-height:1.3;font-weight:400}
      h1{margin:0}
      table{width:100%;border-collapse:collapse;margin:10px 0;page-break-inside:auto}
      thead{display:table-header-group}
      tr{break-inside:avoid;page-break-inside:avoid}
      th:last-child,td:last-child{white-space:nowrap}
      .avoid-break{break-inside:avoid;page-break-inside:avoid}
      body, body *{color:#000 !important}
      @media print { body{padding:0 2mm} }
      </style></head><body>${bodyHtml}</body></html>`;

const InvoiceDialog = ({ invoice, onClose }) => {
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  if (!invoice) return null;

  // Prints straight to the fixed receipt printer (EPSON TM-T82X Receipt6,
  // see electron/main.js) with no OS print dialog whenever running inside
  // the Electron shell. Plain-browser dev/preview (no window.electronAPI)
  // keeps the previous popup + window.print() behavior.
  const print = () => {
    const html = document.getElementById("invoice-print")?.innerHTML ?? "";
    const fullHtml = buildInvoicePrintHtml(html, invoice.invoice_no);

    if (window.electronAPI?.printInvoice) {
      window.electronAPI.printInvoice(fullHtml).then((result) => {
        if (!result?.printed) {
          toast.error(`Invoice print failed${result?.error ? `: ${result.error}` : ""}`);
        }
      });
      return;
    }

    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    w.document.write(fullHtml);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  // Prevents duplicate sends: bails immediately if a request is already in
  // flight rather than relying solely on the button's disabled attribute.
  const sendWhatsApp = async () => {
    if (sendingWhatsApp) return;

    const invoiceId = invoice?.invoiceId || invoice?._id;
    if (!invoiceId) {
      toast.error("Invoice not found");
      return;
    }

    setSendingWhatsApp(true);
    try {
      const pdfBlob = await generateInvoicePdfBlob();
      if (!pdfBlob) {
        toast.error("Unable to generate invoice PDF");
        return;
      }

      // Diagnostic only — confirms the blob the capture/jsPDF step produced is
      // actually a well-formed, non-empty PDF *before* it's uploaded, so a
      // corruption report can be narrowed to "client never made a valid PDF"
      // vs. "something downstream mangled it".
      const first20 = new Uint8Array(await pdfBlob.slice(0, 20).arrayBuffer());
      const first20Ascii = Array.from(first20).map((b) => String.fromCharCode(b)).join("");
      console.log("[sendWhatsApp] generated PDF blob", {
        size: pdfBlob.size,
        type: pdfBlob.type,
        first20Bytes: Array.from(first20),
        first20BytesAscii: first20Ascii,
        isValidPdf: first20Ascii.startsWith("%PDF-"),
      });

      if (pdfBlob.size === 0) {
        toast.error("Generated invoice PDF is empty");
        return;
      }
      if (!first20Ascii.startsWith("%PDF-")) {
        toast.error("Generated invoice PDF is not valid");
        return;
      }

      // Upload the print-identical PDF first so it's in place before the
      // WhatsApp trigger asks TrdAI to fetch it.
      await axios.post(
        `${import.meta.env.VITE_API_URL}/invoice/${invoiceId}/pdf`,
        pdfBlob,
        { withCredentials: true, headers: { "Content-Type": "application/pdf" } },
      );

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/invoice/${invoiceId}/send-whatsapp`,
        {},
        { withCredentials: true },
      );
      toast.success(response.data?.message || "Invoice sent successfully on WhatsApp.");
    } catch (error) {
      // Debug-only: the toast below stays generic on purpose, so the real
      // reason (whichever of the two requests above failed — PDF upload or
      // send-whatsapp) has to be visible here instead.
      console.error("[sendWhatsApp] request failed", {
        requestUrl: error?.config?.url,
        responseStatus: error?.response?.status,
        responseBody: error?.response?.data,
        error,
      });
      toast.error(error.response?.data?.message || "Failed to send invoice on WhatsApp");
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const customer = invoice?.customer || {};
  const ch = invoice?.children ?? [];
  const sessionDetails = invoice?.sessionDetails || {};
  const cafeItems = invoice?.cafeItems || [];
  const charges = invoice?.charges || {};
  const start = sessionDetails?.startTime ? new Date(sessionDetails.startTime) : null;
  const end = sessionDetails?.endTime ? new Date(sessionDetails.endTime) : null;
  const durMin = sessionDetails?.actualDurationMinutes || 0;
  const loyaltyPoints = Number(charges?.loyaltyPoints ?? calculateLoyaltyPoints(charges?.grandTotal || 0, {}));
  // Invoice must never show Parent Name — child name(s) only.
  const invoiceIdentity = getInvoiceDisplayName(invoice);

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto bg-white">
        <DialogHeader>
          <DialogTitle>Invoice {invoice.invoice_no}</DialogTitle>
        </DialogHeader>
        <div id="invoice-print" style={{ color: INVOICE_TEXT, fontFamily: "inherit" }}>
          <div
            className="avoid-break"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              paddingBottom: 10,
              borderBottom: `2px solid ${INVOICE_ACCENT}`,
            }}
          >
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5, margin: 0, color: INVOICE_ACCENT }}>
                {COMPANY.name}
              </h1>
              <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: INVOICE_MUTED, marginTop: 2 }}>
                Tax Invoice
              </div>
              <div style={{ fontSize: 10, color: INVOICE_MUTED, marginTop: 5, lineHeight: 1.45 }}>
                {COMPANY.addressLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
                <div>Phone: {COMPANY.phone}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, fontSize: 13, fontFamily: "monospace" }}>{invoice.invoice_no}</div>
              <div style={{ fontSize: 10.5, color: INVOICE_MUTED, marginTop: 2 }}>
                {invoice.closed_at ? new Date(invoice.closed_at).toLocaleString() : ""}
              </div>
            </div>
          </div>

          <div
            className="avoid-break"
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              rowGap: 4,
              columnGap: 16,
              fontSize: 11.5,
            }}
          >
            <div><span style={{ color: INVOICE_MUTED }}>{invoiceIdentity.label}</span><br />{invoiceIdentity.value} · {customer.mobileNumber || invoice.mobileNumber}</div>
            <div><span style={{ color: INVOICE_MUTED }}>Band</span><br />{customer.bandNumber || invoice.bandNumber || "—"}</div>
            <div><span style={{ color: INVOICE_MUTED }}>Session</span><br />{customer.sessionNumber || invoice.sessionNumber || "—"}</div>
            {customer.city && <div><span style={{ color: INVOICE_MUTED }}>City</span><br />{customer.city}</div>}
          </div>

          <div>
            <table>
              <thead>
                <tr>
                  <th style={invoiceThStyle}>Child</th>
                  <th style={invoiceThStyle}>DOB</th>
                  <th style={invoiceThStyle}>Age</th>
                  <th style={invoiceThStyle}>First Hour</th>
                  <th style={invoiceThStyle}>Extension</th>
                  <th style={invoiceThStyle}>Socks</th>
                  <th style={{ ...invoiceThStyle, textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {ch.map((c, i) => (
                  <tr key={i}>
                    <td style={invoiceTdStyle}>{c.name}</td>
                    <td style={invoiceTdStyle}>{c.dob ? new Date(c.dob).toLocaleDateString() : "—"}</td>
                    <td style={invoiceTdStyle}>{c.age != null ? `${c.age}y` : "—"}</td>
                    <td style={invoiceTdStyle}>{formatCurrency(c.firstHourCharge || 0)}</td>
                    <td style={invoiceTdStyle}>{c.extensionHours ? `${c.extensionHours}h × ${formatCurrency(c.extensionRate || 0)}` : "—"}</td>
                    <td style={invoiceTdStyle}>{c.socksOpted ? "Yes" : "—"}</td>
                    <td style={{ ...invoiceTdStyle, textAlign: "right", fontWeight: 600 }}>{formatCurrency(c.childTotal || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="avoid-break" style={{ fontSize: 11, color: INVOICE_MUTED, marginTop: -4, marginBottom: 6 }}>
            <div>
              <span style={{ color: INVOICE_TEXT, fontWeight: 600 }}>Session:</span>{" "}
              {start?.toLocaleString()} → {end?.toLocaleString()} ({durMin} min billed)
            </div>
            <div style={{ marginTop: 2 }}>
              <span style={{ color: INVOICE_TEXT, fontWeight: 600 }}>Hours:</span>{" "}
              {sessionDetails?.totalHours || 1} total · {sessionDetails?.extensionHours || 0} extension · {sessionDetails?.pauseTimeMinutes || 0} min pause
            </div>
          </div>

          <div>
            <table>
              <thead>
                <tr>
                  <th style={invoiceThStyle}>Description</th>
                  <th style={invoiceThStyle}>Qty</th>
                  <th style={{ ...invoiceThStyle, textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.membership?.applied && (
                  <tr>
                    <td style={invoiceTdStyle}>Membership applied · {invoice.membership.planName}</td>
                    <td style={invoiceTdStyle}>—</td>
                    <td style={{ ...invoiceTdStyle, textAlign: "right" }}>Session covered</td>
                  </tr>
                )}
                {invoice.membership?.purchase?.price > 0 && (
                  <tr>
                    <td style={invoiceTdStyle}>Membership purchase · {invoice.membership.purchase.planName}</td>
                    <td style={invoiceTdStyle}>1</td>
                    <td style={{ ...invoiceTdStyle, textAlign: "right" }}>{formatCurrency(invoice.membership.purchase.price)}</td>
                  </tr>
                )}
                <tr>
                  <td style={invoiceTdStyle}>Session charges ({invoice.groupBooking?.totalChildren || ch.length} child)</td>
                  <td style={invoiceTdStyle}>—</td>
                  <td style={{ ...invoiceTdStyle, textAlign: "right" }}>
                    {formatCurrency(charges?.normalSessionTotal ?? charges?.sessionTotal ?? 0)}
                  </td>
                </tr>
                {!invoice.membership?.applied && invoice.offer?.name && charges?.discountAmount > 0 && (
                  <tr>
                    <td style={invoiceTdStyle}>Discount — {invoice.offer.name} ({offerTypeLabel(invoice.offer.type)})</td>
                    <td style={invoiceTdStyle}>—</td>
                    <td style={{ ...invoiceTdStyle, textAlign: "right", color: "#059669" }}>
                      -{formatCurrency(charges.discountAmount)}
                    </td>
                  </tr>
                )}
                {cafeItems.map((item, index) => (
                  <tr key={`${item.name}-${index}`}>
                    <td style={invoiceTdStyle}>{item.name}</td>
                    <td style={invoiceTdStyle}>{item.quantity}</td>
                    <td style={{ ...invoiceTdStyle, textAlign: "right" }}>{formatCurrency(item.lineTotal || 0)}</td>
                  </tr>
                ))}
                {charges?.socksQty > 0 && (
                  <tr>
                    <td style={invoiceTdStyle}>Socks</td>
                    <td style={invoiceTdStyle}>{charges.socksQty}</td>
                    <td style={{ ...invoiceTdStyle, textAlign: "right" }}>{formatCurrency(charges.socksTotal || 0)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 8, paddingTop: 4 }}>
            <InvoiceRow label="Session Charges (18% GST Inclusive)" value={formatCurrency(charges?.normalSessionTotal ?? charges?.sessionTotal ?? 0)} />
            {invoice.membership?.applied && (
              <>
                <InvoiceRow label={`Membership Applied (${invoice.membership.hoursConsumed}h)`} value="Session charge ₹0" />
                <InvoiceRow label="Membership Name" value={invoice.membership.planName} muted />
                <InvoiceRow label="Membership Hours Before Session" value={`${invoice.membership.hoursBeforeSession}h`} muted />
                <InvoiceRow label="Hours Used In This Session" value={`${invoice.membership.hoursConsumed}h`} muted />
                <InvoiceRow label="Remaining Membership Hours" value={`${invoice.membership.remainingHours}h`} muted />
                <InvoiceRow
                  label="Membership Expiry Date"
                  value={invoice.membership.expiryDate ? new Date(invoice.membership.expiryDate).toLocaleDateString() : "—"}
                  muted
                />
              </>
            )}
            {!invoice.membership?.applied && invoice.offer?.name && (
              <InvoiceRow label="Offer Applied" value={`${invoice.offer.name} (${offerTypeLabel(invoice.offer.type)})`} />
            )}
            {!invoice.membership?.applied && charges?.discountAmount > 0 && (
              <InvoiceRow label="Discount Amount" value={`-${formatCurrency(charges.discountAmount)}`} color="#059669" />
            )}
            {!invoice.membership?.applied && (
              <div style={{ borderTop: `1px dashed ${INVOICE_BORDER}`, marginTop: 2, paddingTop: 4 }}>
                <InvoiceRow label="Final Session Charges" value={formatCurrency(charges?.sessionTotal || 0)} bold />
              </div>
            )}
            {charges?.membershipPurchaseTotal > 0 && (
              <InvoiceRow label="Membership Purchase" value={formatCurrency(charges.membershipPurchaseTotal)} />
            )}

            <div style={{ borderTop: `1px solid ${INVOICE_BORDER}`, marginTop: 6, paddingTop: 4 }}>
              <InvoiceRow label="Cafe Subtotal" value={formatCurrency(charges?.cafeSubtotal ?? charges?.cafeTotal ?? 0)} />
              <InvoiceRow label="Cafe GST (5%)" value={formatCurrency(charges?.cafeGST || 0)} muted />
              <InvoiceRow label="Cafe Total" value={formatCurrency(charges?.cafeTotal || 0)} />
              {charges?.socksQty > 0 && (
                <InvoiceRow
                  label={`Socks (${charges.socksQty} × ${formatCurrency(charges.socksRate || 0)})`}
                  value={formatCurrency(charges.socksTotal || 0)}
                />
              )}
            </div>

            {charges?.extraDiscountAmount > 0 && (
              <div style={{ borderTop: `1px solid ${INVOICE_BORDER}`, marginTop: 6, paddingTop: 4 }}>
                <InvoiceRow
                  label={`Extra Discount (${charges.extraDiscountType === "percentage" ? `${charges.extraDiscountValue}%` : "Flat"})`}
                  value={`-${formatCurrency(charges.extraDiscountAmount)}`}
                  color="#059669"
                  bold
                />
              </div>
            )}

            <div style={{ borderTop: `1px solid ${INVOICE_BORDER}`, marginTop: 6, paddingTop: 4 }}>
              <InvoiceRow label="Loyalty Points Earned" value={loyaltyPoints} />
            </div>

            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: `2px solid ${INVOICE_ACCENT}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: INVOICE_ACCENT }}>
                Grand Total
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, color: INVOICE_ACCENT }}>{formatCurrency(charges?.grandTotal || 0)}</span>
            </div>
          </div>

          <div
            className="avoid-break"
            style={{
              textAlign: "center",
              marginTop: 12,
              fontSize: 11,
              fontStyle: "italic",
              color: INVOICE_MUTED,
            }}
          >
            Thank you for visiting Crazy Kids! · {COMPANY.phone}
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={print}
            style={{ background: "var(--primary)" }}
          >
            <Printer className="h-4 w-4 mr-2" /> Print invoice
          </Button>
          <Button
            variant="outline"
            onClick={sendWhatsApp}
            disabled={sendingWhatsApp}
          >
            {sendingWhatsApp ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4 mr-2" /> Send WhatsApp
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
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
  const [cafeOrdersBillId, setCafeOrdersBillId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [bills, setBills] = useState([]);
  const [recentlyClosed, setRecentlyClosed] = useState([]);
  const [pricingSettings, setPricingSettings] = useState(null);
  const [kotsBySession, setKotsBySession] = useState({});
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const bookedRes = await axios.get(
        `${import.meta.env.VITE_API_URL}/session/booked`,
        { withCredentials: true },
      );

      let runningSessions = [];

      try {
        const runningRes = await axios.get(
          `${import.meta.env.VITE_API_URL}/session/running`,
          { withCredentials: true },
        );

        runningSessions = runningRes.data.sessions ?? [];
      } catch {
        console.log("Running sessions API missing");
      }

      const allSessions = [
        ...(bookedRes.data.sessions ?? []),
        ...runningSessions,
      ];
      setBills(allSessions);

      const kotsMap = {};
      await Promise.all(
        allSessions.map(async (session) => {
          try {
            const res = await axios.get(
              `${import.meta.env.VITE_API_URL}/cafe/session/${session._id}`,
              { withCredentials: true },
            );
            kotsMap[session._id] = res.data?.kots ?? [];
          } catch {
            kotsMap[session._id] = [];
          }
        }),
      );
      setKotsBySession(kotsMap);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load sessions");
    }
  }, []);

  // Always the true latest 5 checked-out sessions from the server — not
  // just whatever got completed during this browser tab's lifetime.
  const loadRecentlyClosed = useCallback(async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/session/completed/recent?limit=5`,
        { withCredentials: true },
      );
      setRecentlyClosed(response.data?.sessions ?? []);
    } catch {
      console.warn("Unable to load recently closed sessions");
    }
  }, []);

  useEffect(() => {
    loadRecentlyClosed();
  }, [loadRecentlyClosed]);

  useEffect(() => {
    const loadPricingSettings = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/price/prices`,
          { withCredentials: true },
        );
        setPricingSettings(response.data || null);
      } catch {
        console.warn("Unable to load pricing settings");
      }
    };

    loadPricingSettings();
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Keeps session/cafe data (and therefore the live Pending Amount) in sync
  // even when nothing on this page triggers a reload — e.g. cafe items added
  // from another desk terminal, or an operator leaving this tab open for a
  // while. loadSessions() already no-ops quietly on failure, so this is safe
  // to run silently in the background.
  useEffect(() => {
    const poll = setInterval(() => {
      loadSessions();
    }, 10000);
    return () => clearInterval(poll);
  }, [loadSessions]);

  // Deep-linked from a "session waiting for checkout" notification —
  // scroll the matching card into view and briefly highlight it.
  useEffect(() => {
    if (!highlightId || bills.length === 0) return;

    const el = document.getElementById(`bill-${highlightId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });

    const timeout = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      next.delete("highlight");
      setSearchParams(next, { replace: true });
    }, 5000);

    return () => clearTimeout(timeout);
  }, [highlightId, bills.length]);

  const booked = bills.filter((b) => b.status === "booked");
  const running = bills.filter(
    (b) => b.status === "running" || b.status === "paused",
  );
  const completed = recentlyClosed;

  const pause = async (b) => {
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/session/pause/${b._id}`,
        {},
        { withCredentials: true },
      );
      toast.success("Session paused");
      await loadSessions();
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Failed to pause session");
    }
  };

  const resume = async (b) => {
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/session/resume/${b._id}`,
        {},
        { withCredentials: true },
      );
      toast.success("Session resumed");
      await loadSessions();
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Failed to resume session");
    }
  };

  // Cancelling only flips session.status to "cancelled" on the backend —
  // session and cafe order data are never deleted, so no local list beyond
  // the Running Session screen (bills, driven by loadSessions()) needs to
  // change. Confirmation is handled by the shared ConfirmDialog, same
  // pattern used elsewhere in the app for destructive actions.
  const confirmCancelSession = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/session/cancel/${cancelTarget._id}`,
        {},
        { withCredentials: true },
      );
      toast.success("Session cancelled");
      setCancelTarget(null);
      await loadSessions();
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Failed to cancel session");
    } finally {
      setCancelling(false);
    }
  };

  const pauseChild = async (b, index) => {
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/session/pause-child/${b._id}/${index}`,
        {},
        { withCredentials: true },
      );
      await loadSessions();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to pause child");
    }
  };

  const resumeChild = async (b, index) => {
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/session/resume-child/${b._id}/${index}`,
        {},
        { withCredentials: true },
      );
      await loadSessions();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to resume child");
    }
  };

  // Records how a previously-pending balance got paid, before checkout —
  // new action, doesn't touch the booking-time payment fields' meaning or
  // the Checkout dialog/complete-session flow at all. See
  // settlePendingPayment in session.controller.js.
  const settlePayment = async (b, method) => {
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/session/settle-payment/${b._id}`,
        { method },
        { withCredentials: true },
      );
      toast.success("Pending payment settled");
      await loadSessions();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to settle pending payment");
    }
  };

  const checkout = (b) => setCheckoutBillId(b._id);

  const openInvoice = async (session) => {
    try {
      let invoice = null;
      try {
        const invoiceResponse = await axios.get(
          `${import.meta.env.VITE_API_URL}/invoice/session/${session._id}`,
          { withCredentials: true },
        );
        invoice = invoiceResponse.data?.invoice;
      } catch (error) {
        // A session can end up completed with no invoice if invoice
        // generation crashed mid-checkout — recover by asking the backend
        // to (idempotently) create it now instead of dead-ending.
        if (error.response?.status !== 404) throw error;
        const createResponse = await axios.post(
          `${import.meta.env.VITE_API_URL}/invoice/create/${session._id}`,
          {},
          { withCredentials: true },
        );
        invoice = createResponse.data?.invoice;
      }
      if (!invoice) {
        toast.error("Invoice not found");
        return;
      }
      setFinalInvoice({
        ...session,
        ...invoice,
        invoice_no: invoice.invoiceNumber || session.invoice_no,
        invoiceId: invoice._id,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load invoice");
    }
  };

  const startSession = async (b) => {
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/session/start/${b._id}`,
        {},
        { withCredentials: true },
      );
      toast.success("Session started");
      await loadSessions();
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Failed to start session");
    }
  };

  const extendHour = async (b) => {
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/session/extend/${b._id}`,
        {},
        { withCredentials: true },
      );
      toast.success("Extended by 1 hour");
      await loadSessions();
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Failed to extend session");
    }
  };

  const handleCheckoutComplete = (completedBill) => {
    const invoiceData = completedBill?.invoiceData || null;
    const charges = invoiceData?.charges || {};

    const finalizedInvoice = {
      ...completedBill,
      ...invoiceData,
      sessionCharge: Number(charges.sessionTotal || 0),
      foodCharge: Number(charges.cafeTotal || 0),
      total: Number(charges.grandTotal || 0),
      // `??`, not `||` — a birthday session legitimately earns exactly 0
      // points, and `||` would treat that 0 as "missing" and silently
      // recompute a nonzero fallback value instead of showing the real one.
      loyaltyPoints: Number(charges.loyaltyPoints ?? calculateLoyaltyPoints(charges.grandTotal || 0, pricingSettings)),
      invoice_no: invoiceData?.invoiceNumber || completedBill.invoice_no,
      invoiceId: invoiceData?._id || completedBill.invoiceId,
    };

    setBills((prevBills) => {
      const filtered = prevBills.filter((b) => b._id !== completedBill._id);
      return [completedBill, ...filtered];
    });
    setCheckoutBillId(null);
    setFinalInvoice(finalizedInvoice);
    loadRecentlyClosed();
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto space-y-6 lg:space-y-8 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div>
        <h1 className="text-[clamp(1.5rem,1vw+1.1rem,1.875rem)] font-semibold">Running Bills</h1>
        <p className="text-muted-foreground mt-1">
          Live unified bills - sessions, cafe and offers accrue together.
        </p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <h2 className="text-lg font-bold tracking-tight">
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
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 lg:gap-5">
            {booked.map((b) => (
              <BillCard
                key={b._id}
                bill={b}
                onPause={() => pause(b)}
                onResume={() => resume(b)}
                onCheckout={() => checkout(b)}
                onStart={() => startSession(b)}
                onExtend={() => extendHour(b)}
                onPauseChild={(index) => pauseChild(b, index)}
                onResumeChild={(index) => resumeChild(b, index)}
                onSettlePayment={(method) => settlePayment(b, method)}
                onCafeTotal={(bill) => setCafeOrdersBillId(bill._id)}
                onCancel={(bill) => setCancelTarget(bill)}
                pricingSettings={pricingSettings}
                kotsBySession={kotsBySession}
                highlighted={b._id === highlightId}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <h2 className="text-lg font-bold tracking-tight">
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
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 lg:gap-5">
            {running.map((b) => (
              <BillCard
                key={b._id}
                bill={b}
                onPause={() => pause(b)}
                onResume={() => resume(b)}
                onCheckout={() => checkout(b)}
                onStart={() => startSession(b)}
                onExtend={() => extendHour(b)}
                onPauseChild={(index) => pauseChild(b, index)}
                onResumeChild={(index) => resumeChild(b, index)}
                onSettlePayment={(method) => settlePayment(b, method)}
                onCafeTotal={(bill) => setCafeOrdersBillId(bill._id)}
                onCancel={(bill) => setCancelTarget(bill)}
                pricingSettings={pricingSettings}
                kotsBySession={kotsBySession}
                highlighted={b._id === highlightId}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">Recently closed</h2>
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Invoice</th>
                  <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                  <th className="text-left px-4 py-2.5 font-medium">Children</th>
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
                    onClick={() => openInvoice(b)}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-primary">
                      {b.invoice_no}
                    </td>
                    <td className="px-4 py-2.5">
                      {getDisplayName(b)}
                      <div className="text-xs text-muted-foreground">
                        {b.mobileNumber}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{b.children?.length ?? 0}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {b.closed_at ? new Date(b.closed_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(b?.invoiceData?.charges?.grandTotal || b?.charges?.grandTotal || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {checkoutBillId && (
        <CheckoutDialog
          billId={checkoutBillId}
          bills={bills}
          pricingSettings={pricingSettings}
          kotsBySession={kotsBySession}
          onClose={() => setCheckoutBillId(null)}
          onCompleted={handleCheckoutComplete}
        />
      )}
      <InvoiceDialog
        invoice={finalInvoice}
        onClose={() => setFinalInvoice(null)}
      />
      {cafeOrdersBillId && (
        <CafeOrdersDialog
          bill={bills.find((b) => b._id === cafeOrdersBillId)}
          kots={kotsBySession?.[cafeOrdersBillId] || []}
          onClose={() => setCafeOrdersBillId(null)}
          onChanged={loadSessions}
        />
      )}
      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel this session?"
        message="Are you sure you want to cancel this session?"
        confirmLabel="Cancel session"
        cancelLabel="Keep session"
        loading={cancelling}
        onCancel={() => !cancelling && setCancelTarget(null)}
        onConfirm={confirmCancelSession}
      />
    </div>
  );
}

export default SessionsPage;