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
              {
                $group: {
                  _id: "$offer.name",
                  value: { $sum: 1 },
                  totalDiscount: { $sum: "$charges.discountAmount" },
                },
              },
              { $sort: { value: -1 } },
              { $limit: 8 },
            ],
            offerTotals: [
              { $match: { "offer.name": { $nin: ["", null] } } },
              {
                $group: {
                  _id: null,
                  usageCount: { $sum: 1 },
                  totalDiscount: { $sum: "$charges.discountAmount" },
                },
              },
            ],
            bestSellingCafeItems: [
              { $unwind: "$cafeItems" },
              { $group: { _id: "$cafeItems.name", qty: { $sum: "$cafeItems.quantity" } } },
              { $sort: { qty: -1 } },
              { $limit: 6 },
            ],
            revenueByArea: [
              {
                $group: {
                  _id: { $ifNull: ["$customer.area", ""] },
                  revenue: { $sum: "$charges.grandTotal" },
                  // Distinct customers (by mobile number), not invoice count —
                  // a repeat customer from the same area is counted once.
                  customers: { $addToSet: "$customer.mobileNumber" },
                },
              },
              { $project: { revenue: 1, customerCount: { $size: "$customers" } } },
              { $sort: { revenue: -1 } },
              { $limit: 10 },
            ],
            topCustomers: [
              {
                $group: {
                  _id: "$customer.mobileNumber",
                  parentName: { $last: "$customer.parentName" },
                  children: { $last: "$children" },
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
                  children: 1,
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
        .select("sessionNumber parentName children bandNumber scheduledEndTime")
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

    const revenueByArea = facets.revenueByArea.map((row) => ({
      area: row._id?.trim() ? row._id.trim() : "Unknown",
      revenue: row.revenue || 0,
      customerCount: row.customerCount || 0,
    }));

    const offerTotals = facets.offerTotals[0] || { usageCount: 0, totalDiscount: 0 };
    const mostUsedOffer = facets.offerUsage[0] || null;
    const offerAnalytics = {
      mostUsedOffer: mostUsedOffer?._id || null,
      mostUsedOfferCount: mostUsedOffer?.value || 0,
      usageCount: offerTotals.usageCount,
      totalDiscountGiven: offerTotals.totalDiscount,
      revenueSaved: offerTotals.totalDiscount,
    };

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
      offerAnalytics,
      bestSellingCafeItems: facets.bestSellingCafeItems,
      revenueByArea,
      activeSessions,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load dashboard stats" });
  }
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Server-side paginated + searchable customer directory. One row per unique
// mobileNumber (their latest completed session), grouped/paginated entirely
// via aggregation so the sessions collection is never pulled into app memory
// wholesale — only the requested page of grouped customers is scanned in
// detail, and per-customer spend/points are looked up only for that page's
// mobile numbers (not the whole invoice collection).
const fetchcustomers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();

    const pipeline = [
      { $match: { status: "completed" } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$mobileNumber",
          latestSession: { $first: "$$ROOT" },
          visit_count: { $sum: 1 },
        },
      },
    ];

    if (search) {
      const pattern = escapeRegex(search);
      pipeline.push({
        $match: {
          $or: [
            { "latestSession.parentName": { $regex: pattern, $options: "i" } },
            { "latestSession.mobileNumber": { $regex: pattern, $options: "i" } },
            { "latestSession.bandNumber": { $regex: pattern, $options: "i" } },
            { "latestSession.sessionNumber": { $regex: pattern, $options: "i" } },
            { "latestSession.children.name": { $regex: pattern, $options: "i" } },
          ],
        },
      });
    }

    pipeline.push(
      { $sort: { "latestSession.createdAt": -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      }
    );

    const [result] = await sessionmodel.aggregate(pipeline);
    const rows = result?.data || [];
    const total = result?.totalCount?.[0]?.count || 0;

    if (!rows.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        total,
        page,
        limit,
        customers: [],
      });
    }

    const mobileNumbers = rows.map((row) => row._id);

    const invoiceStats = await Invoice.aggregate([
      { $match: { "customer.mobileNumber": { $in: mobileNumbers } } },
      {
        $group: {
          _id: "$customer.mobileNumber",
          total_spent: { $sum: "$charges.grandTotal" },
          reward_points: { $sum: "$charges.loyaltyPoints" },
        },
      },
    ]);
    const statsMap = new Map(invoiceStats.map((row) => [row._id, row]));

    const customers = rows.map((row) => {
      const session = row.latestSession;
      const stats = statsMap.get(row._id) || { total_spent: 0, reward_points: 0 };

      return {
        id: String(session._id),
        _id: session._id,
        sessionNumber: session.sessionNumber,
        parentName: session.parentName,
        mobileNumber: session.mobileNumber,
        bandNumber: session.bandNumber,
        children: session.children,
        createdAt: session.createdAt,
        visit_count: row.visit_count,
        total_spent: Number(stats.total_spent || 0),
        reward_points: Number(stats.reward_points || 0),
      };
    });

    return res.status(200).json({
      success: true,
      count: customers.length,
      total,
      page,
      limit,
      customers,
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

// Builds the [start, end) date range for a full calendar year.
const yearRange = (year) => {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year + 1, 0, 1, 0, 0, 0, 0);
  return { start, end };
};

// Per-customer stats for an arbitrary [start, end) date range, computed
// entirely via aggregation pipelines so the collections are never pulled into
// app memory wholesale — only the (small) set of rows matching the range is
// scanned, and only one row per unique customer comes back out. Shared by
// both the Monthly and Yearly reports (getMonthlyReportData / below) — only
// the date range differs between them, every field/metric is identical.
const getCustomerReportDataForRange = async (start, end) => {
  const [visitAgg, invoiceAgg, cityAgg, areaAgg] = await Promise.all([
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
          area: { $last: "$customer.area" },
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
          area: 1,
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
    Invoice.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { $ifNull: ["$customer.area", ""] },
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
      area: invoiceRow?.area || "-",
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

  const revenueByArea = areaAgg.map((row) => ({
    area: row._id?.trim() ? row._id.trim() : "Unknown",
    revenue: row.revenue || 0,
  }));

  return { customers, summary, revenueByCity, revenueByArea };
};

const getMonthlyReportData = async (month, year) => {
  const { start, end } = monthRange(month, year);
  const data = await getCustomerReportDataForRange(start, end);
  return { month: Number(month), year: Number(year), monthName: MONTH_NAMES[month - 1], ...data };
};

// Same fields/metrics as the monthly report — only the date range (a full
// calendar year instead of one month) differs.
const getYearlyReportData = async (year) => {
  const { start, end } = yearRange(year);
  const data = await getCustomerReportDataForRange(start, end);
  return { year: Number(year), ...data };
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

// Renders the customer report PDF shared by Monthly and Yearly reports —
// same columns, same summary/revenue cards, same pagination; only the title
// line, period label, and filename differ between the two callers below.
const renderCustomerReportPdf = (res, { reportTitle, periodLabel, filename, report }) => {
  const { customers, summary, revenueByCity, revenueByArea } = report;

    // Landscape — the report now carries 13 columns (area + city +
    // offer/membership + the session/cafe/socks breakdown added on top of
    // the original 7), which no longer fits comfortably on a portrait page.
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40, bufferPages: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Widths are sized so every header label fits within two wrapped lines
    // at HEADER_FONT_SIZE (verified against this exact label set) — the
    // previous single-line, no-wrap headers routinely overflowed into the
    // neighbouring column. Data cells stay single-line with an ellipsis,
    // except childNames which is allowed to wrap across multiple lines
    // (rows below size themselves to whichever is tallest).
    const columns = [
      { key: "customerId", label: "Customer ID", width: 55, align: "left" },
      { key: "childNames", label: "Child Name(s)", width: 92, align: "left", wrap: true },
      { key: "parentName", label: "Parent Name / Guardian Name", width: 96, align: "left" },
      { key: "mobileNumber", label: "Mobile Number", width: 70, align: "left" },
      { key: "area", label: "Area", width: 40, align: "left" },
      { key: "city", label: "City", width: 44, align: "left" },
      { key: "offerOrMembership", label: "Offer / Membership", width: 72, align: "left" },
      { key: "visits", label: "Visits", width: 36, align: "right" },
      { key: "sessionTotal", label: "Session Total", width: 58, align: "right" },
      { key: "cafeTotal", label: "Cafe Total", width: 50, align: "right" },
      { key: "socksQty", label: "Socks Qty", width: 40, align: "right" },
      { key: "rewardPoints", label: "Points", width: 42, align: "right" },
      { key: "totalSpent", label: "Total Spent", width: 60, align: "right" },
    ];
    const tableLeft = doc.page.margins.left;
    const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);
    const CELL_PAD_X = 6;
    const CELL_PAD_Y = 7;
    const HEADER_FONT_SIZE = 7.5;
    const CELL_FONT_SIZE = 8;
    const MIN_ROW_HEIGHT = 24;
    const headerHeight = 32;
    // Fixed band (in points) reserved at the bottom of every page for the
    // footer, so content never has to share a page-break decision with it.
    const FOOTER_BAND_HEIGHT = 28;

    // Bottom edge that table rows / summary lines must stay above. Content
    // is never drawn into the reserved footer band.
    const contentBottom = () => doc.page.height - doc.page.margins.bottom - FOOTER_BAND_HEIGHT;

    const drawDocHeader = () => {
      doc.rect(0, 0, doc.page.width, 6).fill("#2563eb");
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text("Crazy Kids", tableLeft, 40);
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#334155").text(reportTitle, tableLeft, 62);
      doc.font("Helvetica").fontSize(10).fillColor("#64748b");
      doc.text(`Report Period : ${periodLabel}`, tableLeft, 84);
      doc.text(`Generated On  : ${formatGeneratedOn(new Date())}`, tableLeft, 98);
      doc.moveTo(tableLeft, 118).lineTo(tableLeft + tableWidth, 118).strokeColor("#cbd5e1").lineWidth(1).stroke();
      return 130;
    };

    const drawTableHeader = (y) => {
      doc.rect(tableLeft, y, tableWidth, headerHeight).fill("#0f172a");
      let x = tableLeft;
      doc.font("Helvetica-Bold").fontSize(HEADER_FONT_SIZE).fillColor("#ffffff");
      columns.forEach((col) => {
        doc.text(col.label, x + CELL_PAD_X, y + 7, {
          width: col.width - CELL_PAD_X * 2,
          align: col.align || "left",
        });
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

    const childNamesCol = columns.find((col) => col.key === "childNames");

    customers.forEach((customer, index) => {
      const cells = {
        customerId: customer.customerId,
        childNames: customer.childNames.join(", ") || "-",
        parentName: customer.parentName,
        mobileNumber: customer.mobileNumber,
        area: customer.area || "-",
        city: customer.city || "-",
        offerOrMembership: customer.offerOrMembership || "-",
        visits: String(customer.visits),
        sessionTotal: `Rs. ${Number(customer.sessionTotal).toLocaleString("en-IN")}`,
        cafeTotal: `Rs. ${Number(customer.cafeTotal).toLocaleString("en-IN")}`,
        socksQty: String(customer.socksQty),
        rewardPoints: String(customer.rewardPoints),
        totalSpent: `Rs. ${Number(customer.totalSpent).toLocaleString("en-IN")}`,
      };

      doc.font("Helvetica").fontSize(CELL_FONT_SIZE);
      const wrappedHeight = doc.heightOfString(cells.childNames, {
        width: childNamesCol.width - CELL_PAD_X * 2,
      });
      const rowHeight = Math.max(MIN_ROW_HEIGHT, wrappedHeight + CELL_PAD_Y * 2);

      if (y + rowHeight > contentBottom()) {
        doc.addPage();
        y = drawDocHeader();
        y = drawTableHeader(y);
      }

      if (index % 2 === 1) {
        doc.rect(tableLeft, y, tableWidth, rowHeight).fill("#f8fafc");
      }

      let x = tableLeft;
      doc.font("Helvetica").fontSize(CELL_FONT_SIZE).fillColor("#1e293b");
      columns.forEach((col) => {
        const textOptions = col.wrap
          ? { width: col.width - CELL_PAD_X * 2, align: col.align || "left" }
          : { width: col.width - CELL_PAD_X * 2, align: col.align || "left", lineBreak: false, ellipsis: true };
        doc.text(cells[col.key], x + CELL_PAD_X, y + CELL_PAD_Y - 3, textOptions);
        x += col.width;
      });

      doc.rect(tableLeft, y, tableWidth, rowHeight).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
      y += rowHeight;
    });

    if (customers.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor("#64748b").text("No customer visits recorded for this period.", tableLeft, y + 10);
      y += 30;
    }

    // Summary / revenue-by-city are rendered as bordered "card" blocks —
    // a dark title bar plus zebra-striped label/value rows — matching the
    // table's visual language instead of a bare list of lines.
    const CARD_HEADER_HEIGHT = 26;
    const CARD_ROW_HEIGHT = 20;
    const CARD_GAP = 18;

    const drawCardSection = (title, rows, startY) => {
      const blockHeight = CARD_HEADER_HEIGHT + rows.length * CARD_ROW_HEIGHT;
      let sectionY = startY;
      if (sectionY + blockHeight > contentBottom()) {
        doc.addPage();
        sectionY = drawDocHeader();
      }

      doc.rect(tableLeft, sectionY, tableWidth, CARD_HEADER_HEIGHT).fill("#0f172a");
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#ffffff")
        .text(title, tableLeft + 10, sectionY + 7, { lineBreak: false });

      let rowY = sectionY + CARD_HEADER_HEIGHT;
      rows.forEach(([label, value], index) => {
        if (index % 2 === 1) {
          doc.rect(tableLeft, rowY, tableWidth, CARD_ROW_HEIGHT).fill("#f8fafc");
        }
        doc.font("Helvetica").fontSize(9.5).fillColor("#334155")
          .text(label, tableLeft + 10, rowY + 5, { width: tableWidth * 0.6, lineBreak: false, ellipsis: true });
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0f172a")
          .text(value, tableLeft + 10, rowY + 5, { width: tableWidth - 20, align: "right", lineBreak: false });
        rowY += CARD_ROW_HEIGHT;
      });

      doc.rect(tableLeft, sectionY, tableWidth, blockHeight)
        .strokeColor("#e2e8f0").lineWidth(0.75).stroke();

      return rowY + CARD_GAP;
    };

    const summaryLines = [
      ["Total Customers", String(summary.totalCustomers)],
      ["Total Visits", String(summary.totalVisits)],
      ["Total Revenue", `Rs. ${Number(summary.totalRevenue).toLocaleString("en-IN")}`],
      ["Total Revenue From Sessions", `Rs. ${Number(summary.totalRevenueFromSessions).toLocaleString("en-IN")}`],
      ["Total Revenue From Cafe", `Rs. ${Number(summary.totalRevenueFromCafe).toLocaleString("en-IN")}`],
      ["Total Reward Points", String(summary.totalRewardPoints)],
      ["Total Socks Issued", String(summary.totalSocksIssued)],
    ];

    y = drawCardSection("Summary", summaryLines, y + CARD_GAP);

    if (revenueByArea.length > 0) {
      const areaRows = revenueByArea.map(({ area, revenue }) => [
        area,
        `Rs. ${Number(revenue).toLocaleString("en-IN")}`,
      ]);
      y = drawCardSection("Revenue By Area", areaRows, y);
    }

    if (revenueByCity.length > 0) {
      const cityRows = revenueByCity.map(({ city, revenue }) => [
        city,
        `Rs. ${Number(revenue).toLocaleString("en-IN")}`,
      ]);
      y = drawCardSection("Revenue By City", cityRows, y);
    }

    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i++) {
      doc.switchToPage(pageRange.start + i);
      drawFooter(i + 1, pageRange.count);
    }

    doc.end();
};

const monthlyCustomerReportPdf = async (req, res) => {
  try {
    const parsed = parseMonthYear(req, res);
    if (!parsed) return;

    const report = await getMonthlyReportData(parsed.month, parsed.year);
    renderCustomerReportPdf(res, {
      reportTitle: "Monthly Customer Report",
      periodLabel: `${report.monthName} ${report.year}`,
      filename: `Customer_Report_${report.monthName}_${report.year}.pdf`,
      report,
    });
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ message: error.message || "Unable to generate monthly report PDF" });
    }
    res.end();
  }
};

const parseYear = (req, res) => {
  const year = Number(req.query.year);

  if (!Number.isInteger(year) || year < 2000) {
    res.status(400).json({ message: "Valid year query param is required" });
    return null;
  }

  return { year };
};

const yearlyCustomerReport = async (req, res) => {
  try {
    const parsed = parseYear(req, res);
    if (!parsed) return;

    const report = await getYearlyReportData(parsed.year);
    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to generate yearly report" });
  }
};

const yearlyCustomerReportPdf = async (req, res) => {
  try {
    const parsed = parseYear(req, res);
    if (!parsed) return;

    const report = await getYearlyReportData(parsed.year);
    renderCustomerReportPdf(res, {
      reportTitle: "Yearly Customer Report",
      periodLabel: String(report.year),
      filename: `Customer_Report_${report.year}.pdf`,
      report,
    });
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ message: error.message || "Unable to generate yearly report PDF" });
    }
    res.end();
  }
};

module.exports = {
  fetchcustomers,
  dashboardStats,
  monthlyCustomerReport,
  monthlyCustomerReportPdf,
  yearlyCustomerReport,
  yearlyCustomerReportPdf,
};