import * as React from "react";
import axios from "axios";
import { toast } from "sonner";
import { Award, Download, FileBarChart, Loader2, Users as UsersIcon } from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const buttonVariantClasses = {
  default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
  outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
};

const buttonSizeClasses = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
};

const Button = React.forwardRef(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => (
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

const Select = React.forwardRef(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

const Th = ({ children, className = "" }) => (
  <th className={cn("text-left px-5 py-3 font-medium text-xs uppercase tracking-wider", className)}>
    {children}
  </th>
);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const now = new Date();
const YEARS = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);
const todayInputValue = now.toISOString().slice(0, 10);

function MonthlyReports() {
  const API_BASE = import.meta.env.VITE_API_URL;
  // "daily"/"monthly"/"yearly" all reuse the same report/summary/table
  // shape (getCustomerReportDataForRange on the backend) — only the
  // endpoint, params, and period label differ below.
  const [reportType, setReportType] = React.useState("monthly");
  const [date, setDate] = React.useState(todayInputValue);
  const [month, setMonth] = React.useState(now.getMonth() + 1);
  const [year, setYear] = React.useState(now.getFullYear());
  const [report, setReport] = React.useState(null);
  const [generating, setGenerating] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);

  const isDaily = reportType === "daily";
  const isYearly = reportType === "yearly";
  const reportPath = isDaily ? "daily" : isYearly ? "yearly" : "monthly";
  const periodLabel = isDaily ? date : isYearly ? String(year) : `${MONTHS[month - 1]} ${year}`;
  const reportParams = isDaily ? { date } : isYearly ? { year } : { month, year };

  const generateReport = async () => {
    try {
      setGenerating(true);
      setReport(null);

      const res = await axios.get(
        `${API_BASE}/admin/reports/${reportPath}`,
        {
          params: reportParams,
          withCredentials: true,
        },
      );

      setReport(res.data);
      toast.success(`Report generated for ${periodLabel}.`);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Unable to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = async () => {
    try {
      setDownloading(true);

      const res = await axios.get(
        `${API_BASE}/admin/reports/${reportPath}/pdf`,
        {
          params: reportParams,
          withCredentials: true,
          responseType: "blob",
        },
      );

      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        isDaily
          ? `Customer_Report_${date}.pdf`
          : isYearly
            ? `Customer_Report_${year}.pdf`
            : `Customer_Report_${MONTHS[month - 1]}_${year}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully.");
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Unable to download PDF.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto space-y-6 lg:space-y-8 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div>
        <h1 className="text-[clamp(1.5rem,1vw+1.1rem,1.875rem)] font-semibold">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Generate a monthly or yearly customer activity report and download it as a PDF.
        </p>
      </div>

      <div className="surface-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="w-full sm:w-48">
            <label className="text-sm font-medium leading-none">Report type</label>
            <Select
              className="mt-1.5"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </div>

          {isDaily && (
            <div className="w-full sm:w-48">
              <label className="text-sm font-medium leading-none">Date</label>
              <input
                type="date"
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={date}
                max={todayInputValue}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          )}

          {!isDaily && !isYearly && (
            <div className="w-full sm:w-48">
              <label className="text-sm font-medium leading-none">Month</label>
              <Select
                className="mt-1.5"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTHS.map((label, index) => (
                  <option key={label} value={index + 1}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {!isDaily && (
            <div className="w-full sm:w-36">
              <label className="text-sm font-medium leading-none">Year</label>
              <Select
                className="mt-1.5"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-white">
            <Button className="h-10 px-5 bg-blue-600" onClick={generateReport} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileBarChart className="h-4 w-4" />}
              {generating ? "Generating..." : "Generate Report"}
            </Button>

            <Button
              variant="outline"
              className="h-10 px-5 bg-blue-600"
              onClick={downloadPdf}
              disabled={!report || downloading}
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? "Preparing..." : "Download PDF"}
            </Button>
          </div>
        </div>

        {!report && !generating && (
          <p className="mt-4 text-sm text-muted-foreground">
            {isDaily
              ? 'Select a date, then click "Generate Report" to preview the data.'
              : isYearly
                ? 'Select a year, then click "Generate Report" to preview the data.'
                : 'Select a month and year, then click "Generate Report" to preview the data.'}
          </p>
        )}
      </div>

      {report && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 lg:gap-5">
            <SummaryCard label="Customers Visited" value={report.summary.totalCustomers} />
            <SummaryCard label="Total Visits" value={report.summary.totalVisits} />
            <SummaryCard label="Total Revenue" value={`₹${Number(report.summary.totalRevenue).toLocaleString()}`} />
            <SummaryCard label="Revenue From Membership" value={`₹${Number(report.summary.totalRevenueFromMembership).toLocaleString()}`} />
            <SummaryCard label="Reward Points Issued" value={report.summary.totalRewardPoints} />
            <SummaryCard label="Amount Collected" value={`₹${Number(report.summary.totalAmountCollected).toLocaleString()}`} />
            <SummaryCard label="Pending Amount" value={`₹${Number(report.summary.totalPendingAmount).toLocaleString()}`} />
          </div>

          {report.revenueByPaymentMethod && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
              <div className="surface-card p-5">
                <h3 className="font-semibold mb-3">Session & Membership Revenue by Payment Mode</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {["cash", "upi", "card"].map((method) => {
                    const sessionAmount = Number(report.revenueByPaymentMethod.session[method] || 0);
                    const membershipAmount = Number(report.revenueByPaymentMethod.membership?.[method] || 0);
                    return (
                      <div key={method} className="space-y-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {method === "upi" ? "UPI" : method[0].toUpperCase() + method.slice(1)}
                        </div>
                        <SummaryCard label="Session Revenue" value={`₹${sessionAmount.toLocaleString()}`} />
                        <SummaryCard label="Membership Revenue" value={`₹${membershipAmount.toLocaleString()}`} />
                        <SummaryCard label="Total" value={`₹${(sessionAmount + membershipAmount).toLocaleString()}`} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="surface-card p-5">
                <h3 className="font-semibold mb-3">Cafe Revenue by Payment Mode</h3>
                <div className="grid grid-cols-2 gap-3">
                  <SummaryCard label="Total" value={`₹${Number(report.revenueByPaymentMethod.cafe.total).toLocaleString()}`} />
                  <SummaryCard label="Cash" value={`₹${Number(report.revenueByPaymentMethod.cafe.cash).toLocaleString()}`} />
                  <SummaryCard label="UPI" value={`₹${Number(report.revenueByPaymentMethod.cafe.upi).toLocaleString()}`} />
                  <SummaryCard label="Card" value={`₹${Number(report.revenueByPaymentMethod.cafe.card).toLocaleString()}`} />
                </div>
              </div>
            </div>
          )}

          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr>
                  <Th>Customer ID</Th>
                  <Th>Child(ren)</Th>
                  <Th>Parent Name / Guardian Name</Th>
                  <Th>Mobile</Th>
                  <Th className="text-right">Visits</Th>
                  <Th className="text-right">Points</Th>
                  <Th className="text-right">Total Spent</Th>
                  <Th className="text-right">Pending</Th>
                  <Th>Payment Method</Th>
                </tr>
              </thead>
              <tbody>
                {report.customers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted-foreground">
                      <UsersIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No customer visits recorded for {periodLabel}.
                    </td>
                  </tr>
                ) : (
                  report.customers.map((customer) => (
                    <tr
                      key={customer.mobileNumber}
                      className="border-t border-border hover:bg-secondary/40 transition"
                    >
                      <td className="px-5 py-3.5 font-mono text-xs text-primary">{customer.customerId}</td>
                      <td className="px-5 py-3.5 font-medium">
                        {customer.childNames.length ? customer.childNames.join(", ") : "-"}
                      </td>
                      <td className="px-5 py-3.5">{customer.parentName}</td>
                      <td className="px-5 py-3.5">{customer.mobileNumber}</td>
                      <td className="px-5 py-3.5 text-right">{customer.visits}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                          <Award className="h-3 w-3" /> {customer.rewardPoints}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium">
                        ₹{Number(customer.totalSpent).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {customer.pendingAmount > 0 ? `₹${Number(customer.pendingAmount).toLocaleString()}` : "-"}
                      </td>
                      <td className="px-5 py-3.5">{customer.paymentMethod}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="surface-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

export default MonthlyReports;
