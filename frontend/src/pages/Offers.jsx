
import * as React from "react";
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
        "relative inline-flex h-6 w-12 items-center rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted/20",
        className,
      )}
      {...props}
    >
      <span className={cn("pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform", checked ? "translate-x-5" : "translate-x-0")} />
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

const initialOffers = [
  {
    id: "offer-1",
    name: "Morning Rush",
    description: "20% off all hot drinks before 11am",
    type: "percent",
    value: 20,
    active: true,
  },
  {
    id: "offer-2",
    name: "Combo Treat",
    description: "Buy one snack + drink at ₹249",
    type: "combo",
    value: 249,
    active: false,
  },
  {
    id: "offer-3",
    name: "Flat Summer Deal",
    description: "₹50 off sandwiches and salads",
    type: "flat",
    value: 50,
    active: true,
  },
];

const iconByType = {
  flat: BadgeIndianRupee,
  percent: Percent,
  combo: Gift,
};

const typeLabel = {
  flat: "Flat ₹ off",
  percent: "% off",
  combo: "Combo",
};

function Offers() {
  const [offers, setOffers] = React.useState(initialOffers);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState("flat");
  const [value, setValue] = React.useState(0);
  const [message, setMessage] = React.useState("");

  const createOffer = () => {
    if (!name.trim() || value <= 0) {
      setMessage("Please provide a name and a valid value.");
      return;
    }

    const nextOffer = {
      id: `offer-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      type,
      value,
      active: true,
    };

    setOffers((current) => [nextOffer, ...current]);
    setOpen(false);
    setName("");
    setDescription("");
    setType("flat");
    setValue(0);
    setMessage("Offer created successfully.");
  };

  const toggleActive = (id) => {
    setOffers((current) =>
      current.map((offer) =>
        offer.id === id ? { ...offer, active: !offer.active } : offer,
      ),
    );
  };

  const removeOffer = (id) => {
    if (!window.confirm("Delete this offer?")) return;
    setOffers((current) => current.filter((offer) => offer.id !== id));
    setMessage("Offer removed.");
  };

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Offers</h1>
          <p className="text-muted-foreground mt-1">Create flat, percentage, or combo discounts for your cafe.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="h-11 px-6" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New offer
          </Button>
        </div>
      </div>

      {message && <div className="rounded-xl border border-input bg-muted/50 px-4 py-3 text-sm text-muted-foreground">{message}</div>}

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
                <div className="mt-5 text-3xl font-semibold text-foreground">
                  {offer.type === "percent" ? `${offer.value}%` : `₹${offer.value}`}
                </div>
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
        <DialogContent open={open} onOpenChange={setOpen}>
          <DialogHeader>
            <DialogTitle>Add new offer</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Festive Special" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={(value) => setType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat ₹ off</SelectItem>
                    <SelectItem value="percent">% off</SelectItem>
                    <SelectItem value="combo">Combo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{type === "percent" ? "Percent" : "Value (₹)"}</Label>
                <Input
                  type="number"
                  value={value}
                  onChange={(event) => setValue(Number(event.target.value))}
                  placeholder={type === "percent" ? "15" : "100"}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createOffer}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Offers;