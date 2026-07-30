// export default BillingPage;
import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  PlayCircle,
  Loader2,
  Search,
  Plus,
  X,
  Baby,
  UsersRound,
} from "lucide-react";
import { getDisplayName } from "../../utils/customerDisplay";

// Mock data removed — Billing now uses backend session creation

const API_BASE = `${import.meta.env.VITE_API_URL}`;

// pricing settings are managed centrally; Billing only needs socks flag

// Helper function to calculate age in years

const isBirthdayToday = (dob) => {
  if (!dob) return false;

  const today = new Date();
  const birthDate = new Date(dob);

  return (
    today.getDate() === birthDate.getDate() &&
    today.getMonth() === birthDate.getMonth()
  );
};

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

const calculateEstimatedSessionCharge = (children, pricingSettings) => {
  const subtotal = (children || []).reduce((total, child) => {
    if (!child?.name?.trim()) return total;

    // Pricing bracket comes from the operator-selected Age Category, not
    // DOB — mirrors billing.service.js.
    const isUnder3 = child?.ageCategory === "below_3";
    const firstHourRate = isUnder3
      ? Number(pricingSettings?.firstHourUnder3 ?? 0)
      : Number(pricingSettings?.firstHourAbove3 ?? 0);
    const extensionRate = isUnder3
      ? Number(pricingSettings?.extensionUnder3 ?? 0)
      : Number(pricingSettings?.extensionAbove3 ?? 0);
    const hours = 1;

    return total + firstHourRate + Math.max(hours - 1, 0) * extensionRate;
  }, 0);

  const socksQty = (children || []).filter((child) => child?.socksOpted).length;
  const socksTotal = socksQty * Number(pricingSettings?.socksCost ?? 0);

  return {
    total: subtotal + socksTotal,
    socksQty,
    socksTotal,
  };
};

// Finds today's active day-based offer (e.g. "Wow Wednesday", a
// special_pricing offer with rules.day set) so it can be pre-selected
// without the operator having to remember to pick it manually. Mirrors the
// day-match check billing.service.js runs at checkout.
const getDayOfferId = (offerList) => {
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
  const dayOffer = (offerList || []).find(
    (offer) =>
      offer.active !== false &&
      offer.type !== "membership" &&
      String(offer.rules?.day || "").toLowerCase() === today.toLowerCase(),
  );
  return dayOffer ? dayOffer.id : null;
};

