import * as React from "react";
import { Save, Settings as SettingsIcon, Timer } from "lucide-react";

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

const initialPricing = [
  { id: "pricing-1", minutes: 30, price: 120, label: "Quick Brew" },
  { id: "pricing-2", minutes: 60, price: 200, label: "Standard Session" },
  { id: "pricing-3", minutes: 90, price: 280, label: "Extended Stay" },
];

function Settings() {
  const [rows, setRows] = React.useState(initialPricing);
  const [status, setStatus] = React.useState("");

  const updateRow = (index, changes) => {
    setRows((current) => current.map((row, idx) => (idx === index ? { ...row, ...changes } : row)));
  };

  const savePricing = () => {
    setStatus("Pricing saved successfully.");
    window.setTimeout(() => setStatus(""), 3200);
  };

  return (
    <div className="space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-semibold flex items-center gap-2"><SettingsIcon className="h-7 w-7 text-primary" /> Settings</h1>
        <p className="text-muted-foreground mt-1">Operator-level configuration for billing and session pricing.</p>
      </div>

      <div className="surface-card rounded-3xl border border-border bg-background p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Timer className="h-5 w-5 text-primary" />
            Time-based pricing
          </div>
          <Button className="mt-2 sm:mt-0" onClick={savePricing}>
            <Save className="h-4 w-4" />
            Save pricing
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mt-3">Adjust the label and price shown on the billing screen for each duration slot.</p>

        <div className="mt-6 space-y-4">
          {rows.map((row, index) => (
            <div key={row.id} className="grid grid-cols-12 gap-3 items-center rounded-2xl border border-input bg-muted/10 p-4">
              <div className="col-span-12 sm:col-span-2">
                <Label className="text-xs">Minutes</Label>
                <Input value={row.minutes} disabled />
              </div>
              <div className="col-span-12 sm:col-span-5">
                <Label className="text-xs">Label</Label>
                <Input value={row.label} onChange={(event) => updateRow(index, { label: event.target.value })} placeholder="Session name" />
              </div>
              <div className="col-span-12 sm:col-span-5">
                <Label className="text-xs">Price (₹)</Label>
                <Input type="number" value={row.price} onChange={(event) => updateRow(index, { price: Number(event.target.value) })} />
              </div>
            </div>
          ))}
        </div>

        {status && <div className="mt-4 rounded-xl border border-success/50 bg-success/10 px-4 py-3 text-sm text-success">{status}</div>}
      </div>
    </div>
  );
}

export default Settings;