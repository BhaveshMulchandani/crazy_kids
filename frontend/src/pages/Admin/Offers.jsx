import * as React from "react";
import axios from "axios";
import { BadgeIndianRupee, Gift, Percent, Plus, Trash2 } from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const buttonVariantClasses = {
  default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
  outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
};

const buttonSizeClasses = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  icon: "h-9 w-9",
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

const Input = React.forwardRef(({ className, type = "text", ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label ref={ref} className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />
));
Label.displayName = "Label";

const Switch = React.forwardRef(({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => {
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
          "relative h-6 w-11 rounded-full transition-colors",
          checked ? "bg-sky-600" : "bg-slate-300",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
            checked && "translate-x-5",
          )}
        />
      </button>
  );
});
Switch.displayName = "Switch";

const SelectContext = React.createContext(null);

const Select = ({ value, onValueChange, children, className, disabled, ...props }) => {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState({});
  const rootRef = React.useRef(null);

  const registerItem = React.useCallback((itemValue, label) => {
    setItems((prev) => (prev[itemValue] === label ? prev : { ...prev, [itemValue]: label }));
  }, []);

  const valueLabel = value != null ? items[value] ?? value : "";

  React.useEffect(() => {
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
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, registerItem, valueLabel, disabled }}>
      <div ref={rootRef} className={cn("relative inline-flex w-full", className)} {...props}>
        {children}
      </div>
    </SelectContext.Provider>
  );
};

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const ctx = React.useContext(SelectContext);
  return (
    <button
      type="button"
      ref={ref}
      disabled={ctx?.disabled}
      onClick={() => ctx?.setOpen?.((prev) => !prev)}
      className={cn(
        "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 text-sm shadow-sm ring-offset-background cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      <span className="h-4 w-4 opacity-50">▾</span>
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

const SelectValue = ({ placeholder }) => {
  const ctx = React.useContext(SelectContext);
  return <span>{ctx?.value ? ctx.valueLabel : placeholder}</span>;
};

const SelectContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const ctx = React.useContext(SelectContext);
  if (!ctx?.open) return null;
  return (
    <div ref={ref} className={cn("absolute left-0 top-full z-20 mt-2 min-w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md", className)} {...props}>
      <div className="p-1">{children}</div>
    </div>
  );
});
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef(({ className, children, value, ...props }, ref) => {
  const ctx = React.useContext(SelectContext);
  const label = typeof children === "string" ? children : "";

  React.useEffect(() => {
    ctx?.registerItem?.(value, label);
  }, [ctx, value, label]);

  const active = ctx?.value === value;
  return (
    <button
      type="button"
      ref={ref}
      onClick={() => {
        ctx?.onValueChange?.(value);
        ctx?.setOpen?.(false);
      }}
      className={cn(
        "relative flex w-full cursor-default select-none items-center justify-between rounded-sm py-2 pl-2 pr-8 text-sm outline-none transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {active && <span className="absolute right-2 text-primary">✓</span>}
    </button>
  );
});
SelectItem.displayName = "SelectItem";

const Dialog = ({ children }) => <div>{children}</div>;

const DialogContent = React.forwardRef(({ open, onOpenChange, className, children, ...props }, ref) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange?.(false)} />
      <div
        ref={ref}
        className={cn("relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border bg-background p-6 shadow-2xl", className)}
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
  <div className={cn("flex flex-col gap-1 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn("text-xl font-semibold leading-none tracking-tight", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

const DialogFooter = ({ className, ...props }) => (
  <div className={cn("mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:items-center sm:gap-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const API_BASE = "http://localhost:3000";

const iconByType = {
  membership: Gift,
  discount: Percent,
  special_pricing: BadgeIndianRupee,
};

const typeLabel = {
  membership: "Membership",
  discount: "Percentage Discount",
  special_pricing: "Special Pricing",
};

const defaultRulesByType = {
  membership: {
    kidsAllowed: 1,
    playHours: 12,
    bonusHours: 0,
    validityMonths: 3,
    benefits: ["Free Birthday Entry", "Welcome Drink"],
  },
  discount: {
    minKids: 5,
  },
  special_pricing: {
    day: "Wednesday",
    firstHourPrice: 350,
    nextHourPrice: 150,
  },
};

const offerTypeOptions = [
  { value: "membership", label: "Membership" },
  { value: "discount", label: "Percentage Discount" },
  { value: "special_pricing", label: "Special Pricing" },
];

const MembershipFields = ({ value, rules, setValue, setRules }) => (
  <div className="space-y-4">
    <div>
      <Label>Membership Price (₹)</Label>
      <Input
        type="number"
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        placeholder="4500"
      />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label>Kids Allowed</Label>
        <Input
          type="number"
          value={rules.kidsAllowed}
          onChange={(event) => setRules({ ...rules, kidsAllowed: Number(event.target.value) })}
          placeholder="1"
        />
      </div>
      <div>
        <Label>Play Hours</Label>
        <Input
          type="number"
          value={rules.playHours}
          onChange={(event) => setRules({ ...rules, playHours: Number(event.target.value) })}
          placeholder="12"
        />
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label>Bonus Hours</Label>
        <Input
          type="number"
          value={rules.bonusHours}
          onChange={(event) => setRules({ ...rules, bonusHours: Number(event.target.value) })}
          placeholder="0"
        />
      </div>
      <div>
        <Label>Validity (Months)</Label>
        <Input
          type="number"
          value={rules.validityMonths}
          onChange={(event) => setRules({ ...rules, validityMonths: Number(event.target.value) })}
          placeholder="3"
        />
      </div>
    </div>
    <div className="space-y-2 rounded-xl border border-input bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Benefits</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRules({ ...rules, benefits: [...(rules.benefits || []), ""] })}
        >
          Add Benefit
        </Button>
      </div>
      <div className="space-y-3">
        {(rules.benefits || []).map((benefit, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={benefit}
              onChange={(event) => {
                const nextBenefits = [...rules.benefits];
                nextBenefits[index] = event.target.value;
                setRules({ ...rules, benefits: nextBenefits });
              }}
              placeholder="Free Birthday Entry"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => {
                const nextBenefits = [...rules.benefits];
                nextBenefits.splice(index, 1);
                setRules({ ...rules, benefits: nextBenefits });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const DiscountFields = ({ value, rules, setValue, setRules }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    <div>
      <Label>Discount Percentage</Label>
      <Input
        type="number"
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        placeholder="10"
      />
    </div>
    <div>
      <Label>Minimum Kids Required</Label>
      <Input
        type="number"
        value={rules.minKids}
        onChange={(event) => setRules({ ...rules, minKids: Number(event.target.value) })}
        placeholder="5"
      />
    </div>
  </div>
);

const SpecialPricingFields = ({ rules, setRules }) => (
  <div className="space-y-4">
    <div>
      <Label>Applicable Day</Label>
      <Input
        value={rules.day}
        onChange={(event) => setRules({ ...rules, day: event.target.value })}
        placeholder="Wednesday"
      />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label>First Hour Price (₹)</Label>
        <Input
          type="number"
          value={rules.firstHourPrice}
          onChange={(event) => setRules({ ...rules, firstHourPrice: Number(event.target.value) })}
          placeholder="350"
        />
      </div>
      <div>
        <Label>Additional Hour Price (₹)</Label>
        <Input
          type="number"
          value={rules.nextHourPrice}
          onChange={(event) => setRules({ ...rules, nextHourPrice: Number(event.target.value) })}
          placeholder="150"
        />
      </div>
    </div>
  </div>
);


function Offers() {
  const [offers, setOffers] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState("membership");
  const [value, setValue] = React.useState(4500);
  const [rules, setRules] = React.useState(defaultRulesByType.membership);
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const normalizeOffer = (offer) => ({
    ...offer,
    id: offer.id || offer._id,
  });

  const updateType = (nextType) => {
    setType(nextType);
    setRules(defaultRulesByType[nextType]);
    setValue(nextType === "discount" ? 10 : nextType === "membership" ? 4500 : 0);
  };

  const fetchOffers = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/offers`, {
        withCredentials: true,
      });
      const serverOffers = Array.isArray(response.data.offers)
        ? response.data.offers.map(normalizeOffer)
        : [];
      setOffers(serverOffers);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Unable to load offers.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    Promise.resolve().then(fetchOffers);
  }, [fetchOffers]);

  const createOffer = async () => {
    if (!name.trim() || (type !== "special_pricing" && value <= 0) || !type) {
      setMessage("Please provide an offer name, type, and valid values.");
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE}/offers/createoffer`,
        {
          name: name.trim(),
          description: description.trim(),
          type,
          value: type === "special_pricing" ? 0 : Number(value),
          rules,
          active: true,
        },
        {
          withCredentials: true,
        },
      );

      const nextOffer = normalizeOffer(response.data.offer);
      setOffers((current) => [nextOffer, ...current]);
      setOpen(false);
      setName("");
      setDescription("");
      setType("membership");
      setValue(4500);
      setRules(defaultRulesByType.membership);
      setMessage("Offer created successfully.");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Unable to create offer.");
    }
  };

  const toggleActive = async (id) => {
    try {
      const response = await axios.patch(
        `${API_BASE}/offers/${id}/toggle`,
        null,
        {
          withCredentials: true,
        },
      );
      const updated = normalizeOffer(response.data.offer);
      setOffers((current) =>
        current.map((offer) => (offer.id === updated.id ? updated : offer)),
      );
    } catch (error) {
      setMessage(error?.response?.data?.message || "Unable to update offer status.");
    }
  };

  const removeOffer = async (id) => {
    if (!window.confirm("Delete this offer?")) return;

    try {
      await axios.delete(`${API_BASE}/offers/${id}`, {
        withCredentials: true,
      });
      setOffers((current) => current.filter((offer) => offer.id !== id));
      setMessage("Offer removed.");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Unable to delete offer.");
    }
  };

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Offers</h1>
          <p className="text-muted-foreground mt-1">Create and manage Crazy Kids membership, discount, and special pricing offers.</p>
        </div>
        <div className="flex items-center gap-3 text-white">
          <Button className="h-11 px-6 bg-blue-600" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New offer
          </Button>
        </div>
      </div>

      {message && <div className="rounded-xl border border-input bg-muted/50 px-4 py-3 text-sm text-muted-foreground">{message}</div>}
      {loading && <div className="rounded-xl border border-input bg-muted/50 px-4 py-3 text-sm text-muted-foreground">Loading offers...</div>}

      <div className="grid gap-5 md:grid-cols-3">
        {offers.map((offer) => {
          const Icon = iconByType[offer.type] || BadgeIndianRupee;
          return (
            <div key={offer.id} className="surface-card p-6 hover-lift relative overflow-hidden rounded-3xl border border-border bg-background shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <Switch checked={offer.active} onCheckedChange={() => toggleActive(offer.id)} />
              </div>
              <div className="mt-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{typeLabel[offer.type]}</div>
                <div className="font-semibold text-lg mt-1">{offer.name}</div>
                {offer.description && <p className="text-sm text-muted-foreground mt-2">{offer.description}</p>}
                {offer.type === "membership" && (
                  <div className="mt-5 space-y-3 text-foreground">
                    <div className="text-3xl font-semibold">₹{offer.value}</div>
                    <div className="text-sm">Kids Allowed: {offer.rules.kidsAllowed}</div>
                    <div className="text-sm">Play Hours: {offer.rules.playHours}</div>
                    <div className="text-sm">Validity: {offer.rules.validityMonths} months</div>
                    {offer.rules.benefits?.length > 0 && (
                      <div className="space-y-1 rounded-xl bg-muted/10 p-3 text-sm">
                        <div className="font-medium">Benefits</div>
                        <ul className="list-disc pl-5">
                          {offer.rules.benefits.map((benefit, index) => (
                            <li key={index}>{benefit}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {offer.type === "discount" && (
                  <div className="mt-5 space-y-2 text-foreground">
                    <div className="text-3xl font-semibold">{offer.value}% off</div>
                    <div className="text-sm">Minimum Kids: {offer.rules.minKids}</div>
                  </div>
                )}
                {offer.type === "special_pricing" && (
                  <div className="mt-5 space-y-2 text-foreground">
                    <div className="text-3xl font-semibold">{offer.rules.day}</div>
                    <div className="text-sm">First Hour: ₹{offer.rules.firstHourPrice}</div>
                    <div className="text-sm">Additional Hour: ₹{offer.rules.nextHourPrice}</div>
                  </div>
                )}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <span className={cn(
                  "text-xs rounded-full px-2 py-1",
                  offer.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                )}
                >
                  {offer.active ? "Active" : "Inactive"}
                </span>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeOffer(offer.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent open={open} onOpenChange={setOpen} className="bg-white">
          <DialogHeader>
            <DialogTitle>Add new offer</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div>
              <Label>Offer Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Family Membership" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Offer Type</Label>
                <Select  value={type} onValueChange={updateType}>
                  <SelectTrigger >
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {offerTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {type === "membership" && (
              <MembershipFields value={value} rules={rules} setValue={setValue} setRules={setRules} />
            )}
            {type === "discount" && (
              <DiscountFields value={value} rules={rules} setValue={setValue} setRules={setRules} />
            )}
            {type === "special_pricing" && (
              <SpecialPricingFields rules={rules} setRules={setRules} />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createOffer} className="bg-blue-600 text-white">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Offers;