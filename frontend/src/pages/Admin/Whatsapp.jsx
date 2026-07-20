
import * as React from "react";
import { MessageCircle, Send, Users, FileText, History, Plus, Megaphone } from "lucide-react";

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

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
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

const TabsContext = React.createContext(null);

const Tabs = ({ value, onValueChange, children, className }) => (
  <TabsContext.Provider value={{ value, onValueChange }}>{/* @ts-ignore */}
    <div className={cn("space-y-4", className)}>{children}</div>
  </TabsContext.Provider>
);

const TabsList = ({ className, ...props }) => (
  <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />
);

const TabsTrigger = React.forwardRef(({ value, className, children, ...props }, ref) => {
  const ctx = React.useContext(TabsContext);
  const active = ctx?.value === value;
  return (
    <button
      type="button"
      ref={ref}
      onClick={() => ctx?.onValueChange?.(value)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = ({ value, children, className, ...props }) => {
  const ctx = React.useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return (
    <div className={cn("space-y-4", className)} {...props}>
      {children}
    </div>
  );
};

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
    const onClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
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

const DialogContext = React.createContext(null);

const Dialog = ({ open, onOpenChange, children }) => (
  <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
);

const DialogContent = React.forwardRef(({ open, onOpenChange, className, children, ...props }, ref) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="fixed inset-0 bg-black/40" onClick={() => onOpenChange?.(false)} />
      <div
        ref={ref}
        className={cn("relative z-10 w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-border bg-background p-6 shadow-2xl", className)}
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

const SEGMENTS = [
  { id: "all", label: "All customers" },
  { id: "frequent", label: "Frequent (>3 visits)" },
  { id: "lapsed", label: "Lapsed (>30 days)" },
  { id: "high_value", label: "High value (>₹5,000)" },
  { id: "birthdays", label: "Birthday this week" },
];

const initialCustomers = [
  { id: "cust-1", child_name: "Riya", parent_name: "Deepa", mobile: "+919876543210", visit_count: 5, total_spent: 6200, updated_at: "2026-05-20T10:00:00Z" },
  { id: "cust-2", child_name: "Arjun", parent_name: "Suman", mobile: "+919812345678", visit_count: 2, total_spent: 1800, updated_at: "2026-04-25T14:20:00Z" },
  { id: "cust-3", child_name: "Mia", parent_name: "Nisha", mobile: "+919700112233", visit_count: 4, total_spent: 5400, updated_at: "2026-05-05T09:30:00Z" },
  { id: "cust-4", child_name: "Neel", parent_name: "Rajiv", mobile: "+919900334455", visit_count: 1, total_spent: 900, updated_at: "2026-03-12T11:15:00Z" },
];

const initialTemplates = [
  { id: "tpl-1", name: "Birthday cheer", category: "birthday", body: "Hi {{child_name}}, enjoy a free cookie on your next visit!" },
  { id: "tpl-2", name: "Weekend offer", category: "marketing", body: "Hello {{parent_name}}, book a table for Saturday and get 15% off." },
];

const initialCampaigns = [
  { id: "cmp-1", name: "Weekend blast", segment: "all", recipient_count: 4, status: "sent", sent_at: "2026-05-24T12:30:00Z" },
];

const initialMessages = [
  { id: "msg-1", customer: { child_name: "Riya" }, to_mobile: "+919876543210", body: "Hi Riya, enjoy a free cookie on your next visit!", status: "sent", created_at: "2026-05-24T12:31:00Z" },
  { id: "msg-2", customer: { child_name: "Mia" }, to_mobile: "+919700112233", body: "Hello Nisha, book a table for Saturday and get 15% off.", status: "sent", created_at: "2026-05-24T12:33:00Z" },
];

function Whatsapp() {
  const [activeTab, setActiveTab] = React.useState("campaigns");
  const [customers] = React.useState(initialCustomers);
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [campaigns, setCampaigns] = React.useState(initialCampaigns);
  const [messages, setMessages] = React.useState(initialMessages);
  const [openTpl, setOpenTpl] = React.useState(false);
  const [openCmp, setOpenCmp] = React.useState(false);
  const [notice, setNotice] = React.useState("");

  const stats = [
    { label: "Customers reachable", value: customers.filter((c) => c.mobile).length, icon: Users },
    { label: "Templates", value: templates.length, icon: FileText },
    { label: "Campaigns", value: campaigns.length, icon: Megaphone },
    { label: "Messages sent", value: messages.length, icon: Send },
  ];

  const showNotice = (text) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3200);
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto space-y-6 lg:space-y-8 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.5rem,1vw+1.1rem,1.875rem)] font-semibold flex flex-wrap items-center gap-2"><MessageCircle className="h-7 w-7 text-green-600" /> WhatsApp Business</h1>
        <p className="text-muted-foreground mt-1">Campaigns, templates and broadcast history. <span className="text-amber-600">UI preview — provider integration pending.</span></p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 lg:gap-5">
        {stats.map((item) => (
          <Stat key={item.label} label={item.label} value={item.value} icon={item.icon} />
        ))}
      </div>

      {notice && <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">{notice}</div>}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns"><Megaphone className="h-4 w-4" />Campaigns</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="h-4 w-4" />Templates</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4" />History</TabsTrigger>
          <TabsTrigger value="segments"><Users className="h-4 w-4" />Segments</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <div className="surface-card rounded-3xl border border-border bg-background p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-semibold">Broadcast campaigns</h3>
              <Button onClick={() => setOpenCmp(true)}>
                <Plus className="h-4 w-4" /> New campaign
              </Button>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Segment</th>
                    <th className="text-left px-4 py-3 font-medium">Recipients</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No campaigns yet.</td></tr>
                  ) : campaigns.map((campaign) => (
                    <tr key={campaign.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{campaign.name}</td>
                      <td className="px-4 py-3">{SEGMENTS.find((s) => s.id === campaign.segment)?.label ?? campaign.segment}</td>
                      <td className="px-4 py-3">{campaign.recipient_count}</td>
                      <td className="px-4 py-3"><span className={cn("text-xs font-medium px-2 py-1 rounded-full", campaign.status === "sent" ? "bg-green-500/15 text-green-700" : "bg-amber-500/15 text-amber-700")}>{campaign.status}</span></td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(campaign.sent_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="surface-card rounded-3xl border border-border bg-background p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-semibold">Message templates</h3>
              <Button onClick={() => setOpenTpl(true)}>
                <Plus className="h-4 w-4" /> New template
              </Button>
            </div>
            {templates.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">No templates. Add one for invoices, offers, birthdays.</div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {templates.map((template) => (
                  <div key={template.id} className="rounded-3xl border border-border bg-muted/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="font-semibold min-w-0 truncate">{template.name}</div>
                      <span className="text-xs rounded-full bg-primary/10 px-2 py-1 text-primary uppercase shrink-0">{template.category}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap break-words">{template.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="surface-card rounded-3xl border border-border bg-background p-5 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">To</th>
                  <th className="text-left px-4 py-3 font-medium">Body</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Sent</th>
                </tr>
              </thead>
              <tbody>
                {messages.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No messages yet.</td></tr>
                ) : messages.map((message) => (
                  <tr key={message.id} className="border-t border-border">
                    <td className="px-4 py-3">{message.customer?.child_name ?? "Unknown"}<div className="text-xs text-muted-foreground">{message.to_mobile}</div></td>
                    <td className="px-4 py-3 max-w-md truncate text-muted-foreground">{message.body}</td>
                    <td className="px-4 py-3"><span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/15 text-green-700 capitalize">{message.status}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(message.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="segments">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {SEGMENTS.map((segment) => (
              <div key={segment.id} className="surface-card rounded-3xl border border-border bg-background p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{segment.label}</div>
                  <div className="text-sm text-muted-foreground">{segmentCount(segment.id, customers)} customers</div>
                </div>
                <Button variant="outline" onClick={() => setOpenCmp(true)}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <TemplateDialog
        open={openTpl}
        setOpen={setOpenTpl}
        onSaved={(template) => {
          setTemplates((current) => [template, ...current]);
          showNotice("Template added.");
        }}
      />
      <CampaignDialog
        open={openCmp}
        setOpen={setOpenCmp}
        templates={templates}
        customers={customers}
        onSaved={(campaign, newMessages) => {
          setCampaigns((current) => [campaign, ...current]);
          setMessages((current) => [...newMessages, ...current]);
          showNotice("Campaign sent.");
        }}
      />
    </div>
  );
}

function segmentCount(id, customers) {
  const now = Date.now();
  switch (id) {
    case "frequent":
      return customers.filter((c) => (c.visit_count ?? 0) > 3).length;
    case "lapsed":
      return customers.filter((c) => c.updated_at && now - new Date(c.updated_at).getTime() > 30 * 86400000).length;
    case "high_value":
      return customers.filter((c) => Number(c.total_spent ?? 0) > 5000).length;
    case "birthdays":
      return 0;
    default:
      return customers.length;
  }
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="surface-card rounded-3xl border border-border bg-background p-5 flex items-center gap-4 shadow-sm">
      <div className="h-11 w-11 rounded-xl grid place-items-center bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </div>
    </div>
  );
}

function TemplateDialog({ open, setOpen, onSaved }) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("marketing");
  const [body, setBody] = React.useState("");

  const save = () => {
    if (!name.trim() || !body.trim()) {
      window.alert("Name and body required");
      return;
    }
    const template = {
      id: `tpl-${Date.now()}`,
      name: name.trim(),
      category,
      body: body.trim(),
    };
    onSaved(template);
    setOpen(false);
    setName("");
    setCategory("marketing");
    setBody("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Birthday offer" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Choose category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="reward">Reward</SelectItem>
                <SelectItem value="birthday">Birthday</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Body</Label>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Hi {{child_name}}, enjoy 20% off your next visit!" />
            <p className="text-xs text-muted-foreground">Variables: {'{{child_name}}, {{parent_name}}, {{reward_points}}'}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampaignDialog({ open, setOpen, templates, customers, onSaved }) {
  const [name, setName] = React.useState("");
  const [segment, setSegment] = React.useState("all");
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? "");

  const send = () => {
    if (!name.trim() || !templateId) {
      window.alert("Campaign name and template required");
      return;
    }
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    const recipients = customers.filter((c) => c.mobile);
    const segmentCountValue = segmentCount(segment, customers);
    const targets = segment === "all" ? recipients : recipients.slice(0, segmentCountValue || recipients.length);

    const campaign = {
      id: `cmp-${Date.now()}`,
      name: name.trim(),
      segment,
      recipient_count: targets.length,
      status: "sent",
      sent_at: new Date().toISOString(),
    };

    const newMessages = targets.slice(0, 20).map((customer) => ({
      id: `msg-${Date.now()}-${customer.id}`,
      customer: { child_name: customer.child_name },
      to_mobile: customer.mobile,
      body: template.body.replace(/{{child_name}}/g, customer.child_name).replace(/{{parent_name}}/g, customer.parent_name ?? ""),
      status: "sent",
      created_at: new Date().toISOString(),
    }));

    onSaved(campaign, newMessages);
    setOpen(false);
    setName("");
    setSegment("all");
    setTemplateId(templates[0]?.id ?? "");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>Send broadcast</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label>Campaign name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Diwali special" />
          </div>
          <div>
            <Label>Segment</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger>
                <SelectValue placeholder="Choose segment" />
              </SelectTrigger>
              <SelectContent>
                {SEGMENTS.map((segmentOption) => (
                  <SelectItem key={segmentOption.id} value={segmentOption.id}>
                    {segmentOption.label} ({segmentCount(segmentOption.id, customers)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={send}><Send className="h-4 w-4" />Send broadcast</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Whatsapp;