import * as React from "react";
import axios from "axios";
import { Save, Settings as SettingsIcon, Timer, Coffee, Award } from "lucide-react";

const API_BASE = `${import.meta.env.VITE_API_URL}`;

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

const Field = ({ label, value, onChange }) => (
  <div className="min-w-0">
    <Label>{label}</Label>
    <Input className="mt-2" type="number" value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

function Settings() {
  const [form, setForm] = React.useState({
    firstHourUnder3: "",
    extensionUnder3: "",
    firstHourAbove3: "",
    extensionAbove3: "",
    socksCost: "",
    loyaltyPointsPer100: "",
  });
  const [status, setStatus] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const set = (k, v) => setForm({ ...form, [k]: v });

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await axios.get(`${API_BASE}/price/prices`, {
          withCredentials: true,
        });
        const data = response.data;
        if (data) {
          setForm({
            firstHourUnder3: data.firstHourUnder3 ?? "",
            extensionUnder3: data.extensionUnder3 ?? "",
            firstHourAbove3: data.firstHourAbove3 ?? "",
            extensionAbove3: data.extensionAbove3 ?? "",
            socksCost: data.socksCost ?? "",
            loyaltyPointsPer100: data.loyaltyPointsPer100 ?? "",
          });
        }
      } catch (error) {
        setStatus(error?.response?.data?.message || "Unable to load settings.");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const savePricing = async () => {
    try {
      const payload = {
        firstHourUnder3: Number(form.firstHourUnder3),
        extensionUnder3: Number(form.extensionUnder3),
        firstHourAbove3: Number(form.firstHourAbove3),
        extensionAbove3: Number(form.extensionAbove3),
        socksCost: Number(form.socksCost),
        loyaltyPointsPer100: Number(form.loyaltyPointsPer100),
      };

      await axios.put(`${API_BASE}/price/updateprices`, payload, {
        withCredentials: true,
      });

      setStatus("Settings saved successfully.");
      window.setTimeout(() => setStatus(""), 3200);
    } catch (error) {
      setStatus(error?.response?.data?.message || "Unable to save settings.");
    }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto space-y-6 lg:space-y-8 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div>
        <h1 className="text-[clamp(1.5rem,1vw+1.1rem,1.875rem)] font-semibold flex items-center gap-2"><SettingsIcon className="h-7 w-7 text-primary" /> Settings</h1>
        <p className="text-muted-foreground mt-1">Session pricing, socks cost and loyalty rate.</p>
      </div>

      <div className="surface-card rounded-3xl border border-border bg-background p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Session pricing (per child, per age tier)</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="First hour — under 3 years (₹)" value={form.firstHourUnder3} onChange={(v) => set("firstHourUnder3", v)} />
          <Field label="First hour — 3 years and above (₹)" value={form.firstHourAbove3} onChange={(v) => set("firstHourAbove3", v)} />
          <Field label="Extension per hour — under 3 years (₹)" value={form.extensionUnder3} onChange={(v) => set("extensionUnder3", v)} />
          <Field label="Extension per hour — 3 years and above (₹)" value={form.extensionAbove3} onChange={(v) => set("extensionAbove3", v)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-input">
          <div className="min-w-0">
            <Label className="flex items-center gap-1.5"><Coffee className="h-3.5 w-3.5" /> Socks cost (₹)</Label>
            <Input className="mt-2" type="number" value={form.socksCost} onChange={(e) => set("socksCost", e.target.value)} />
          </div>
          <div className="min-w-0">
            <Label className="flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> Loyalty points per ₹100</Label>
            <Input className="mt-2" type="number" value={form.loyaltyPointsPer100} onChange={(e) => set("loyaltyPointsPer100", e.target.value)} />
          </div>
        </div>

        <Button disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={savePricing}>
          <Save className="h-4 w-4" />
          Save settings
        </Button>

        {loading && <div className="rounded-xl border border-input bg-muted/10 px-4 py-3 text-sm text-muted-foreground">Loading settings...</div>}
        {status && !loading && <div className="rounded-xl border border-success/50 bg-success/10 px-4 py-3 text-sm text-success">{status}</div>}
      </div>

      <div className="surface-card rounded-3xl border border-border bg-background p-6 shadow-sm text-sm text-muted-foreground">
        <div className="font-medium text-foreground mb-3">How charges are calculated</div>
        <ul className="list-disc pl-5 space-y-2">
          <li>Each child is billed individually based on age at check-in (under 3 vs 3+).</li>
          <li>First hour is always charged. Each additional started hour uses the extension rate.</li>
          <li>Paused time is excluded from billed minutes.</li>
          <li>Cafe items added to the same running bill are billed together at checkout.</li>
        </ul>
      </div>
    </div>
  );
}

export default Settings;