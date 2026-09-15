import * as React from "react";
import axios from "axios";
import { toast } from "sonner";
import { X, Gift, Pencil } from "lucide-react";

const API_BASE = `${import.meta.env.VITE_API_URL}`;

const cn = (...classes) => classes.filter(Boolean).join(" ");

const fieldClass =
  "flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const HISTORY_TYPE_LABEL = { earned: "Earned", redeemed: "Redeemed", adjusted: "Adjusted" };

// Desk-side loyalty management surface: shows the customer's current
// redeemable balance (earned invoices - redemptions/adjustments, computed
// server-side by services/loyalty.service.js) and lets desk staff redeem or
// manually correct it. Every write here creates a LoyaltyTransaction ledger
// row — it never touches an invoice, so past bills and their "points
// earned" figure are always left exactly as they were.
function LoyaltyPointsModal({ customer, onClose, onBalanceChange }) {
  const [loading, setLoading] = React.useState(true);
  const [currentBalance, setCurrentBalance] = React.useState(0);
  const [history, setHistory] = React.useState([]);
  const [mode, setMode] = React.useState("redeem");

  const [redeemPoints, setRedeemPoints] = React.useState("");
  const [redeemReason, setRedeemReason] = React.useState("");
  const [redeemSaving, setRedeemSaving] = React.useState(false);

  const [adjustBalance, setAdjustBalance] = React.useState("");
  const [adjustReason, setAdjustReason] = React.useState("");
  const [adjustSaving, setAdjustSaving] = React.useState(false);

  const mobileNumber = customer?.mobileNumber;

  const fetchDetails = async () => {
    if (!mobileNumber) return;
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/loyalty/${mobileNumber}`, { withCredentials: true });
      setCurrentBalance(Number(res.data?.currentBalance || 0));
      setHistory(res.data?.history || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to load loyalty details");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mobileNumber) return;
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE}/loyalty/${mobileNumber}`, { withCredentials: true });
        if (cancelled) return;
        setCurrentBalance(Number(res.data?.currentBalance || 0));
        setHistory(res.data?.history || []);
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.message || "Unable to load loyalty details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mobileNumber]);

  const applyNewBalance = (nextBalance) => {
    setCurrentBalance(nextBalance);
    onBalanceChange?.(nextBalance);
  };

  const submitRedeem = async (event) => {
    event.preventDefault();
    const points = Number(redeemPoints);
    if (!Number.isInteger(points) || points <= 0) {
      toast.error("Enter a whole number of points greater than zero");
      return;
    }
    if (points > currentBalance) {
      toast.error(`Cannot redeem more than the current balance (${currentBalance} pts)`);
      return;
    }
    if (!redeemReason.trim()) {
      toast.error("A reason is required to redeem points");
      return;
    }
    try {
      setRedeemSaving(true);
      const res = await axios.post(
        `${API_BASE}/loyalty/${mobileNumber}/redeem`,
        { points, reason: redeemReason.trim() },
        { withCredentials: true }
      );
      toast.success("Points redeemed successfully.");
      applyNewBalance(Number(res.data?.currentBalance ?? currentBalance - points));
      setRedeemPoints("");
      setRedeemReason("");
      await fetchDetails();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to redeem points");
    } finally {
      setRedeemSaving(false);
    }
  };

  const submitAdjust = async (event) => {
    event.preventDefault();
    const targetBalance = Number(adjustBalance);
    if (!Number.isInteger(targetBalance) || targetBalance < 0) {
      toast.error("Enter a valid new balance (0 or more)");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("A reason is required to adjust points");
      return;
    }
    try {
      setAdjustSaving(true);
      const res = await axios.post(
        `${API_BASE}/loyalty/${mobileNumber}/adjust`,
        { targetBalance, reason: adjustReason.trim() },
        { withCredentials: true }
      );
      toast.success("Points adjusted successfully.");
      applyNewBalance(Number(res.data?.currentBalance ?? targetBalance));
      setAdjustBalance("");
      setAdjustReason("");
      await fetchDetails();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to adjust points");
    } finally {
      setAdjustSaving(false);
    }
  };

  if (!customer) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="surface-card fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Loyalty Points</div>
            <div className="text-xs text-muted-foreground">
              {customer.displayName || customer.parentName} · {mobileNumber}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-4 text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Current Redeemable Points</div>
          <div className="text-3xl font-semibold text-primary">{loading ? "…" : currentBalance}</div>
        </div>

        <div className="mt-4 flex gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setMode("redeem")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium",
              mode === "redeem" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Gift className="h-3.5 w-3.5" /> Redeem
          </button>
          <button
            type="button"
            onClick={() => setMode("adjust")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium",
              mode === "adjust" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Pencil className="h-3.5 w-3.5" /> Adjust
          </button>
        </div>

        {mode === "redeem" ? (
          <form onSubmit={submitRedeem} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Redeem Points
              <input
                type="number"
                min="1"
                step="1"
                required
                className={fieldClass}
                value={redeemPoints}
                onChange={(e) => setRedeemPoints(e.target.value)}
                placeholder={`Up to ${currentBalance}`}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Reason
              <input
                type="text"
                required
                className={fieldClass}
                value={redeemReason}
                onChange={(e) => setRedeemReason(e.target.value)}
                placeholder="e.g. Free Pizza"
              />
            </label>
            <button
              disabled={redeemSaving || loading}
              className="h-10 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
            >
              {redeemSaving ? "Redeeming…" : "Confirm Redeem"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitAdjust} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-xs text-muted-foreground">
              New Balance
              <input
                type="number"
                min="0"
                step="1"
                required
                className={fieldClass}
                value={adjustBalance}
                onChange={(e) => setAdjustBalance(e.target.value)}
                placeholder={`Current: ${currentBalance}`}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Reason
              <input
                type="text"
                required
                className={fieldClass}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Customer redeemed reward"
              />
            </label>
            <button
              disabled={adjustSaving || loading}
              className="h-10 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
            >
              {adjustSaving ? "Saving…" : "Save"}
            </button>
          </form>
        )}

        <div className="mt-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">History</div>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-secondary/60 text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">Points</th>
                  <th className="px-3 py-2 text-right font-medium">Balance After</th>
                  <th className="px-3 py-2 text-left font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                      {loading ? "Loading…" : "No loyalty activity yet."}
                    </td>
                  </tr>
                ) : (
                  history.map((entry, index) => (
                    <tr key={index} className="border-t border-border/60">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{HISTORY_TYPE_LABEL[entry.type] || entry.type}</td>
                      <td className={cn("px-3 py-2 text-right font-medium", entry.points >= 0 ? "text-emerald-600" : "text-destructive")}>
                        {entry.points >= 0 ? `+${entry.points}` : entry.points}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{entry.balanceAfter ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{entry.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default LoyaltyPointsModal;
