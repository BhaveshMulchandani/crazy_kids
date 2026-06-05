import * as React from "react";
import axios from "axios";
import {
  Award,
  Coffee,
  Loader2,
  Minus,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const buttonVariantClasses = {
  default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
  outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
  ghost: "bg-transparent hover:bg-accent/50",
};

const buttonSizeClasses = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  icon: "h-9 w-9 p-0",
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

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[2rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label ref={ref} className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />
));
Label.displayName = "Label";

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
          "relative z-10 w-full max-w-md overflow-hidden rounded-2xl border bg-background p-6 shadow-2xl",
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

const CATS = ["all", "drinks", "snacks", "desserts", "others"];

const MOCK_MENU = [
  { id: "m1", name: "Espresso", price: 120, category: "drinks", image_url: "", available: true },
  { id: "m2", name: "Cappuccino", price: 160, category: "drinks", image_url: "", available: true },
  { id: "m3", name: "Lemonade", price: 90, category: "drinks", image_url: "", available: true },
  { id: "m4", name: "French Fries", price: 110, category: "snacks", image_url: "", available: true },
  { id: "m5", name: "Veg Sandwich", price: 150, category: "snacks", image_url: "", available: true },
  { id: "m6", name: "Brownie", price: 130, category: "desserts", image_url: "", available: true },
  { id: "m7", name: "Cookies", price: 80, category: "desserts", image_url: "", available: true },
  { id: "m8", name: "Nachos", price: 170, category: "others", image_url: "", available: true },
];

const MOCK_CUSTOMERS = [
  { id: "c1", child_name: "Asha", parent_name: "Rita", mobile: "9800000001", customer_code: "C001", total_spent: 1200, reward_points: 30 },
  { id: "c2", child_name: "Rahul", parent_name: "Sunil", mobile: "9800000002", customer_code: "C002", total_spent: 300, reward_points: 10 },
  { id: "c3", child_name: "Isha", parent_name: "Amit", mobile: "9800000003", customer_code: "C003", total_spent: 450, reward_points: 18 },
];

const iconMap = {
  drinks: "🥤",
  snacks: "🍟",
  desserts: "🍰",
  others: "🍽️",
};

const toEmoji = (category) => iconMap[category] ?? "🍽️";

function findCustomerMock(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return MOCK_CUSTOMERS.find(
    (customer) =>
      customer.mobile === q ||
      customer.customer_code.toLowerCase() === q ||
      customer.parent_name.toLowerCase().includes(q) ||
      customer.child_name.toLowerCase().includes(q),
  );
}

