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
} from "lucide-react";

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
    if (!child?.name?.trim() || !child?.dob) return total;

    const age = ageInYears(child.dob);
    const isUnder3 = age !== null && age < 3;
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
  const [children, setChildren] = useState([{ name: "", dob: "", gender: "not_specified", socksOpted: false }]);
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
  const [amountPaid, setAmountPaid] = useState("");
  const [errors, setErrors] = useState({});

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
          setOffers(
            data.map((offer) => ({
              ...offer,
              id: offer.id || offer._id,
            })),
          );
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
    setChildren([...children, { name: "", dob: "", gender: "not_specified", socksOpted: false }]);
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
      gender: child.gender || "not_specified",
      socksOpted: false,
    }));

    setChildren(mappedChildren.length ? mappedChildren : [{ name: "", dob: "", gender: "not_specified", socksOpted: false }]);
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

    if (!parentName.trim()) {
      nextErrors.parentName = "Parent name is required";
    }

    if (!mobile.trim()) {
      nextErrors.mobile = "Mobile number is required";
    } else if (mobile.trim().length < 10) {
      nextErrors.mobile = "Mobile number must be at least 10 digits";
    }

    if (!area.trim()) {
      nextErrors.area = "Area is required";
    }

    if (!city.trim()) {
      nextErrors.city = "City is required";
    }

    const validChildren = children.filter((child) => child.name.trim() && child.dob);
    if (validChildren.length < 1) {
      nextErrors.children = "Add at least one child with name and DOB";
    } else {
      children.forEach((child, index) => {
        if (!child.name.trim()) {
          nextErrors[`child-${index}-name`] = "Child name is required";
        }
        if (!child.dob) {
          nextErrors[`child-${index}-dob`] = "Child DOB is required";
        }
      });
    }

    const selectedMembershipPlan = membershipPlanId === "none"
      ? null
      : offers.find((offer) => offer.id === membershipPlanId);
    const membershipForValidation = membership || selectedMembershipPlan;
    if (membershipForValidation && validChildren.length) {
      const childKey = (child) => `${child.name.trim().toLowerCase()}|${new Date(child.dob).toISOString().slice(0, 10)}`;
      const registeredChildren = membership?.registeredChildren || [];
      const registeredKeys = new Set(registeredChildren.map(childKey));
      const newChildren = new Set(validChildren.map(childKey).filter((key) => !registeredKeys.has(key)));
      const kidsAllowed = Number(membershipForValidation.kidsAllowed ?? membershipForValidation.rules?.kidsAllowed ?? 0);
      if (registeredChildren.length + newChildren.size > kidsAllowed) {
        nextErrors.children = "Membership child limit reached.";
      }
    }

    if (paymentStatus === "paid") {
      if (!amountPaid || Number(amountPaid) <= 0) {
        nextErrors.amountPaid = "Amount paid is required";
      }
    }

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
      const validChildrenPayload = validChildren
        .filter((c) => c.name.trim() && c.dob)
        .map((c) => ({
          name: c.name.trim(),
          dob: c.dob,
          gender: c.gender || "not_specified",
          socksOpted: Boolean(c.socksOpted),
        }));

      const sessionCharge = calculateEstimatedSessionCharge(
        validChildrenPayload,
        pricingSettings,
      );
      const paidAmount =
        paymentStatus === "paid"
          ? Number(amountPaid) || sessionCharge.total
          : paymentStatus === "partially_paid"
            ? paymentBreakdown.reduce(
                (sum, entry) => sum + (Number(entry.amount) || 0),
                0,
              )
            : 0;
      const balanceAmount = Math.max(sessionCharge.total - paidAmount, 0);

      const payload = {
        parentName,
        mobileNumber: mobile,
        area,
        city,
        bandNumber,

        children: validChildrenPayload,

        offer: offerId === "none" ? null : offerId,
        purchaseMembershipPlan: membershipPlanId === "none" ? null : membershipPlanId,

        reference,

        socksRequired: validChildrenPayload.some((c) => c.socksOpted),

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
    setChildren([{ name: "", dob: "", gender: "not_specified", socksOpted: false }]);
    setBandNumber("");
    setOfferId("none");
    setMembershipPlanId("none");
    setMembership(null);
    setReference("");
    setNotes("");
    setPaymentStatus("pending");
    setPaymentMethod("cash");
    setPaymentBreakdown([{ method: "cash", amount: "" }]);
    setAmountPaid("");
    setErrors({});
  };

  // Only clears the search box/results and the "matched customer" indicator
  // — unlike reset(), it must NOT wipe parentName/mobile/city/children etc,
  // since those may have already been filled in (via a search match or by
  // hand) and the operator is just dismissing the search UI, not starting
  // the whole form over.
  const clearSearch = () => {
    setLookup("");
    setSearchResults([]);
    setCustomer(null);
  };

  const validChildren = children.filter((c) => c.name.trim() && c.dob);
  const estimatedCharge = calculateEstimatedSessionCharge(
    validChildren,
    pricingSettings,
  );

  return (
    <div className="space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-semibold">Start New Session</h1>
        <p className="text-muted-foreground mt-1">
          Open a running bill for a family. Charges accrue live until checkout.
        </p>
      </div>

      <div className="surface-card p-5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Returning customer? Find them
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
                        {result.parentName}
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
            className="h-11 px-6"
            style={{ background: "var(--primary)" }}
          >
            <Search className="h-4 w-4 mr-2" /> Find
          </Button>
          {customer && (
            <Button variant="outline" onClick={clearSearch} className="h-11">
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
          <div className="grid grid-cols-3 gap-5">
            <div className="space-y-2">
              <Label>Parent Name *</Label>
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
            <div className="space-y-2">
              <Label>Mobile *</Label>
              <Input
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value.replace(/\D/g, "").slice(0,11));
                  setErrors((prev) => ({ ...prev, mobile: "" }));
                }}
                className={errors.mobile ? "border-red-500" : ""}
                placeholder="98XXXXXXXX"
              />
              {errors.mobile && <p className="text-xs text-red-500">{errors.mobile}</p>}
            </div>
            <div className="space-y-2">
              <Label>Band Number (optional)</Label>
              <Input
                value={bandNumber}
                onChange={(e) => setBandNumber(e.target.value)}
                placeholder="Band number"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label>City *</Label>
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

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="flex items-center gap-1.5">
                <Baby className="h-3.5 w-3.5" /> Children
              </Label>
              <Button size="sm" variant="outline" onClick={addChild}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add child
              </Button>
            </div>
            <div className="space-y-2">
              {children.map((c, i) => {
                const age = c.dob ? ageInYears(c.dob) : null;
                const childNameError = errors[`child-${i}-name`];
                const childDobError = errors[`child-${i}-dob`];
                return (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl bg-secondary/40 border"
                  >
                    <div className="col-span-3">
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
                      <div className="col-span-3">
                        {isBirthdayToday(c.dob) && (
                          <div className="mb-2 rounded-md bg-pink-100 border border-pink-300 px-3 py-2 text-sm font-semibold text-pink-700">
                             🎉 Today is {c.name ? `${c.name}'s Birthday!` : "this child's Birthday!"}
                          </div>
                        )}

                        <Input
                          type="date"
                          value={c.dob}
                          onChange={(e) => {
                            updateChild(i, { dob: e.target.value });
                            setErrors((prev) => ({ ...prev, [`child-${i}-dob`]: "" }));
                          }}
                          className={childDobError ? "border-red-500" : ""}
                          max={new Date().toISOString().slice(0, 10)}
                        />
                        {childDobError && <p className="mt-1 text-xs text-red-500">{childDobError}</p>}
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
                    <div className="col-span-1 text-sm text-center">
                      {age !== null ? (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-full text-[10px] font-medium ${
                            age < 3
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              : "bg-primary/15 text-primary"
                          }`}
                        >
                          {age}y
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
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

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label>Purchase membership (optional)</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm" value={membershipPlanId} disabled={!!membership} onChange={(e) => setMembershipPlanId(e.target.value)}>
                <option value="none">{membership ? "Customer already has an active membership" : "No membership"}</option>
                {offers.filter((offer) => offer.type === "membership").map((offer) => <option key={offer.id} value={offer.id}>{offer.name} · ₹{offer.value}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Booking reference" />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Birthday, special request…"
              />
            </div>
          </div>

          {paymentStatus === "paid" && (
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label>Amount paid (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={amountPaid}
                  onChange={(e) => {
                    setAmountPaid(e.target.value);
                    setErrors((prev) => ({ ...prev, amountPaid: "" }));
                  }}
                  className={errors.amountPaid ? "border-red-500" : ""}
                  placeholder={estimatedCharge.total.toString()}
                />
                {errors.amountPaid && <p className="text-xs text-red-500">{errors.amountPaid}</p>}
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
              className="h-11 px-8"
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