// Mirrors billing.service.js's group-booking branch: priced purely from the
// above/below-3 headcount (no per-child names/DOB collected for a group), at
// the booking's starting 1 hour. Socks are a single group-wide headcount too
// (not a per-child opt-in) — same existing socksCost rate as normal bookings.
const calculateEstimatedGroupCharge = (group, pricingSettings) => {
  const aboveCount = Number(group?.aboveThreeCount) || 0;
  const belowCount = Number(group?.belowThreeCount) || 0;
  const firstHourAbove3 = Number(pricingSettings?.firstHourAbove3 ?? 0);
  const firstHourUnder3 = Number(pricingSettings?.firstHourUnder3 ?? 0);

  const socksQty = Number(group?.socksRequired) || 0;
  const socksTotal = socksQty * Number(pricingSettings?.socksCost ?? 0);

  return {
    total: aboveCount * firstHourAbove3 + belowCount * firstHourUnder3 + socksTotal,
    socksQty,
    socksTotal,
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

const Switch = ({ checked = false, onCheckedChange, disabled, ...props }) => {
  const handleClick = () => {
    if (disabled) return;
    onCheckedChange?.(!checked);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      className={`relative inline-flex h-5 w-9 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-blue-600" : "bg-gray-200"}`}
      {...props}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
};

function BillingPage() {
  const [lookup, setLookup] = useState("");
  const [customer, setCustomer] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [parentName, setParentName] = useState("");
  const [mobile, setMobile] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [children, setChildren] = useState([{ name: "", dob: "", ageCategory: "", gender: "not_specified", socksOpted: false }]);
  const [notes, setNotes] = useState("");
  const [bandNumber, setBandNumber] = useState("");
  const [offerId, setOfferId] = useState("none");
  const [membershipPlanId, setMembershipPlanId] = useState("none");
  const [membership, setMembership] = useState(null);
  const [offers, setOffers] = useState([]);
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pricingSettings, setPricingSettings] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentBreakdown, setPaymentBreakdown] = useState([
    { method: "cash", amount: "" },
  ]);
  const [errors, setErrors] = useState({});
  const [isGroupBooking, setIsGroupBooking] = useState(false);
  const [isBirthdayGroupBooking, setIsBirthdayGroupBooking] = useState(false);
  const [groupRepresentativeChildName, setGroupRepresentativeChildName] = useState("");
  const [groupTotalChildren, setGroupTotalChildren] = useState("");
  const [groupAboveThreeCount, setGroupAboveThreeCount] = useState("");
  const [groupBelowThreeCount, setGroupBelowThreeCount] = useState("");
  const [groupSocksRequired, setGroupSocksRequired] = useState("");

  useEffect(() => {
    let mounted = true;
    const loadOffers = async () => {
      try {
        const response = await axios.get(`${API_BASE}/offers/active`, {
          withCredentials: true,
        });
        const data = Array.isArray(response.data.offers)
          ? response.data.offers
          : [];
        if (mounted) {
          const mapped = data.map((offer) => ({
            ...offer,
            id: offer.id || offer._id,
          }));
          setOffers(mapped);
          // Pre-select today's day-based offer (e.g. "Wow Wednesday") so the
          // operator doesn't have to remember to apply it manually. Still
          // just a default — the dropdown below remains fully editable.
          const dayOfferId = getDayOfferId(mapped);
          if (dayOfferId) setOfferId(dayOfferId);
        }
      } catch (error) {
        console.warn("Unable to load offers", error);
      }
    };

    const loadPricingSettings = async () => {
      try {
        const response = await axios.get(`${API_BASE}/price/prices`, {
          withCredentials: true,
        });
        if (mounted) {
          setPricingSettings(response.data || null);
        }
      } catch (error) {
        console.warn("Unable to load pricing settings", error);
      }
    };

    loadOffers();
    loadPricingSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const addChild = () => {
    setChildren([...children, { name: "", dob: "", ageCategory: "", gender: "not_specified", socksOpted: false }]);
  };

  const removeChild = (i) => {
    setChildren(children.filter((_, idx) => idx !== i));
  };

  const updateChild = (i, patch) => {
    setChildren(children.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const updateBreakdownItem = (index, patch) => {
    setPaymentBreakdown((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );
  };

  const addBreakdownItem = () => {
    setPaymentBreakdown((prev) => [...prev, { method: "cash", amount: "" }]);
  };

  const removeBreakdownItem = (index) => {
    setPaymentBreakdown((prev) => prev.filter((_, idx) => idx !== index));
  };

  const applyCustomer = (selectedCustomer) => {
    if (!selectedCustomer) return;

    setCustomer(selectedCustomer);
    setParentName(selectedCustomer.parentName || "");
    setMobile(selectedCustomer.mobileNumber || "");
    setArea(selectedCustomer.area || "");
    setCity(selectedCustomer.city || "");
    setBandNumber(selectedCustomer.bandNumber || "");
    setReference(selectedCustomer.reference || "");
    setNotes(selectedCustomer.notes || "");

    const mappedChildren = (selectedCustomer.children || []).map((child) => ({
      name: child.name || "",
      dob: child.dob ? new Date(child.dob).toISOString().slice(0, 10) : "",
      // Age Category is mandatory per session, not carried over from
      // historical customer records — the operator must (re)select it.
      ageCategory: "",
      gender: child.gender || "not_specified",
      socksOpted: false,
    }));

    setChildren(mappedChildren.length ? mappedChildren : [{ name: "", dob: "", ageCategory: "", gender: "not_specified", socksOpted: false }]);
    setSearchResults([]);
    setErrors((prev) => ({ ...prev, parentName: "", mobile: "", area: "", city: "" }));
    axios.get(`${API_BASE}/memberships/active/${encodeURIComponent(selectedCustomer.mobileNumber || "")}`, { withCredentials: true })
      .then((response) => {
        const activeMembership = response.data?.membership || null;
        setMembership(activeMembership);
        // Membership always overrides offers — don't leave a stale offer
        // selected once we know this customer already has an active one.
        if (activeMembership) setOfferId("none");
      })
      .catch(() => setMembership(null));
  };

  const findCustomer = async () => {
    const query = lookup.trim();
    if (!query) {
      toast.error("Enter a mobile number, parent name, or band number");
      return;
    }

    try {
      const response = await axios.get(`${API_BASE}/session/billing/search`, {
        params: { q: query },
        withCredentials: true,
      });

      const customers = response.data?.customers || [];
      setSearchResults(customers);

      if (customers.length === 0) {
        toast.info("No matching customer found");
        return;
      }

      toast.info(`Found ${customers.length} matching customer${customers.length === 1 ? "" : "s"}. Select one to apply.`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to search customer");
    }
  };

  const validateForm = () => {
    const nextErrors = {};

    // Parent/Guardian Name is optional — the customer falls back to their
    // first child's name wherever it would otherwise be displayed.

    if (!mobile.trim()) {
      nextErrors.mobile = "Mobile number is required";
    } else if (!/^\d{10}$/.test(mobile.trim())) {
      nextErrors.mobile = "Mobile number must be exactly 10 digits";
    }

    if (!area.trim()) {
      nextErrors.area = "Area is required";
    }

    // City is optional.

    if (isGroupBooking) {
      if (!parentName.trim() && !groupRepresentativeChildName.trim()) {
        nextErrors.groupRepresentativeChildName =
          "Parent/Guardian Name or Representative Child Name is required";
      }

      const total = Number(groupTotalChildren);
      const above = Number(groupAboveThreeCount);
      const below = Number(groupBelowThreeCount);

      if (!groupTotalChildren || !Number.isInteger(total) || total < 1) {
        nextErrors.groupTotalChildren = "Enter the total number of children";
      }
      if (groupAboveThreeCount === "" || !Number.isInteger(above) || above < 0) {
        nextErrors.groupAboveThreeCount = "Enter children above 3 years";
      }
      if (groupBelowThreeCount === "" || !Number.isInteger(below) || below < 0) {
        nextErrors.groupBelowThreeCount = "Enter children below 3 years";
      }
      if (
        !nextErrors.groupTotalChildren &&
        !nextErrors.groupAboveThreeCount &&
        !nextErrors.groupBelowThreeCount &&
        above + below !== total
      ) {
        nextErrors.groupAboveThreeCount = "Above 3 + Below 3 must equal the total number of children";
      }

      // Socks Required is optional (defaults to 0 — a group doesn't have to
      // need socks at all), but if entered it must be a valid, non-negative
      // count that doesn't exceed the group's total headcount.
      if (groupSocksRequired !== "") {
        const socks = Number(groupSocksRequired);
        if (!Number.isInteger(socks) || socks < 0) {
          nextErrors.groupSocksRequired = "Socks required must be a whole number and cannot be negative";
        } else if (!nextErrors.groupTotalChildren && socks > total) {
          nextErrors.groupSocksRequired = "Socks required cannot be greater than the total number of children";
        }
      }
    } else {
      const validChildren = children.filter((child) => child.name.trim());
      if (validChildren.length < 1) {
        nextErrors.children = "Add at least one child with a name";
      } else {
        children.forEach((child, index) => {
          if (!child.name.trim()) {
            nextErrors[`child-${index}-name`] = "Child name is required";
          }
          if (
            child.name.trim() &&
            child.ageCategory !== "above_3" &&
            child.ageCategory !== "below_3"
          ) {
            nextErrors[`child-${index}-ageCategory`] = "Age Category is required";
          }
        });
      }

      const selectedMembershipPlan = membershipPlanId === "none"
        ? null
        : offers.find((offer) => offer.id === membershipPlanId);
      const membershipForValidation = membership || selectedMembershipPlan;
      if (membershipForValidation && validChildren.length) {
        const childKey = (child) => `${child.name.trim().toLowerCase()}|${child.dob ? new Date(child.dob).toISOString().slice(0, 10) : "no-dob"}`;
        const registeredChildren = membership?.registeredChildren || [];
        const registeredKeys = new Set(registeredChildren.map(childKey));
        const newChildren = new Set(validChildren.map(childKey).filter((key) => !registeredKeys.has(key)));
        const kidsAllowed = Number(membershipForValidation.kidsAllowed ?? membershipForValidation.rules?.kidsAllowed ?? 0);
        if (registeredChildren.length + newChildren.size > kidsAllowed) {
          nextErrors.children = "Membership child limit reached.";
        }
      }
    }

    // "Paid" no longer needs its own validation — the amount is always
    // auto-calculated from the session charges (see sessionOnlyAmount
    // below), never typed in, so it can't be missing/invalid.

    if (paymentStatus === "partially_paid") {
      const totalPaid = paymentBreakdown.reduce(
        (sum, entry) => sum + (Number(entry.amount) || 0),
        0,
      );
      if (totalPaid <= 0) {
        nextErrors.paymentBreakdown = "Add at least one payment split";
      }
    }

    return nextErrors;
  };

  const submit = async () => {
    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please complete the required fields");
      return;
    }

    setSubmitting(true);

    try {
      // `estimatedCharge` already branches on isGroupBooking (group headcount
      // vs. per-child pricing) — reused here so paidAmount/balance always
      // match whatever the operator saw on screen before submitting. "Paid"
      // always saves the session-only amount (see sessionOnlyAmount above),
      // never a manually-typed value.
      const paidAmount =
        paymentStatus === "paid"
          ? sessionOnlyAmount
          : paymentStatus === "partially_paid"
            ? paymentBreakdown.reduce(
                (sum, entry) => sum + (Number(entry.amount) || 0),
                0,
              )
            : 0;
      const balanceAmount = Math.max(estimatedCharge.total - paidAmount, 0);

      const sharedPayload = {
        parentName,
        mobileNumber: mobile,
        area,
        city,
        bandNumber,

        reference,

        notes,
        paymentStatus,
        paymentMethod: paymentStatus === "paid" ? paymentMethod : "cash",
        paymentBreakdown:
          paymentStatus === "partially_paid"
            ? paymentBreakdown
                .filter((entry) => Number(entry.amount) > 0)
                .map((entry) => ({
                  method: entry.method || "cash",
                  amount: Number(entry.amount) || 0,
                }))
            : paymentStatus === "paid"
              ? [{ method: paymentMethod, amount: paidAmount }]
              : [],
        amountPaid: paidAmount,
        balanceAmount,
      };

      const payload = isGroupBooking
        ? {
            ...sharedPayload,
            isGroupBooking: true,
            groupBooking: {
              isBirthday: isBirthdayGroupBooking,
              representativeChildName: groupRepresentativeChildName.trim(),
              totalChildren: Number(groupTotalChildren),
              aboveThreeCount: Number(groupAboveThreeCount),
              belowThreeCount: Number(groupBelowThreeCount),
              socksRequired: groupSocksRequired === "" ? 0 : Number(groupSocksRequired),
            },
            // Memberships aren't tracked per-child for a group booking —
            // see backend/controllers/session.controller.js.
            offer: offerId === "none" ? null : offerId,
            purchaseMembershipPlan: null,
            socksRequired: (groupSocksRequired === "" ? 0 : Number(groupSocksRequired)) > 0,
          }
        : {
            ...sharedPayload,
            children: validChildren
              .filter((c) => c.name.trim())
              .map((c) => ({
                name: c.name.trim(),
                dob: c.dob || null,
                ageCategory: c.ageCategory,
                gender: c.gender || "not_specified",
                socksOpted: Boolean(c.socksOpted),
              })),
            offer: offerId === "none" ? null : offerId,
            purchaseMembershipPlan: membershipPlanId === "none" ? null : membershipPlanId,
            socksRequired: validChildren.some((c) => c.socksOpted),
          };

      const resp = await axios.post(`${API_BASE}/session/create`, payload, {
        withCredentials: true,
      });

      toast.success(resp.data?.message || "Session created");
      reset();
    } catch (e) {
      const msg = e.response?.data?.message || "Failed to create session";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setCustomer(null);
    setParentName("");
    setMobile("");
    setArea("");
    setCity("");
    setLookup("");
    setSearchResults([]);
    setChildren([{ name: "", dob: "", ageCategory: "", gender: "not_specified", socksOpted: false }]);
    setBandNumber("");
    // Re-apply today's day-based offer default for the next booking, rather
    // than leaving it cleared to "none" — see loadOffers above.
    setOfferId(getDayOfferId(offers) || "none");
    setMembershipPlanId("none");
    setMembership(null);
    setReference("");
    setNotes("");
    setPaymentStatus("pending");
    setPaymentMethod("cash");
    setPaymentBreakdown([{ method: "cash", amount: "" }]);
    setErrors({});
    setIsGroupBooking(false);
    setIsBirthdayGroupBooking(false);
    setGroupRepresentativeChildName("");
    setGroupTotalChildren("");
    setGroupAboveThreeCount("");
    setGroupBelowThreeCount("");
    setGroupSocksRequired("");
  };

  const validChildren = children.filter((c) => c.name.trim());
  const estimatedCharge = isGroupBooking
    ? calculateEstimatedGroupCharge(
        {
          aboveThreeCount: groupAboveThreeCount,
          belowThreeCount: groupBelowThreeCount,
          socksRequired: groupSocksRequired,
        },
        pricingSettings,
      )
    : calculateEstimatedSessionCharge(validChildren, pricingSettings);

  // Booking-time "Paid" amount must reflect ONLY the initial Above/Below 3
  // Years session charges — never socks, cafe, extensions, or anything from
  // the running/checkout flow (those stay entirely as-is, computed live in
  // Runningbills.jsx). `estimatedCharge.total` already includes socksTotal
  // for both the individual and group branches, so subtracting it back out
  // leaves exactly the session-only amount for either booking type.
  //
  // Derived directly during render (not via a state-syncing effect) so the
  // "Paid" Amount field is always exactly the current session-only amount —
  // the operator never types it in, and it can never go stale.
  const sessionOnlyAmount = Math.max(
    Math.round((estimatedCharge.total - estimatedCharge.socksTotal) * 100) / 100,
    0,
  );

  return (
    <div className="w-full max-w-[1920px] mx-auto space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Start New Session</h1>
          <p className="text-muted-foreground mt-1">
            Open a running bill for a family. Charges accrue live until checkout.
          </p>
        </div>
        <button
          type="button"
          aria-pressed={isGroupBooking}
          onClick={() => {
            setIsGroupBooking(!isGroupBooking);
            setIsBirthdayGroupBooking(false);
            setErrors({});
          }}
          className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 ${
            isGroupBooking ? "bg-red-700 ring-2 ring-red-300" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          <UsersRound className="h-4 w-4" />
          {isGroupBooking ? "Group Booking: ON" : "Group Booking"}
        </button>
      </div>

      <div className="surface-card p-5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Returning customer? Find them
        </Label>
        <div className="mt-2 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-11"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="Mobile, Customer ID, Parent Name / Guardian Name, or Child Name"
              onKeyDown={(e) => e.key === "Enter" && findCustomer()}
            />
            {searchResults.length > 0 && (
              <div className="absolute z-10 mt-1.5 w-full rounded-lg border border-border bg-white shadow-lg overflow-hidden">
                {searchResults.map((result) => (
                  <button
                    key={result._id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-secondary/60 border-b border-border/60 last:border-b-0"
                    onClick={() => applyCustomer(result)}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">
                        {getDisplayName(result)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {result.mobileNumber}
                        {result.bandNumber ? ` · Band ${result.bandNumber}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-primary">Apply</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            onClick={findCustomer}
            className="h-11 px-6 text-white"
            style={{ background: "var(--primary)" }}
          >
            <Search className="h-4 w-4 mr-2" /> Find
          </Button>
          {customer && (
            <Button variant="outline" onClick={reset} className="h-11">
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>
        {customer && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono font-medium text-primary">
              {customer.customer_code}
            </span>
            <span>{customer.visit_count ?? 0} visits</span>
            <span>₹{Number(customer.total_spent ?? 0).toLocaleString()} spent</span>
            <span>{customer.reward_points ?? 0} pts</span>
          </div>
        )}
        {membership && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
            <div className="font-semibold text-blue-900">Active membership · {membership.planName}</div>
            <div className="mt-1 grid gap-1 sm:grid-cols-3">
              <span>Remaining: {membership.remainingPlayHours}h of {membership.totalPlayHours}h</span>
              <span>Used: {membership.usedPlayHours}h</span>
              <span>Valid until: {new Date(membership.expiryDate).toLocaleDateString()}</span>
            </div>
            <div className="mt-1">Kids allowed: {membership.kidsAllowed}{membership.benefits?.length ? ` · ${membership.benefits.join(", ")}` : ""}</div>
          </div>
        )}
      </div>

      <div className="gap-6">
        <div className="col-span-2 surface-card p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="space-y-2 min-w-0">
              <Label>Parent Name / Guardian Name</Label>
              <Input
                value={parentName}
                onChange={(e) => {
                  setParentName(e.target.value);
                  setErrors((prev) => ({ ...prev, parentName: "" }));
                }}
                className={errors.parentName ? "border-red-500" : ""}
                placeholder="Riya Sharma"
              />
              {errors.parentName && <p className="text-xs text-red-500">{errors.parentName}</p>}
            </div>
            <div className="space-y-2 min-w-0">
              <Label>Mobile *</Label>
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                  setErrors((prev) => ({ ...prev, mobile: "" }));
                }}
                className={errors.mobile ? "border-red-500" : ""}
                placeholder="98XXXXXXXX"
              />
              {errors.mobile && <p className="text-xs text-red-500">{errors.mobile}</p>}
            </div>
            <div className="space-y-2 min-w-0">
              <Label>Band Number (optional)</Label>
              <Input
                value={bandNumber}
                onChange={(e) => setBandNumber(e.target.value)}
                placeholder="Band number"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2 min-w-0">
              <Label>Area *</Label>
              <Input
                name="area"
                autoComplete="address-level3"
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  setErrors((prev) => ({ ...prev, area: "" }));
                }}
                className={errors.area ? "border-red-500" : ""}
                placeholder="Satellite"
              />
              {errors.area && <p className="text-xs text-red-500">{errors.area}</p>}
            </div>
            <div className="space-y-2 min-w-0">
              <Label>City</Label>
              <Input
                name="city"
                autoComplete="address-level2"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setErrors((prev) => ({ ...prev, city: "" }));
                }}
                className={errors.city ? "border-red-500" : ""}
                placeholder="Ahmedabad"
              />
              {errors.city && <p className="text-xs text-red-500">{errors.city}</p>}
            </div>
          </div>

          {isGroupBooking && (
            <p className="text-xs text-muted-foreground -mt-2">
              Large group (10-20+ kids) — booking by headcount instead of per-child entry. Use the Group Booking button above to switch back.
            </p>
          )}

          {isGroupBooking ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2 min-w-0">
                  <Label>Group Booking Type</Label>
                  <div className="flex items-stretch gap-1.5">
                    <button
                      type="button"
                      aria-pressed={!isBirthdayGroupBooking}
                      onClick={() => setIsBirthdayGroupBooking(false)}
                      className={`flex-1 min-w-0 rounded-md border px-3 py-2 text-xs font-semibold text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                        !isBirthdayGroupBooking
                          ? "border-blue-600 bg-blue-600 text-white shadow-md ring-2 ring-blue-200"
                          : "border-input bg-white text-foreground hover:border-primary/50 hover:bg-secondary/40"
                      }`}
                    >
                      Normal Group Booking
                    </button>
                    <button
                      type="button"
                      aria-pressed={isBirthdayGroupBooking}
                      onClick={() => setIsBirthdayGroupBooking(true)}
                      className={`flex-1 min-w-0 rounded-md border px-3 py-2 text-xs font-semibold text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                        isBirthdayGroupBooking
                          ? "border-blue-600 bg-blue-600 text-white shadow-md ring-2 ring-blue-200"
                          : "border-input bg-white text-foreground hover:border-primary/50 hover:bg-secondary/40"
                      }`}
                    >
                      🎂 Birthday Group Booking
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2 min-w-0">
                  <Label>Representative Child Name{parentName.trim() ? " (optional)" : " *"}</Label>
                  <Input
                    value={groupRepresentativeChildName}
                    onChange={(e) => {
                      setGroupRepresentativeChildName(e.target.value);
                      setErrors((prev) => ({ ...prev, groupRepresentativeChildName: "" }));
                    }}
                    className={errors.groupRepresentativeChildName ? "border-red-500" : ""}
                    placeholder="Used if no Parent/Guardian Name is given"
                  />
                  {errors.groupRepresentativeChildName && (
                    <p className="text-xs text-red-500">{errors.groupRepresentativeChildName}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-2 min-w-0">
                  <Label>Total Number of Children *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={groupTotalChildren}
                    onChange={(e) => {
                      setGroupTotalChildren(e.target.value);
                      setErrors((prev) => ({ ...prev, groupTotalChildren: "" }));
                    }}
                    className={errors.groupTotalChildren ? "border-red-500" : ""}
                    placeholder="15"
                  />
                  {errors.groupTotalChildren && <p className="text-xs text-red-500">{errors.groupTotalChildren}</p>}
                </div>
                <div className="space-y-2 min-w-0">
                  <Label>Children Above 3 Years *</Label>
                  <Input
                    type="number"
                    min="0"
                    value={groupAboveThreeCount}
                    onChange={(e) => {
                      setGroupAboveThreeCount(e.target.value);
                      setErrors((prev) => ({ ...prev, groupAboveThreeCount: "" }));
                    }}
                    className={errors.groupAboveThreeCount ? "border-red-500" : ""}
                    placeholder="8"
                  />
                  {errors.groupAboveThreeCount && <p className="text-xs text-red-500">{errors.groupAboveThreeCount}</p>}
                </div>
                <div className="space-y-2 min-w-0">
                  <Label>Children Below 3 Years *</Label>
                  <Input
                    type="number"
                    min="0"
                    value={groupBelowThreeCount}
                    onChange={(e) => {
                      setGroupBelowThreeCount(e.target.value);
                      setErrors((prev) => ({ ...prev, groupBelowThreeCount: "" }));
                    }}
                    className={errors.groupBelowThreeCount ? "border-red-500" : ""}
                    placeholder="7"
                  />
                  {errors.groupBelowThreeCount && <p className="text-xs text-red-500">{errors.groupBelowThreeCount}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-2 min-w-0">
                  <Label>Socks Required (optional)</Label>
                  <Input
                    type="number"
                    min="0"
                    max={groupTotalChildren || undefined}
                    value={groupSocksRequired}
                    onChange={(e) => {
                      setGroupSocksRequired(e.target.value);
                      setErrors((prev) => ({ ...prev, groupSocksRequired: "" }));
                    }}
                    className={errors.groupSocksRequired ? "border-red-500" : ""}
                    placeholder="12"
                  />
                  {errors.groupSocksRequired && <p className="text-xs text-red-500">{errors.groupSocksRequired}</p>}
                </div>
                {Number(groupSocksRequired) > 0 && (
                  <div className="space-y-2 min-w-0 sm:col-span-2">
                    <Label>Socks Total</Label>
                    <div className="flex h-9 items-center rounded-md border border-input bg-secondary/30 px-3 text-sm text-muted-foreground">
                      {groupSocksRequired} × ₹{Number(pricingSettings?.socksCost ?? 0)} = ₹
                      {(Number(groupSocksRequired) * Number(pricingSettings?.socksCost ?? 0)).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="flex items-center gap-1.5">
                <Baby className="h-3.5 w-3.5" /> Children
              </Label>
              <Button size="sm" variant="outline" onClick={addChild}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add child
              </Button>
            </div>
            <div className="space-y-2 min-w-0">
              {children.map((c, i) => {
                const age = c.dob ? ageInYears(c.dob) : null;
                const childNameError = errors[`child-${i}-name`];
                const childDobError = errors[`child-${i}-dob`];
                const childAgeCategoryError = errors[`child-${i}-ageCategory`];
                return (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl bg-secondary/40 border"
                  >
                    <div className="col-span-2">
                      <Input
                        placeholder="Child name"
                        value={c.name}
                        onChange={(e) => {
                          updateChild(i, { name: e.target.value });
                          setErrors((prev) => ({ ...prev, [`child-${i}-name`]: "" }));
                        }}
                        className={childNameError ? "border-red-500" : ""}
                      />
                      {childNameError && <p className="mt-1 text-xs text-red-500">{childNameError}</p>}
                    </div>
                      <div className="col-span-2">
                        {isBirthdayToday(c.dob) && (
                          <div className="mb-2 rounded-md bg-pink-100 border border-pink-300 px-3 py-2 text-sm font-semibold text-pink-700">
                             🎉 Today is {c.name ? `${c.name}'s Birthday!` : "this child's Birthday!"}
                          </div>
                        )}

                        <Input
                          type="date"
                          value={c.dob}
                          onChange={(e) => {
                            const newDob = e.target.value;
                            const patch = { dob: newDob };
                            // Auto-pick the matching Age Category from the
                            // entered DOB — still just a starting value, the
                            // operator can click Above/Below 3y afterward to
                            // override it. Clearing the DOB leaves whatever
                            // Age Category is currently selected untouched.
                            if (newDob) {
                              const computedAge = ageInYears(newDob);
                              if (computedAge !== null) {
                                patch.ageCategory = computedAge < 3 ? "below_3" : "above_3";
                              }
                            }
                            updateChild(i, patch);
                            setErrors((prev) => ({
                              ...prev,
                              [`child-${i}-dob`]: "",
                              ...(patch.ageCategory ? { [`child-${i}-ageCategory`]: "" } : {}),
                            }));
                          }}
                          className={childDobError ? "border-red-500" : ""}
                          max={new Date().toISOString().slice(0, 10)}
                        />
                        {childDobError && <p className="mt-1 text-xs text-red-500">{childDobError}</p>}
                        {age !== null && (
                          <span
                            className={`mt-1 inline-flex items-center gap-1 px-1.5 py-1 rounded-full text-[10px] font-medium ${
                              age < 3
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                : "bg-primary/15 text-primary"
                            }`}
                          >
                            {age}y
                          </span>
                        )}
                      </div>
                    <div className="col-span-2">
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={c.gender || "not_specified"}
                        onChange={(e) => updateChild(i, { gender: e.target.value })}
                      >
                        <option value="boy">Boy</option>
                        <option value="girl">Girl</option>
                        <option value="not_specified">Not Specified</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      <div className="flex items-stretch gap-1.5">
                        <button
                          type="button"
                          aria-pressed={c.ageCategory === "above_3"}
                          onClick={() => {
                            updateChild(i, { ageCategory: "above_3" });
                            setErrors((prev) => ({ ...prev, [`child-${i}-ageCategory`]: "" }));
                          }}
                          className={`flex-1 min-w-0 rounded-md border px-2 py-2 text-xs font-semibold text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                            c.ageCategory === "above_3"
                              ? "border-blue-600 bg-blue-600 text-white shadow-md ring-2 ring-blue-200"
                              : `bg-white text-foreground hover:border-primary/50 hover:bg-secondary/40 ${
                                  childAgeCategoryError ? "border-red-500" : "border-input"
                                }`
                          }`}
                        >
                          Above 3y
                        </button>
                        <button
                          type="button"
                          aria-pressed={c.ageCategory === "below_3"}
                          onClick={() => {
                            updateChild(i, { ageCategory: "below_3" });
                            setErrors((prev) => ({ ...prev, [`child-${i}-ageCategory`]: "" }));
                          }}
                          className={`flex-1 min-w-0 rounded-md border px-2 py-2 text-xs font-semibold text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                            c.ageCategory === "below_3"
                              ? "border-blue-600 bg-blue-600 text-white shadow-md ring-2 ring-blue-200"
                              : `bg-white text-foreground hover:border-primary/50 hover:bg-secondary/40 ${
                                  childAgeCategoryError ? "border-red-500" : "border-input"
                                }`
                          }`}
                        >
                          Below 3y
                        </button>
                      </div>
                      {childAgeCategoryError && (
                        <p className="mt-1 text-[10px] text-red-500">{childAgeCategoryError}</p>
                      )}
                    </div>
                    <div className="col-span-2 flex items-center justify-center gap-1.5">
                      <Switch
                        checked={Boolean(c.socksOpted)}
                        onCheckedChange={(checked) => updateChild(i, { socksOpted: checked })}
                      />
                      <span className="text-xs text-muted-foreground">Socks</span>
                    </div>
                    <div className="col-span-1 text-right">
                      {children.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeChild(i)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2 min-w-0">
              <Label>Offer{membership ? " (unavailable — active membership applies)" : ""}</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={offerId}
                disabled={!!membership}
                onChange={(e) => setOfferId(e.target.value)}
              >
                <option value="none">No offer</option>
                {offers.length > 0 &&
                  offers.filter((offer) => offer.type !== "membership").map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.name} ·{" "}
                      {offer.type === "discount"
                        ? `${offer.value}%`
                        : `₹${offer.value}`}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2 min-w-0">
              <Label>Purchase membership{isGroupBooking ? " (unavailable for group bookings)" : " (optional)"}</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm" value={isGroupBooking ? "none" : membershipPlanId} disabled={isGroupBooking || !!membership} onChange={(e) => setMembershipPlanId(e.target.value)}>
                <option value="none">{membership ? "Customer already has an active membership" : "No membership"}</option>
                {offers.filter((offer) => offer.type === "membership").map((offer) => <option key={offer.id} value={offer.id}>{offer.name} · ₹{offer.value}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2 min-w-0">
            <Label>Reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Booking reference" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2 min-w-0">
              <Label>Payment status</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">Partially paid</option>
              </select>
            </div>
            <div className="space-y-2 min-w-0">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Birthday, special request…"
              />
            </div>
          </div>

          {paymentStatus === "paid" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2 min-w-0">
                <Label>Payment method</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2 min-w-0">
                <Label>Amount paid (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={sessionOnlyAmount}
                  disabled
                  readOnly
                  className="bg-secondary/30 text-black"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-calculated from session charges (excludes cafe, socks, and extensions)
                </p>
              </div>
            </div>
          )}

          {paymentStatus === "partially_paid" && (
            <div className="space-y-3 rounded-xl border bg-secondary/30 p-4">
              <div className="flex items-center justify-between">
                <Label>Payment splits</Label>
                <Button size="sm" variant="outline" onClick={addBreakdownItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add split
                </Button>
              </div>
              {paymentBreakdown.map((entry, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1.2fr_1fr_auto] gap-2"
                >
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={entry.method}
                    onChange={(e) =>
                      updateBreakdownItem(index, { method: e.target.value })
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                  <Input
                    type="number"
                    min="0"
                    value={entry.amount}
                    onChange={(e) =>
                      updateBreakdownItem(index, { amount: e.target.value })
                    }
                    placeholder="Amount"
                  />
                  {paymentBreakdown.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeBreakdownItem(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="text-xs text-muted-foreground">
                Paid: ₹
                {paymentBreakdown
                  .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
                  .toLocaleString()}{" "}
                · Pending: ₹
                {Math.max(
                  estimatedCharge.total -
                    paymentBreakdown.reduce(
                      (sum, entry) => sum + (Number(entry.amount) || 0),
                      0,
                    ),
                  0,
                ).toLocaleString()}
              </div>
              {errors.paymentBreakdown && <p className="text-xs text-red-500">{errors.paymentBreakdown}</p>}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={submit}
              disabled={submitting}
              className="h-11 px-8 text-white"
              style={{ background: "var(--primary)" }}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <PlayCircle className="mr-2 h-4 w-4" />
              Book Session
            </Button>
            <Button variant="outline" onClick={reset} className="h-11">
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BillingPage;