function ReceiptDialog({ receipt, onClose }) {
  if (!receipt) return null;

  const print = () => {
    const w = window.open("", "_blank", "width=420,height=700");
    if (!w) return;
    const html = document.getElementById("cafe-receipt")?.innerHTML ?? "";
    w.document.write(`<html><head><title>Cafe Receipt</title><style>@page{size:80mm auto;margin:4mm} body{font-family:'Courier New',monospace;width:72mm;font-size:12px;color:#000;padding:8px}.row{display:flex;justify-content:space-between}.hr{border-top:1px dashed #000;margin:6px 0}.center{text-align:center}</style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Order placed</DialogTitle>
        </DialogHeader>
        <div id="cafe-receipt" style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#000", padding: 8 }}>
          <div className="text-center" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>PLAYKIT CAFE</div>
            <div>Order #{receipt.orderRef}</div>
            <div>{receipt.at.toLocaleString()}</div>
          </div>
          <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Cust</span>
            <span>{receipt.customer.child_name}</span>
          </div>
          <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Mob</span>
            <span>{receipt.customer.mobile}</span>
          </div>
          <div className="hr" />
          {receipt.items.map((item, index) => (
            <div key={index} style={{ marginBottom: 6 }}>
              <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{item.qty}× {item.name}</span>
                <span>₹{item.qty * item.price}</span>
              </div>
              {item.notes && <div style={{ fontSize: 11, color: "#444", paddingLeft: 8 }}>* {item.notes}</div>}
            </div>
          ))}
          <div className="hr" />
          <div className="row" style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
            <span>TOTAL</span>
            <span>₹{receipt.total}</span>
          </div>
          <div className="hr" />
          <div className="text-center">
            <div>+{receipt.points} reward points</div>
            <div style={{ marginTop: 4 }}>Thank you!</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={print} style={{ background: "var(--gradient-primary)" }}>
            <Printer className="h-4 w-4" /> Print receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Cafepos() {
  const [search, setSearch] = React.useState("");
  const [customerLookup, setCustomerLookup] = React.useState("");
  const [customer, setCustomer] = React.useState(null);
  const [cat, setCat] = React.useState("all");
  const [cart, setCart] = React.useState([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [receipt, setReceipt] = React.useState(null);
  const [menu, setMenu] = React.useState(MOCK_MENU);
  const [loadingMenu, setLoadingMenu] = React.useState(false);

  React.useEffect(() => {
    const fetchMenu = async () => {
      setLoadingMenu(true);
      try {
        const response = await axios.get("http://localhost:3000/menu/getall");
        const apiMenu = response?.data?.menu;
        if (Array.isArray(apiMenu)) {
          setMenu(
            apiMenu.map((item) => ({
              id: item._id ?? item.id,
              name: item.name,
              price: Number(item.price),
              category: item.category || "others",
              image_url: item.image || item.image_url || "",
              available: item.available ?? true,
            })),
          );
        } else {
          toast.error("Menu response was invalid");
        }
      } catch (error) {
        console.error("Failed to load menu", error);
        toast.error("Unable to load menu items");
      } finally {
        setLoadingMenu(false);
      }
    };

    fetchMenu();
  }, []);

  const availableMenu = React.useMemo(() => menu.filter((item) => item.available), [menu]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return availableMenu.filter((item) => (cat === "all" || item.category === cat) && (!q || item.name.toLowerCase().includes(q)));
  }, [availableMenu, search, cat]);

  const findCustomer = () => {
    const result = findCustomerMock(customerLookup);
    if (!result) {
      toast.error("No customer found");
      setCustomer(null);
      return;
    }
    setCustomer(result);
  };

  const add = (item) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.menu_id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { menu_id: item.id, name: item.name, price: Number(item.price), qty: 1 }];
    });
  };

  const setQty = (index, delta) =>
    setCart((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, qty: Math.max(1, item.qty + delta) } : item)),
    );

  const setNotes = (index, notes) =>
    setCart((prev) => prev.map((item, idx) => (idx === index ? { ...item, notes } : item)));

  const remove = (index) => setCart((prev) => prev.filter((_, idx) => idx !== index));

  const total = cart.reduce((sum, item) => sum + item.qty * item.price, 0);

  const submit = () => {
    if (!customer) {
      toast.error("Pick a customer first");
      return;
    }
    if (cart.length === 0) {
      toast.error("Add items to the cart");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const points = Math.floor(total / 50);
      const orderRef = `C-${String(Date.now()).slice(-6)}`;
      setReceipt({
        customer,
        items: cart,
        total,
        points,
        at: new Date(),
        orderRef,
      });
      setCart([]);
      setSubmitting(false);
      toast.success(`Order placed · ₹${total}`);
    }, 600);
  };

  return (
    <div className="space-y-5 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <Coffee className="h-7 w-7 text-primary" /> Cafe POS
          </h1>
          <p className="text-muted-foreground mt-1">Restaurant-style ordering — tap items to add.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 surface-card p-5 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search menu…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1 bg-secondary/60 p-1 rounded-xl">
              {CATS.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCat(category)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition",
                    cat === category ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {loadingMenu ? (
            <div className="text-center text-muted-foreground py-16">Loading menu...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">No items match.</div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => add(item)}
                  className="text-left surface-card p-3 hover:-translate-y-0.5 hover:shadow-lg transition-all border-2 border-transparent hover:border-primary/40"
                >
                  <div className="aspect-square rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 grid place-items-center mb-2 text-3xl">
                    {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-xl" /> : toEmoji(item.category)}
                  </div>
                  <div className="font-semibold text-sm leading-tight">{item.name}</div>
                  <div className="text-primary font-medium text-sm mt-0.5">₹{Number(item.price)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="surface-card p-4">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Customer</Label>
            <div className="mt-2 flex gap-2">
              <Input
                className="h-10"
                placeholder="Mobile or Customer ID"
                value={customerLookup}
                onChange={(e) => setCustomerLookup(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && findCustomer()}
              />
              <Button type="button" variant="outline" onClick={findCustomer}>Find</Button>
            </div>
            {customer && (
              <div className="mt-3 rounded-xl border bg-secondary/40 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{customer.child_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {customer.mobile} · <span className="font-mono text-primary">{customer.customer_code}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => setCustomer(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-center text-xs">
                  <div className="bg-card rounded p-1.5">
                    <div className="text-muted-foreground">Spent</div>
                    <div className="font-semibold">₹{Number(customer.total_spent).toLocaleString()}</div>
                  </div>
                  <div className="bg-card rounded p-1.5">
                    <div className="text-muted-foreground flex items-center justify-center gap-1">
                      <Award className="h-3 w-3" /> Points
                    </div>
                    <div className="font-semibold">{customer.reward_points ?? 0}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="surface-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Cart</h3>
              <span className="text-xs text-muted-foreground">{cart.length} item{cart.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-2 max-h-80 overflow-auto">
              {cart.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Tap items to add.</div>}
              {cart.map((item, index) => (
                <div key={item.menu_id} className="rounded-xl border p-3 bg-secondary/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">₹{item.price} × {item.qty} = ₹{item.price * item.qty}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(index, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                      <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(index, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(index)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    className="mt-2 h-16 text-xs"
                    placeholder="Notes (no sugar, extra cheese…)"
                    value={item.notes ?? ""}
                    onChange={(e) => setNotes(index, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-2xl font-semibold gradient-text">₹{total.toLocaleString()}</span>
            </div>
            <Button
              type="button"
              onClick={submit}
              disabled={submitting || cart.length === 0 || !customer}
              className="w-full mt-3 h-11"
              style={{ background: "var(--gradient-primary)" }}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Place order
            </Button>
          </div>
        </div>
      </div>

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

export default Cafepos;
