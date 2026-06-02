import * as React from "react";
import { Plus, Pencil, Trash2, UtensilsCrossed, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";

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
      <ChevronDown className="h-4 w-4 opacity-50" />
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
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground",
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
});
SelectItem.displayName = "SelectItem";

const DialogContext = React.createContext(null);

const Dialog = ({ open, onOpenChange, children }) => (
  <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
);

const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const ctx = React.useContext(DialogContext);
  if (!ctx?.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/70" onClick={() => ctx.onOpenChange?.(false)} />
      <div
        ref={ref}
        className={cn(
          "relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border bg-background p-6 shadow-2xl",
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
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

const DialogFooter = ({ className, ...props }) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const CATS = ["drinks", "snacks", "desserts", "others"];

const DEFAULT_MENU = [
  { id: "1", name: "Espresso", category: "drinks", price: 120, image_url: "", available: true },
  { id: "2", name: "Cappuccino", category: "drinks", price: 150, image_url: "", available: true },
  { id: "3", name: "Sandwich", category: "snacks", price: 140, image_url: "", available: true },
  { id: "4", name: "French Fries", category: "snacks", price: 110, image_url: "", available: true },
  { id: "5", name: "Brownie", category: "desserts", price: 100, image_url: "", available: true },
  { id: "6", name: "Cookies", category: "desserts", price: 80, image_url: "", available: false },
];

const iconByCategory = {
  drinks: "🥤",
  snacks: "🍟",
  desserts: "🍰",
  others: "🍽️",
};

function ItemDialog({ open, setOpen, item, onSaved }) {
  const [form, setForm] = React.useState(item ?? {});

  if (!item) return null;

  const save = () => {
    if (!form.name) {
      toast.error("Name required");
      return;
    }
    onSaved(form);
    setOpen(false);
    toast.success("Saved");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.id ? "Edit item" : "Add menu item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category ?? "drinks"} onValueChange={(value) => setForm({ ...form, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATS.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Price (₹)</Label>
              <Input
                type="number"
                min={0}
                value={form.price ?? 0}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Image URL (optional)</Label>
            <Input value={form.image_url ?? ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.available ?? true} onCheckedChange={(value) => setForm({ ...form, available: value })} />
            <Label>Available</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} style={{ background: "var(--gradient-primary)" }}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Cafemenu() {
  const [items, setItems] = React.useState(DEFAULT_MENU);
  const [editing, setEditing] = React.useState(null);
  const [open, setOpen] = React.useState(false);

  const newItem = () => {
    setEditing({ name: "", category: "drinks", price: 0, image_url: "", available: true });
    setOpen(true);
  };

  const saveItem = (form) => {
    if (form.id) {
      setItems((prev) => prev.map((item) => (item.id === form.id ? { ...item, ...form } : item)));
    } else {
      setItems((prev) => [{ ...form, id: String(Date.now()) }, ...prev]);
    }
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    toast.success("Item removed");
  };

  const toggleAvailability = (item) => {
    setItems((prev) => prev.map((current) => (current.id === item.id ? { ...current, available: !current.available } : current)));
  };

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <UtensilsCrossed className="h-7 w-7 text-primary" /> Cafe Menu
          </h1>
          <p className="text-muted-foreground mt-1">Manage what the POS shows. Toggle availability or update price anytime.</p>
        </div>
        <Button onClick={newItem} style={{ background: "var(--gradient-primary)" }}>
          <Plus className="h-4 w-4 mr-2" /> Add item
        </Button>
      </div>

      <div className="space-y-6">
        {CATS.map((catKey) => {
          const list = items.filter((item) => item.category === catKey);
          if (list.length === 0) return null;
          return (
            <section key={catKey}>
              <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">{catKey}</h2>
              <div className="grid grid-cols-4 gap-4">
                {list.map((item) => (
                  <div key={item.id} className={cn("surface-card p-4 group", !item.available ? "opacity-60" : "")}> 
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 grid place-items-center mb-3 text-3xl">
                      {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-xl" /> : iconByCategory[item.category] || "🍽️"}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-sm text-primary font-medium">₹{Number(item.price)}</div>
                      </div>
                      <Switch checked={item.available} onCheckedChange={() => toggleAvailability(item)} />
                    </div>
                    <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                      <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(item); setOpen(true); }}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(item.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <ItemDialog key={editing?.id ?? "new"} open={open} setOpen={setOpen} item={editing} onSaved={saveItem} />
    </div>
  );
}

export default Cafemenu;
