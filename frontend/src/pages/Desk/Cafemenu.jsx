import axios from "axios";
import React, {
  useCallback,
  useEffect,
  useState,
  useRef,
  useContext,
} from "react";
import {
  Plus,
  Pencil,
  Trash2,
  UtensilsCrossed,
  ChevronDown,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "../../components/ConfirmDialog";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const buttonVariantClasses = {
  default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
  outline:
    "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
};

const buttonSizeClasses = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  icon: "h-9 w-9",
};

const Button = React.forwardRef(
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
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
        buttonVariantClasses[variant],
        buttonSizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

const Input = React.forwardRef(
  ({ className, type = "text", ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

const Label = React.forwardRef(({ className, ...props }, ref) => (
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

const Switch = React.forwardRef(
  ({ checked = false, onCheckedChange, disabled, ...props }, ref) => {
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
  },
);
Switch.displayName = "Switch";

const SelectContext = React.createContext(null);

const Select = ({
  value,
  onValueChange,
  children,
  className,
  disabled,
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

const SelectTrigger = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    const ctx = useContext(SelectContext);
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
  },
);
SelectTrigger.displayName = "SelectTrigger";

const SelectValue = ({ placeholder }) => {
  const ctx = useContext(SelectContext);
  return <span>{ctx?.value ? ctx.valueLabel : placeholder}</span>;
};

const SelectContent = React.forwardRef(
  ({ className, children, ...props }, ref) => {
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
        <div className="p-1">{children}</div>
      </div>
    );
  },
);
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef(
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
          "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none transition-colors",
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

const DialogContent = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    const ctx = useContext(DialogContext);
    if (!ctx?.open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div
          className="fixed inset-0 bg-black/70"
          onClick={() => ctx.onOpenChange?.(false)}
        />
        <div
          ref={ref}
          className={cn(
            "relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border bg-white p-6 shadow-2xl",
            className,
          )}
          onClick={(event) => event.stopPropagation()}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  },
);
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

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
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

const CATS = ["drinks", "snacks", "desserts", "others"];

const iconByCategory = {
  drinks: "🥤",
  snacks: "🍟",
  desserts: "🍰",
  others: "🍽️",
};

function ItemDialog({ open, setOpen, item, onSaved, setEditing }) {
  const [form, setForm] = useState(item ?? {});

  if (!item) return null;

  const save = async () => {
    if (!form.name) {
      toast.error("Name required");
      return;
    }

    const success = await onSaved({
      ...form,
      price: Number(form.price),
      image: form.image ?? "",
      category: form.category ?? "drinks",
      available: form.available ?? true,
    });

    if (success) {
      setForm({
        name: "",
        category: "drinks",
        price: 0,
        image: "",
        available: true,
      });

      setOpen(false);
      setEditing?.(null);

      toast.success("Saved");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item._id ? "Edit item" : "Add menu item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name ?? ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category ?? "drinks"}
                onValueChange={(value) => setForm({ ...form, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-white">
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
                onChange={(e) =>
                  setForm({ ...form, price: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Image URL (optional)</Label>
            <Input
              value={form.image ?? ""}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={form.available ?? true}
              onCheckedChange={(value) =>
                setForm({ ...form, available: value })
              }
            />
            <Label>Available</Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setForm({
                name: "",
                category: "drinks",
                price: 0,
                image: "",
                available: true,
              });
              setOpen(false);
              setEditing?.(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={save}
            style={{ background: "var(--primary)" }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Cafemenu() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMenus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/menu/getall`);
      setItems(response.data?.menu ?? []);
    } catch (error) {
      console.error(error);
      toast.error(
        error?.response?.data?.message || "Unable to load menu items.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchMenus();
    };

    load();
  }, [fetchMenus]);

  const newItem = () => {
    setEditing(null);

    setEditing({
      name: "",
      category: "drinks",
      price: 0,
      image: "",
      available: true,
    });
    setOpen(true);
  };

  const saveItem = async (form) => {
    try {
      if (form._id) {
        await axios.put(
          `${import.meta.env.VITE_API_URL}/menu/update/${form._id}`,
          {
            name: form.name,
            category: form.category,
            price: Number(form.price),
            image: form.image ?? "",
            available: Boolean(form.available),
          },
          {
            withCredentials: true,
          },
        );
      } else {
        const payload = {
          name: form.name,
          category: form.category,
          price: Number(form.price),
        };

        if (form.image) {
          payload.image = form.image;
        }

        await axios.post(`${import.meta.env.VITE_API_URL}/menu/create`, payload, {
          withCredentials: true,
        });
      }
      setEditing(null);
      await fetchMenus();
      return true;
    } catch (error) {
      console.error(error);
      toast.error(
        error?.response?.data?.message ||
          "Unable to save menu item. Please try again.",
      );
      return false;
    }
  };

  const confirmRemoveItem = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/menu/delete/${deleteTarget._id}`,
        { withCredentials: true },
      );
      await fetchMenus();
      toast.success("Item removed");
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      toast.error(
        error?.response?.data?.message ||
          "Unable to remove menu item. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const toggleAvailability = async (item) => {
    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/menu/update/${item._id}`,
        {
          name: item.name,
          category: item.category,
          price: Number(item.price),
          image: item.image ?? "",
          available: !item.available,
        },
        {
          withCredentials: true,
        },
      );
      await fetchMenus();
      toast.success(
        `Item ${!item.available ? "enabled" : "disabled"} successfully`,
      );
    } catch (error) {
      console.error(error);
      toast.error(
        error?.response?.data?.message ||
          "Unable to update availability. Please try again.",
      );
    }
  };

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <UtensilsCrossed className="h-7 w-7 text-primary" /> Cafe Menu
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage what the POS shows. Toggle availability or update price
            anytime.
          </p>
        </div>
        <Button
          onClick={newItem}
          style={{ background: "var(--primary)" }}
          className="text-white"
        >
          <Plus className="h-4 w-4 mr-2" /> Add item
        </Button>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-muted-foreground">
            Loading menu...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-muted-foreground">
            No menu items found.
          </div>
        ) : (
          CATS.map((catKey) => {
            const list = items.filter((item) => item.category === catKey);
            if (list.length === 0) return null;
            return (
              <section key={catKey}>
                <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
                  {catKey}
                </h2>
                <div className="grid grid-cols-4 gap-4">
                  {list.map((item) => (
                    <div
                      key={item._id}
                      className={cn(
                        "surface-card p-4 group",
                        !item.available ? "opacity-70 grayscale" : "",
                      )}
                    >
                      <div className="aspect-square rounded-xl bg-secondary/50 grid place-items-center mb-3 text-3xl">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          iconByCategory[item.category] || "🍽️"
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{item.name}</div>
                          <div className="text-sm text-primary font-medium">
                            ₹{Number(item.price)}
                          </div>
                        </div>
                        <Switch
                          checked={item.available}
                          onCheckedChange={() => toggleAvailability(item)}
                        />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={!item.available}
                          onClick={() => {
                            setEditing(item);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={!item.available}
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      <ItemDialog
        key={editing?._id ?? "new"}
        open={open}
        setOpen={setOpen}
        item={editing}
        onSaved={saveItem}
        setEditing={setEditing}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this menu item?"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" will be removed from the cafe menu. Existing orders are not affected.`
            : ""
        }
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmRemoveItem}
      />
    </div>
  );
}

export default Cafemenu;
