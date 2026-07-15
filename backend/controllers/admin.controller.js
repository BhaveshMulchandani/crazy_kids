const sessionmodel = require("../models/session.model");
const Invoice = require("../models/invoice.model");
const PDFDocument = require("pdfkit");

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfWeek = (date = new Date()) => {
  // Calendar week: Monday 00:00 -> Sunday 23:59
  const d = startOfDay(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  return d;
};

const startOfMonth = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);

const localDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// Offset of the server's local timezone, e.g. "+05:30" — keeps the
// $dateToString day-bucketing in the aggregation in sync with the
// local-time day/week/month boundaries computed above.
const tzOffsetString = (date = new Date()) => {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
};

const dashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const today = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const trendStart = startOfDay(new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000));
    const tz = tzOffsetString(now);

    const [facetResult, activeSessions] = await Promise.all([
      Invoice.aggregate([
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: "$charges.grandTotal" },
                  cafeRevenue: { $sum: "$charges.cafeTotal" },
                  totalOrders: { $sum: 1 },
                },
              },
            ],
            today: [
              { $match: { createdAt: { $gte: today } } },
              { $group: { _id: "$customer.mobileNumber", total: { $sum: "$charges.grandTotal" } } },
            ],
            week: [
              { $match: { createdAt: { $gte: weekStart } } },
              {
                $group: {
                  _id: null,
                  sales: { $sum: "$charges.grandTotal" },
                  cafeSales: { $sum: "$charges.cafeTotal" },
                },
              },
            ],
            month: [
              { $match: { createdAt: { $gte: monthStart } } },
              { $group: { _id: null, sales: { $sum: "$charges.grandTotal" } } },
            ],
            revenueTrend: [
              { $match: { createdAt: { $gte: trendStart } } },
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: tz } },
                  revenue: { $sum: "$charges.grandTotal" },
                },
              },
            ],
            offerUsage: [
              { $match: { "offer.name": { $nin: ["", null] } } },
              { $group: { _id: "$offer.name", value: { $sum: 1 } } },
              { $sort: { value: -1 } },
              { $limit: 8 },
            ],
            bestSellingCafeItems: [
              { $unwind: "$cafeItems" },
              { $group: { _id: "$cafeItems.name", qty: { $sum: "$cafeItems.quantity" } } },
              { $sort: { qty: -1 } },
              { $limit: 6 },
            ],
            topCustomers: [
              {
                $group: {
                  _id: "$customer.mobileNumber",
                  parentName: { $last: "$customer.parentName" },
                  total_spent: { $sum: "$charges.grandTotal" },
                  visit_count: { $sum: 1 },
                  reward_points: { $sum: "$charges.loyaltyPoints" },
                },
              },
              { $sort: { total_spent: -1 } },
              { $limit: 5 },
            ],
            customerVisits: [
              {
                $group: {
                  _id: "$customer.mobileNumber",
                  visits: { $sum: 1 },
                  firstVisit: { $min: "$createdAt" },
                },
              },
            ],
            recentTransactions: [
              { $sort: { createdAt: -1 } },
              { $limit: 6 },
              {
                $project: {
                  invoiceNumber: 1,
                  "customer.parentName": 1,
                  "customer.bandNumber": 1,
                  "customer.sessionNumber": 1,
                  "charges.grandTotal": 1,
                  createdAt: 1,
                },
              },
            ],
          },
        },
      ]),
      sessionmodel
        .find({ status: "running" })
        .select("sessionNumber parentName bandNumber scheduledEndTime")
        .sort({ scheduledEndTime: 1 })
        .limit(50)
        .lean(),
    ]);

    const facets = facetResult[0];
    const totals = facets.totals[0] || { totalRevenue: 0, cafeRevenue: 0, totalOrders: 0 };
    const week = facets.week[0] || { sales: 0, cafeSales: 0 };
    const month = facets.month[0] || { sales: 0 };
    const todaySales = facets.today.reduce((sum, c) => sum + Number(c.total || 0), 0);
    const todayCustomers = facets.today.length;
    const repeatCustomers = facets.customerVisits.filter((c) => c.visits > 1).length;
    const newCustomersThisWeek = facets.customerVisits.filter((c) => c.firstVisit >= weekStart).length;

    const trendMap = new Map(facets.revenueTrend.map((r) => [r._id, r.revenue]));
    const revenueTrend = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const key = localDateKey(d);
      revenueTrend.push({ date: key, revenue: trendMap.get(key) || 0 });
    }

    return res.status(200).json({
      totals,
      today: { sales: todaySales, customers: todayCustomers },
      week,
      month,
      repeatCustomers,
      newCustomersThisWeek,
      topCustomers: facets.topCustomers,
      recentTransactions: facets.recentTransactions,
      revenueTrend,
      offerUsage: facets.offerUsage,
      bestSellingCafeItems: facets.bestSellingCafeItems,
      activeSessions,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load dashboard stats" });
  }
};

