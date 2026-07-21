import * as React from "react";
import axios from "axios";
import { toast } from "sonner";
import { BadgeIndianRupee, Gift, Info, MessageCircle, Percent, Send, Wallet } from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const Button = React.forwardRef(({ className, disabled, type = "button", ...props }, ref) => (
  <button
    type={type}
    ref={ref}
    disabled={disabled}
    className={cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed h-9 px-4 py-2 bg-primary text-primary-foreground shadow hover:bg-primary/90",
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";

const API_BASE = `${import.meta.env.VITE_API_URL}`;

const iconByType = {
  membership: Gift,
  discount: Percent,
  flat_discount: Wallet,
  special_pricing: BadgeIndianRupee,
};

const typeLabel = {
  membership: "Membership",
  discount: "Percentage Discount",
  flat_discount: "Flat Amount Discount",
  special_pricing: "Special Pricing",
};

// Mirrors backend/controllers/whatsappOffer.controller.js:buildOfferHighlight
// so the preview shown here matches what actually gets sent on WhatsApp.
const buildOfferHighlight = (offer) => {
  if (offer.description?.trim()) return offer.description.trim();

  const rules = offer.rules || {};
  switch (offer.type) {
    case "membership":
      return `₹${offer.value} for ${rules.kidsAllowed || 1} kid(s), ${rules.playHours || 0} play hours, valid ${rules.validityMonths || 0} month(s)`;
    case "discount":
      return `${offer.value}% off for ${rules.minKids || 1}+ kids`;
    case "flat_discount":
      return `₹${offer.value} off for ${rules.minKids || 1}+ kids`;
    case "special_pricing":
      return `${rules.day || "Special day"}: ₹${rules.firstHourPrice || 0} first hour, ₹${rules.nextHourPrice || 0}/hr after`;
    default:
      return offer.name;
  }
};

function Whatsapp() {
  const [offers, setOffers] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [lastResult, setLastResult] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE}/offers/`, { withCredentials: true });
        if (cancelled) return;
        const list = Array.isArray(response.data.offers) ? response.data.offers : [];
        setOffers(list);
        setSelectedId((current) => current || list.find((offer) => offer.active)?._id || list[0]?._id || null);
      } catch (error) {
        if (!cancelled) toast.error(error?.response?.data?.message || "Unable to load offers.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedOffer = offers.find((offer) => offer._id === selectedId) || null;

  const handleSend = async () => {
    if (!selectedOffer) return;

    setSending(true);
    try {
      const response = await axios.post(
        `${API_BASE}/whatsapp-offers/send`,
        { offerId: selectedOffer._id },
        { withCredentials: true },
      );
      const queued = response.data.queued ?? 0;
      setLastResult({ offerName: selectedOffer.name, queued });
      setConfirmOpen(false);
      toast.success(`"${selectedOffer.name}" queued for ${queued} customer${queued === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to queue WhatsApp campaign.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto space-y-6 lg:space-y-8 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.5rem,1vw+1.1rem,1.875rem)] font-semibold flex flex-wrap items-center gap-2">
          <MessageCircle className="h-7 w-7 text-green-600" /> Send Offer on WhatsApp
        </h1>
        <p className="text-muted-foreground mt-1">Pick an offer, preview the message, and broadcast it to every customer on file.</p>
      </div>

      {lastResult && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Campaign has been queued successfully.</div>
            <div>
              &ldquo;{lastResult.offerName}&rdquo; was queued for {lastResult.queued} customer{lastResult.queued === 1 ? "" : "s"} and is being
              processed in the background. You can monitor delivery status and analytics from the TrdAI Dashboard.
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-input bg-muted/50 px-4 py-3 text-sm text-muted-foreground">Loading offers...</div>
      )}

      {!loading && offers.length === 0 && (
        <div className="rounded-3xl border border-border bg-background p-10 text-center text-muted-foreground">
          No offers yet. Create one from the Offers page first.
        </div>
      )}

      {offers.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="surface-card rounded-3xl border border-border bg-background p-5 shadow-sm">
            <h3 className="font-semibold mb-4">Select an offer</h3>
            <div className="space-y-3">
              {offers.map((offer) => {
                const Icon = iconByType[offer.type] || BadgeIndianRupee;
                const isSelected = offer._id === selectedId;
                return (
                  <button
                    key={offer._id}
                    type="button"
                    onClick={() => setSelectedId(offer._id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors",
                      isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                      !offer.active && "opacity-60",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white",
                        offer.active ? "bg-emerald-600" : "bg-muted-foreground/50",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{offer.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {typeLabel[offer.type]}
                        {!offer.active && " · Inactive"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="surface-card rounded-3xl border border-border bg-background p-5 shadow-sm flex flex-col">
            <h3 className="font-semibold mb-4">Preview</h3>
            {selectedOffer ? (
              <>
                <div className="flex-1 rounded-2xl bg-[#e5f5e0] dark:bg-emerald-950/30 p-4">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white dark:bg-emerald-900/60 p-3 text-sm shadow-sm">
                    <div className="font-semibold">{selectedOffer.name}</div>
                    <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{buildOfferHighlight(selectedOffer)}</p>
                  </div>
                </div>
                {!selectedOffer.active && (
                  <p className="mt-3 text-xs text-amber-600">This offer is inactive — activate it from the Offers page before sending.</p>
                )}
                <Button
                  className="mt-5 h-11 bg-green-600 text-white hover:bg-green-700"
                  disabled={!selectedOffer.active}
                  onClick={() => setConfirmOpen(true)}
                >
                  <Send className="h-4 w-4" /> Send Message
                </Button>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Select an offer to preview it.</div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Send this offer to every customer?"
        message={
          selectedOffer
            ? `"${selectedOffer.name}" will be sent via WhatsApp to every customer on file. Sending runs in the background and can't be undone.`
            : ""
        }
        confirmLabel="Send Message"
        loading={sending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleSend}
      />
    </div>
  );
}

export default Whatsapp;
