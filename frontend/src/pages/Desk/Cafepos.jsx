import * as React from "react";
import axios from "axios";
import {
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
import { useLocation } from "react-router-dom";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="fixed inset-0 bg-black/70" onClick={() => ctx.onOpenChange?.(false)} />
      <div
        ref={ref}
        className={cn(
          "relative z-10 w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border bg-background p-6 shadow-2xl",
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

const iconMap = {
  drinks: "🥤",
  snacks: "🍟",
  desserts: "🍰",
  others: "🍽️",
};

const toEmoji = (category) => iconMap[category] ?? "🍽️";

function ReceiptDialog({ kot, customer, cartSnapshot, tableNumber, onClose }) {
  if (!kot) return null;

  const kotNumber = kot.kotNumber ?? kot._id ?? "—";
  const sessionNumber = customer?.sessionNumber ?? "—";
  const parentName = customer?.parentName ?? "—";
  const createdAt = kot.createdAt ? new Date(kot.createdAt) : new Date();
  const total = cartSnapshot.reduce((sum, item) => sum + item.qty * item.price, 0);

  const print = () => {
    const w = window.open("", "_blank", "width=420,height=700");
    if (!w) return;
    const html = document.getElementById("cafe-receipt")?.innerHTML ?? "";
    w.document.write(`<html><head><title>KOT ${kotNumber}</title><style>@page{size:80mm auto;margin:4mm} body{font-family:'Courier New',monospace;width:72mm;font-size:12px;color:#000;padding:8px}.row{display:flex;justify-content:space-between}.hr{border-top:1px dashed #000;margin:6px 0}.center{text-align:center}</style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  return (
    <Dialog open={!!kot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Order placed · KOT #{kotNumber}</DialogTitle>
        </DialogHeader>
        <div id="cafe-receipt" style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#000", padding: 8 }}>
          <div className="text-center" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>CRAZIKIDS CAFE</div>
            <div>KOT #{kotNumber}</div>
            <div>{createdAt.toLocaleString()}</div>
          </div>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Session</span>
            <span>{sessionNumber}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Customer</span>
            <span>{parentName}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Table</span>
            <span>{tableNumber || "—"}</span>
          </div>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          {cartSnapshot.map((item, index) => (
            <div key={index} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{item.qty}× {item.name}</span>
                <span>₹{item.qty * item.price}</span>
              </div>
              {item.notes && <div style={{ fontSize: 11, color: "#444", paddingLeft: 8 }}>* {item.notes}</div>}
            </div>
          ))}
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
            <span>TOTAL</span>
            <span>₹{total}</span>
          </div>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          <div style={{ textAlign: "center", marginTop: 4 }}>Thank you!</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={print} style={{ background: "var(--primary)" }}>
            <Printer className="h-4 w-4" /> Print KOT
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Cafepos() {
  const location = useLocation();
  const [search, setSearch] = React.useState("");
  const [customerLookup, setCustomerLookup] = React.useState("");
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [customer, setCustomer] = React.useState(null);
  const [customerSnapshot, setCustomerSnapshot] = React.useState(null);
  const [tableNumber, setTableNumber] = React.useState("");
  const [tableNumberSnapshot, setTableNumberSnapshot] = React.useState("");
  const [tableNumberError, setTableNumberError] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [cart, setCart] = React.useState([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [kot, setKot] = React.useState(null);
  const [cartSnapshot, setCartSnapshot] = React.useState([]);
  const [menu, setMenu] = React.useState([]);
  const [loadingMenu, setLoadingMenu] = React.useState(false);
  const preSelectedSession = location.state?.session;

  // Selecting a customer also autofills the Table Number: if this customer
  // already has a KOT on file for their current play session, they've
  // already been seated at a table — reuse it instead of making the
  // operator retype it for every additional round of orders.
  const applyCustomerSession = React.useCallback(async (session) => {
    if (!session) return;

    setCustomer(session);
    setSearchResults([]);
    setTableNumberError("");

    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/cafe/session/${session._id}`,
        { withCredentials: true },
      );
      const kots = res.data?.kots ?? [];
      setTableNumber(kots[0]?.tableNumber || "");
    } catch (error) {
      console.warn("Unable to fetch existing table number for session", error);
      setTableNumber("");
    }
  }, []);

  React.useEffect(() => {
    if (!preSelectedSession) return;

    applyCustomerSession(preSelectedSession);
    setCustomerLookup(preSelectedSession.parentName);
  }, [preSelectedSession, applyCustomerSession]);

  React.useEffect(() => {
    const fetchMenu = async () => {
      setLoadingMenu(true);
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/menu/getall`, { withCredentials: true });
        const apiMenu = response?.data?.menu ?? response?.data ?? [];
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

  const findCustomer = async () => {
    const q = customerLookup.trim();
    if (!q) {
      toast.error("Enter a mobile number, name, or band number");
      return;
    }
    setSearchLoading(true);
    setSearchResults([]);
    setCustomer(null);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/cafe/search?q=${encodeURIComponent(q)}`,
        { withCredentials: true },
      );
      const sessions = res.data.sessions ?? res.data ?? [];
      if (!Array.isArray(sessions) || sessions.length === 0) {
        toast.error("No session found");
        return;
      }
      if (sessions.length === 1) {
        applyCustomerSession(sessions[0]);
      } else {
        setSearchResults(sessions);
      }
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Search failed");
    } finally {
      setSearchLoading(false);
    }
  };

  const selectSession = (session) => {
    applyCustomerSession(session);
  };

  const add = (item) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.menu_id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { menu_id: item.id, name: item.name, price: Number(item.price), qty: 1, notes: "" }];
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

  const submit = async () => {
    if (!customer) {
      toast.error("Pick a customer first");
      return;
    }
    if (!tableNumber.trim()) {
      setTableNumberError("Table Number is required.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Add items to the cart");
      return;
    }

    setSubmitting(true);
    try {
      const items = cart.map((item) => ({
        menuItem: item.menu_id,
        quantity: item.qty,
        notes: item.notes ?? "",
      }));

      console.log("REQUEST PAYLOAD", {
  sessionId: customer._id,
  tableNumber: tableNumber.trim(),
  items,
});

      const createRes = await axios.post(
        `${import.meta.env.VITE_API_URL}/cafe/create`,
        {
          sessionId: customer._id,
          tableNumber: tableNumber.trim(),
          items,
        },
        { withCredentials: true },
      );

      console.log("REQUEST PAYLOAD", {
  sessionId: customer._id,
  tableNumber: tableNumber.trim(),
  items,
});

      const createdKot = createRes.data.kot ?? createRes.data;
      const kotId = createdKot._id;

      let fullKot = createdKot;
      try {
        const kotRes = await axios.get(`${import.meta.env.VITE_API_URL}/cafe/kot/${kotId}`, {
          withCredentials: true,
        });
        fullKot = kotRes.data.kot ?? kotRes.data ?? createdKot;
      } catch (err) {
        console.log("KOT fetch failed, using created data", err);
      }

      // Snapshot what the receipt dialog needs before clearing the form —
      // the dialog stays open (and must keep showing this order's customer
      // and table) even though the live fields below are reset for the
      // next order.
      setCartSnapshot([...cart]);
      setCustomerSnapshot(customer);
      setTableNumberSnapshot(tableNumber);
      setKot(fullKot);
      toast.success(`Order placed · ₹${total}`);

      setCart([]);
      setCustomer(null);
      setCustomerLookup("");
      setSearchResults([]);
      setTableNumber("");
      setTableNumberError("");
      setSearch("");
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto space-y-5 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <Coffee className="h-7 w-7 text-primary" /> Cafe POS
          </h1>
          <p className="text-muted-foreground mt-1">Restaurant-style ordering - tap items to add.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] gap-5">
        <div className="min-w-0 surface-card p-5 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search menu…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1 bg-secondary/60 p-1 rounded-xl">
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
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => add(item)}
                  className="text-left surface-card p-3 hover:-translate-y-0.5 hover:shadow-lg transition-all border-2 border-transparent hover:border-primary/40"
                >
                  <div className="aspect-square rounded-xl bg-secondary/50 grid place-items-center mb-2 text-3xl">
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
                placeholder="Mobile, name, or band no."
                value={customerLookup}
                onChange={(e) => { setCustomerLookup(e.target.value); setSearchResults([]); }}
                onKeyDown={(e) => e.key === "Enter" && findCustomer()}
              />
              <Button type="button" variant="outline" onClick={findCustomer} disabled={searchLoading}>
                {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
              </Button>
            </div>

            {searchResults.length > 1 && (
              <div className="mt-2 rounded-xl border bg-background shadow-md overflow-hidden">
                {searchResults.map((s) => (
                  <button
                    key={s._id}
                    type="button"
                    onClick={() => selectSession(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/60 border-b last:border-b-0"
                  >
                    <div className="font-medium">{s.parentName}</div>
                    <div className="text-xs text-muted-foreground">{s.mobileNumber} · {s.sessionNumber}</div>
                  </button>
                ))}
              </div>
            )}

            {customer && (
              <div className="mt-3 rounded-xl border bg-secondary/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{customer.parentName}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {customer.mobileNumber} · <span className="font-mono text-primary">{customer.sessionNumber}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => setCustomer(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {customer.children?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {customer.children.map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-card text-xs">
                        {c.name} · {c.age}y
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Table Number</Label>
              <Input
                className={cn("mt-1 h-10", tableNumberError && "border-red-500")}
                placeholder="e.g. T1, T2…"
                value={tableNumber}
                onChange={(e) => {
                  setTableNumber(e.target.value);
                  setTableNumberError("");
                }}
              />
              {tableNumberError && <p className="mt-1 text-xs text-red-500">{tableNumberError}</p>}
            </div>
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
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground truncate">₹{item.price} × {item.qty} = ₹{item.price * item.qty}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
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
              <span className="text-2xl font-bold text-primary">₹{total.toLocaleString()}</span>
            </div>
            <Button
              type="button"
              onClick={submit}
              disabled={submitting || cart.length === 0 || !customer}
              className="w-full mt-3 h-11"
              style={{ background: "var(--primary)" }}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Place order
            </Button>
          </div>
        </div>
      </div>

      <ReceiptDialog
        kot={kot}
        customer={customerSnapshot}
        cartSnapshot={cartSnapshot}
        tableNumber={tableNumberSnapshot}
        onClose={() => setKot(null)}
      />
    </div>
  );
}

export default Cafepos;
