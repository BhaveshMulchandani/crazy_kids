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
  Wand2,
} from "lucide-react";

// Mock data removed — Billing now uses backend session creation

const API_BASE =`${import.meta.env.VITE_API_URL}`;

// pricing settings are managed centrally; Billing only needs socks flag

// Helper function to calculate age in years
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
  const [parentName, setParentName] = useState("");
  const [mobile, setMobile] = useState("");
  const [children, setChildren] = useState([{ name: "", dob: "" }]);
  const [socks, setSocks] = useState(false);
  const [notes, setNotes] = useState("");
  const [bandNumber, setBandNumber] = useState("");
  const [offerId, setOfferId] = useState("none");
  const [offers, setOffers] = useState([]);
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

    loadOffers();
    return () => {
      mounted = false;
    };
  }, []);

  const addChild = () => {
    setChildren([...children, { name: "", dob: "" }]);
  };

  const removeChild = (i) => {
    setChildren(children.filter((_, idx) => idx !== i));
  };

  const updateChild = (i, patch) => {
    setChildren(children.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const findCustomer = () => {
    // TODO: implement backend customer search API
    toast.info("Customer search not implemented — TODO: backend search");
  };

  const submit = async () => {
    if (!parentName || !mobile) {
      toast.error("Parent name & mobile required");
      return;
    }

    const valid = children.filter((c) => c.name.trim() && c.dob);
    if (valid.length < 1) {
      toast.error("Add at least one child with DOB");
      return;
    }
    if (valid.length > 5) {
      toast.error("Max 5 children");
      return;
    }

    setSubmitting(true);

    try {
      // Build payload for backend session creation
      const validChildren = valid.map((c) => ({
        name: c.name.trim(),
        dob: c.dob,
      }));
      const payload = {
        parentName,
        mobileNumber: mobile,
        bandNumber,

        children: validChildren,

        offer: offerId === "none" ? null : offerId,

        reference,

        socksRequired: socks,

        notes,
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
    setLookup("");
    setChildren([{ name: "", dob: "" }]);
    setBandNumber("");
    setOfferId("none");
    setReference("");
    setSocks(false);
    setNotes("");
  };

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
          </div>
          <Button
            onClick={findCustomer}
            className="h-11 px-6"
            style={{ background: "var(--gradient-primary)" }}
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
          <div className="mt-3 text-xs text-muted-foreground">
            <span className="font-mono text-primary">
              {customer.customer_code}
            </span>{" "}
            · {customer.visit_count ?? 0} visits · ₹
            {Number(customer.total_spent ?? 0).toLocaleString()} spent ·{" "}
            {customer.reward_points ?? 0} pts
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 surface-card p-8 space-y-6">
          <div className="grid grid-cols-3 gap-5">
            <div className="space-y-2">
              <Label>Parent Name *</Label>
              <Input
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Riya Sharma"
              />
            </div>
            <div className="space-y-2">
              <Label>Mobile *</Label>
              <Input
                value={mobile}
                onChange={(e) =>
                  setMobile(e.target.value.replace(/\D/g, "").slice(0, 15))
                }
                placeholder="98XXXXXXXX"
              />
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
                return (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl bg-secondary/40 border"
                  >
                    <div className="col-span-5">
                      <Input
                        placeholder="Child name"
                        value={c.name}
                        onChange={(e) =>
                          updateChild(i, { name: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-4">
                      <Input
                        type="date"
                        value={c.dob}
                        onChange={(e) =>
                          updateChild(i, { dob: e.target.value })
                        }
                        max={new Date().toISOString().slice(0, 10)}
                      />
                    </div>
                    <div className="col-span-2 text-sm text-center">
                      {age !== null ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            age < 3
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              : "bg-primary/15 text-primary"
                          }`}
                        >
                          {age}y · {age < 3 ? "<3" : "3+"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
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
              <Label>Offer</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={offerId}
                onChange={(e) => setOfferId(e.target.value)}
              >
                <option value="none">No offer</option>
                {offers.length > 0 &&
                  offers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.name} ·{" "}
                      {offer.type === "percent"
                        ? `${offer.value}%`
                        : `₹${offer.value}`}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Booking reference"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Socks Required?</Label>
              <div className="h-10 flex items-center gap-3 px-4 rounded-lg border bg-secondary/50">
                <Switch
                  checked={socks}
                  onCheckedChange={setSocks}
                />
                <span className="text-sm">
                  {socks ? "Yes — added to bill" : "No"}
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
              <PlayCircle className="mr-2 h-4 w-4" />
              Book Session
            </Button>
            <Button variant="outline" onClick={reset} className="h-11">
              Reset
            </Button>
          </div>
        </div>

        <div className="surface-card p-8 sticky top-24 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <Wand2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">How billing works</h3>
          </div>
          <ol className="text-sm space-y-3 text-muted-foreground list-decimal pl-4">
            <li>
              <span className="text-foreground font-medium">Book session</span>{" "}
              — opens a running bill, timer begins.
            </li>
            <li>Charges accrue per child by age tier (under 3 / 3+).</li>
            <li>Add cafe items anytime — they join the same bill.</li>
            <li>Pause / resume freely. Paused time isn't charged.</li>
            <li>
              <span className="text-foreground font-medium">Checkout</span> on
              the Sessions screen — one final invoice.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default BillingPage;