const fetchcustomers = async (req, res) => {
  try {
    // Latest completed session of every customer
    const sessions = await sessionmodel
      .find({ status: "completed" })
      .select(
        "_id sessionNumber parentName mobileNumber bandNumber children createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    if (!sessions.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        customers: [],
      });
    }

    // Unique mobile numbers
    const mobileNumbers = [
      ...new Set(sessions.map((session) => session.mobileNumber)),
    ];

    // All completed sessions of those customers
    const completedSessions = await sessionmodel
      .find({
        status: "completed",
        mobileNumber: { $in: mobileNumbers },
      })
      .select("_id mobileNumber")
      .lean();

    // All invoices
    const invoices = await Invoice.find({
      session: { $in: completedSessions.map((s) => s._id) },
    })
      .select("session charges.grandTotal charges.loyaltyPoints")
      .lean();

    // Mobile lookup
    const sessionMobileMap = new Map(
      completedSessions.map((s) => [String(s._id), s.mobileNumber])
    );

    // Stats initialize
    const statsMap = new Map();

    mobileNumbers.forEach((mobile) => {
      statsMap.set(mobile, {
        visit_count: 0,
        total_spent: 0,
        reward_points: 0,
      });
    });

    // Visit count
    completedSessions.forEach((session) => {
      statsMap.get(session.mobileNumber).visit_count += 1;
    });

    // Total spent & reward points
    invoices.forEach((invoice) => {
      const mobile = sessionMobileMap.get(String(invoice.session));

      if (!mobile) return;

      const stats = statsMap.get(mobile);

      stats.total_spent += Number(invoice.charges?.grandTotal || 0);
      stats.reward_points += Number(invoice.charges?.loyaltyPoints || 0);
    });

    // One customer per mobile number
    const customersMap = new Map();

    sessions.forEach((session) => {
      if (!customersMap.has(session.mobileNumber)) {
        customersMap.set(session.mobileNumber, {
          ...session,
          ...statsMap.get(session.mobileNumber),
        });
      }
    });

    return res.status(200).json({
      success: true,
      count: customersMap.size,
      customers: [...customersMap.values()],
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Builds the [start, end) date range for a given calendar month (1-12) / year.
const monthRange = (month, year) => {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
};

// Per-customer stats for one calendar month, computed entirely via aggregation
// pipelines so the collections are never pulled into app memory wholesale —
// only the (small) set of rows matching that month's date range is scanned,
// and only one row per unique customer comes back out.
const getMonthlyReportData = async (month, year) => {
  const { start, end } = monthRange(month, year);

  const [visitAgg, invoiceAgg, cityAgg] = await Promise.all([
    sessionmodel.aggregate([
      { $match: { status: "completed", actualEndTime: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: "$mobileNumber",
          visits: { $sum: 1 },
          parentName: { $last: "$parentName" },
          customerId: { $last: "$sessionNumber" },
          childNameLists: { $push: "$children.name" },
        },
      },
      {
        $project: {
          visits: 1,
          parentName: 1,
          customerId: 1,
          childNames: {
            $reduce: {
              input: "$childNameLists",
              initialValue: [],
              in: { $setUnion: ["$$value", "$$this"] },
            },
          },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: "$customer.mobileNumber",
          totalSpent: { $sum: "$charges.grandTotal" },
          rewardPoints: { $sum: "$charges.loyaltyPoints" },
          sessionTotal: { $sum: "$charges.sessionTotal" },
          cafeTotal: { $sum: "$charges.cafeTotal" },
          socksQty: { $sum: "$charges.socksQty" },
          parentName: { $last: "$customer.parentName" },
          customerId: { $last: "$customer.sessionNumber" },
          city: { $last: "$customer.city" },
          offerName: { $last: "$offer.name" },
          membershipApplied: { $last: "$membership.applied" },
          membershipName: { $last: "$membership.planName" },
          childNameLists: { $push: "$children.name" },
        },
      },
      {
        $project: {
          totalSpent: 1,
          rewardPoints: 1,
          sessionTotal: 1,
          cafeTotal: 1,
          socksQty: 1,
          parentName: 1,
          customerId: 1,
          city: 1,
          offerName: 1,
          membershipApplied: 1,
          membershipName: 1,
          childNames: {
            $reduce: {
              input: "$childNameLists",
              initialValue: [],
              in: { $setUnion: ["$$value", "$$this"] },
            },
          },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { $ifNull: ["$customer.city", ""] },
          revenue: { $sum: "$charges.grandTotal" },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
  ]);

  const visitMap = new Map(visitAgg.map((row) => [row._id, row]));
  const invoiceMap = new Map(invoiceAgg.map((row) => [row._id, row]));
  const mobileNumbers = new Set([...visitMap.keys(), ...invoiceMap.keys()]);

  const customers = [...mobileNumbers].map((mobileNumber) => {
    const visitRow = visitMap.get(mobileNumber);
    const invoiceRow = invoiceMap.get(mobileNumber);
    const childNames = new Set([
      ...(visitRow?.childNames || []),
      ...(invoiceRow?.childNames || []),
    ]);

    const offerOrMembership = invoiceRow?.membershipApplied
      ? invoiceRow?.membershipName || "Membership"
      : invoiceRow?.offerName || "-";

    return {
      mobileNumber,
      customerId: invoiceRow?.customerId || visitRow?.customerId || "-",
      parentName: invoiceRow?.parentName || visitRow?.parentName || "-",
      city: invoiceRow?.city || "-",
      offerOrMembership,
      childNames: [...childNames],
      visits: visitRow?.visits || 0,
      rewardPoints: invoiceRow?.rewardPoints || 0,
      totalSpent: invoiceRow?.totalSpent || 0,
      sessionTotal: invoiceRow?.sessionTotal || 0,
      cafeTotal: invoiceRow?.cafeTotal || 0,
      socksQty: invoiceRow?.socksQty || 0,
    };
  });

  customers.sort((a, b) => b.totalSpent - a.totalSpent);

  const summary = customers.reduce(
    (acc, c) => {
      acc.totalVisits += c.visits;
      acc.totalRevenue += c.totalSpent;
      acc.totalRewardPoints += c.rewardPoints;
      acc.totalRevenueFromSessions += c.sessionTotal;
      acc.totalRevenueFromCafe += c.cafeTotal;
      acc.totalSocksIssued += c.socksQty;
      return acc;
    },
    {
      totalCustomers: customers.length,
      totalVisits: 0,
      totalRevenue: 0,
      totalRewardPoints: 0,
      totalRevenueFromSessions: 0,
      totalRevenueFromCafe: 0,
      totalSocksIssued: 0,
    }
  );

  const revenueByCity = cityAgg.map((row) => ({
    city: row._id?.trim() ? row._id.trim() : "Unknown",
    revenue: row.revenue || 0,
  }));

  return { month: Number(month), year: Number(year), monthName: MONTH_NAMES[month - 1], customers, summary, revenueByCity };
};

const parseMonthYear = (req, res) => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000) {
    res.status(400).json({ message: "Valid month (1-12) and year query params are required" });
    return null;
  }

  return { month, year };
};

const monthlyCustomerReport = async (req, res) => {
  try {
    const parsed = parseMonthYear(req, res);
    if (!parsed) return;

    const report = await getMonthlyReportData(parsed.month, parsed.year);
    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to generate monthly report" });
  }
};

const pad2 = (n) => String(n).padStart(2, "0");
const formatGeneratedOn = (date) =>
  `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const monthlyCustomerReportPdf = async (req, res) => {
  try {
    const parsed = parseMonthYear(req, res);
    if (!parsed) return;

    const report = await getMonthlyReportData(parsed.month, parsed.year);
    const { customers, summary, monthName, year, revenueByCity } = report;

    // Landscape — the report now carries 12 columns (city + offer/membership
    // + the session/cafe/socks breakdown added on top of the original 7),
    // which no longer fits comfortably on a portrait page.
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40, bufferPages: true });
    const filename = `Customer_Report_${monthName}_${year}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    const columns = [
      { key: "customerId", label: "Customer ID", width: 55 },
      { key: "childNames", label: "Child Name(s)", width: 85 },
      { key: "parentName", label: "Parent Name", width: 70 },
      { key: "mobileNumber", label: "Mobile Number", width: 75 },
      { key: "city", label: "City", width: 60 },
      { key: "offerOrMembership", label: "Offer / Membership", width: 80 },
      { key: "visits", label: "Visits", width: 35, align: "right" },
      { key: "sessionTotal", label: "Session Total", width: 60, align: "right" },
      { key: "cafeTotal", label: "Cafe Total", width: 55, align: "right" },
      { key: "socksQty", label: "Socks Qty", width: 45, align: "right" },
      { key: "rewardPoints", label: "Points", width: 45, align: "right" },
      { key: "totalSpent", label: "Total Spent", width: 65, align: "right" },
    ];
    const tableLeft = doc.page.margins.left;
    const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);
    const rowHeight = 22;
    const headerHeight = 24;
    // Fixed band (in points) reserved at the bottom of every page for the
    // footer, so content never has to share a page-break decision with it.
    const FOOTER_BAND_HEIGHT = 28;

    // Bottom edge that table rows / summary lines must stay above. Content
    // is never drawn into the reserved footer band.
    const contentBottom = () => doc.page.height - doc.page.margins.bottom - FOOTER_BAND_HEIGHT;

    const drawDocHeader = () => {
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text("Crazy Kids", tableLeft, 40);
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#334155").text("Monthly Customer Report", tableLeft, 62);
      doc.font("Helvetica").fontSize(10).fillColor("#64748b");
      doc.text(`Report Period : ${monthName} ${year}`, tableLeft, 84);
      doc.text(`Generated On  : ${formatGeneratedOn(new Date())}`, tableLeft, 98);
      doc.moveTo(tableLeft, 118).lineTo(tableLeft + tableWidth, 118).strokeColor("#cbd5e1").lineWidth(1).stroke();
      return 130;
    };

    const drawTableHeader = (y) => {
      doc.rect(tableLeft, y, tableWidth, headerHeight).fill("#0f172a");
      let x = tableLeft;
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#ffffff");
      columns.forEach((col) => {
        doc.text(col.label, x + 4, y + 8, { width: col.width - 8, align: col.align || "left", lineBreak: false });
        x += col.width;
      });
      return y + headerHeight;
    };

    // Draws the footer for the CURRENT page only, entirely within the
    // reserved FOOTER_BAND_HEIGHT band. The bottom margin is temporarily
    // zeroed while writing — otherwise pdfkit's automatic pagination sees
    // text placed past `page.margins.bottom` as overflow and silently
    // inserts a brand-new page to hold it (the bug this replaces: the
    // footer's two text() calls were each spawning their own extra page).
    // No doc.addPage() is ever called from here.
    const drawFooter = (pageNumber, pageCount) => {
      const page = doc.page;
      const originalBottomMargin = page.margins.bottom;
      const footerTop = page.height - originalBottomMargin;

      page.margins.bottom = 0;

      doc
        .moveTo(tableLeft, footerTop)
        .lineTo(tableLeft + tableWidth, footerTop)
        .strokeColor("#cbd5e1")
        .lineWidth(0.75)
        .stroke();

      doc.font("Helvetica").fontSize(8).fillColor("#94a3b8");
      doc.text("Generated by Crazy Kids Management System", tableLeft, footerTop + 8, {
        width: tableWidth / 2,
        align: "left",
        lineBreak: false,
      });
      doc.text(`Page ${pageNumber} of ${pageCount}`, tableLeft + tableWidth / 2, footerTop + 8, {
        width: tableWidth / 2,
        align: "right",
        lineBreak: false,
      });

      page.margins.bottom = originalBottomMargin;
    };

    let y = drawDocHeader();
    y = drawTableHeader(y);

    customers.forEach((customer, index) => {
      if (y + rowHeight > contentBottom()) {
        doc.addPage();
        y = drawDocHeader();
        y = drawTableHeader(y);
      }

      if (index % 2 === 1) {
        doc.rect(tableLeft, y, tableWidth, rowHeight).fill("#f8fafc");
      }

      let x = tableLeft;
      doc.font("Helvetica").fontSize(8.5).fillColor("#1e293b");
      const cells = {
        customerId: customer.customerId,
        childNames: customer.childNames.join(", ") || "-",
        parentName: customer.parentName,
        mobileNumber: customer.mobileNumber,
        city: customer.city || "-",
        offerOrMembership: customer.offerOrMembership || "-",
        visits: String(customer.visits),
        sessionTotal: `Rs. ${Number(customer.sessionTotal).toLocaleString("en-IN")}`,
        cafeTotal: `Rs. ${Number(customer.cafeTotal).toLocaleString("en-IN")}`,
        socksQty: String(customer.socksQty),
        rewardPoints: String(customer.rewardPoints),
        totalSpent: `Rs. ${Number(customer.totalSpent).toLocaleString("en-IN")}`,
      };
      columns.forEach((col) => {
        doc.text(cells[col.key], x + 4, y + 6, { width: col.width - 8, align: col.align || "left", lineBreak: false });
        x += col.width;
      });

      doc.rect(tableLeft, y, tableWidth, rowHeight).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
      y += rowHeight;
    });

    if (customers.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("No customer visits recorded for this month.", tableLeft, y + 10);
      y += 30;
    }

    // Summary block — reserve enough room for the heading + 7 lines, or
    // start a fresh page if it can't fit above the footer band.
    const summaryLines = [
      ["Total Customers", String(summary.totalCustomers)],
      ["Total Visits", String(summary.totalVisits)],
      ["Total Revenue", `Rs. ${Number(summary.totalRevenue).toLocaleString("en-IN")}`],
      ["Total Revenue From Sessions", `Rs. ${Number(summary.totalRevenueFromSessions).toLocaleString("en-IN")}`],
      ["Total Revenue From Cafe", `Rs. ${Number(summary.totalRevenueFromCafe).toLocaleString("en-IN")}`],
      ["Total Reward Points", String(summary.totalRewardPoints)],
      ["Total Socks Issued", String(summary.totalSocksIssued)],
    ];
    const SUMMARY_BLOCK_HEIGHT = 20 + 14 + 18 + summaryLines.length * 16;
    if (y + SUMMARY_BLOCK_HEIGHT > contentBottom()) {
      doc.addPage();
      y = drawDocHeader();
    }
    y += 20;
    doc.moveTo(tableLeft, y).lineTo(tableLeft + tableWidth, y).strokeColor("#cbd5e1").lineWidth(1).stroke();
    y += 14;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text("Summary", tableLeft, y, { lineBreak: false });
    y += 18;

    summaryLines.forEach(([label, value]) => {
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#334155").text(label, tableLeft, y, { width: 220, lineBreak: false });
      doc.font("Helvetica").fontSize(9.5).fillColor("#334155").text(value, tableLeft + 220, y, { lineBreak: false });
      y += 16;
    });

    if (revenueByCity.length > 0) {
      const cityBlockHeight = 20 + 14 + 18 + revenueByCity.length * 16;
      if (y + cityBlockHeight > contentBottom()) {
        doc.addPage();
        y = drawDocHeader();
      }
      y += 20;
      doc.moveTo(tableLeft, y).lineTo(tableLeft + tableWidth, y).strokeColor("#cbd5e1").lineWidth(1).stroke();
      y += 14;
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text("Revenue By City", tableLeft, y, { lineBreak: false });
      y += 18;

      revenueByCity.forEach(({ city, revenue }) => {
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#334155").text(city, tableLeft, y, { width: 220, lineBreak: false });
        doc.font("Helvetica").fontSize(9.5).fillColor("#334155").text(`Rs. ${Number(revenue).toLocaleString("en-IN")}`, tableLeft + 220, y, { lineBreak: false });
        y += 16;
      });
    }

    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i++) {
      doc.switchToPage(pageRange.start + i);
      drawFooter(i + 1, pageRange.count);
    }

    doc.end();
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ message: error.message || "Unable to generate monthly report PDF" });
    }
    res.end();
  }
};

module.exports = {
  fetchcustomers,
  dashboardStats,
  monthlyCustomerReport,
  monthlyCustomerReportPdf,
};