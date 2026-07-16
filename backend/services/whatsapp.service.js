// Thin client around the TrdAI campaign-trigger API. Kept generic (destination
// + userName + templateParams + media) so it can be reused later for other
// campaigns (birthday messages, offer broadcasts, membership reminders) —
// not just invoice sending — without touching this module.

const TRADAI_TRIGGER_PATH = "/campaign/tradai/api/v2";
const REQUEST_TIMEOUT_MS = 15000;

// Normalizes a stored mobile number into TrdAI's expected WhatsApp
// destination format (+91XXXXXXXXXX). Bare 10-digit numbers are assumed to
// be Indian local numbers and get the country code prefixed; anything else
// is passed through with a leading "+" since it may already carry one.
const formatDestination = (mobileNumber) => {
  const digits = String(mobileNumber || "").replace(/\D/g, "");
  if (!digits) return null;
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `+${withCountryCode}`;
};

const readConfig = () => {
  const apiKey = process.env.TRADAI_API_KEY;
  const campaignName = process.env.TRADAI_CAMPAIGN_NAME;
  const baseUrl = process.env.TRADAI_BASE_URL;
  return { apiKey, campaignName, baseUrl };
};

// Sends one campaign-triggered WhatsApp message with a media attachment.
// Throws an Error with a `.statusCode` the caller can forward as-is —
// 4xx for caller-fixable problems (bad number, missing PDF, bad config),
// 502 for anything that went wrong talking to TrdAI itself.
const sendInvoice = async ({ destination, userName, invoiceNumber, grandTotal, rewardPoints, mediaUrl, mediaFilename }) => {
  const { apiKey, campaignName, baseUrl } = readConfig();

  if (!apiKey || !campaignName || !baseUrl) {
    const error = new Error("WhatsApp sending is not configured on the server.");
    error.statusCode = 500;
    throw error;
  }

  const formattedDestination = formatDestination(destination);
  if (!formattedDestination) {
    const error = new Error("Customer mobile number not found.");
    error.statusCode = 400;
    throw error;
  }

  if (!mediaUrl) {
    const error = new Error("Invoice PDF not found.");
    error.statusCode = 404;
    throw error;
  }

  const payload = {
    apiKey,
    campaignName,
    destination: formattedDestination,
    userName: userName || "Customer",
    templateParams: [
      String(userName || "Customer"),
      String(invoiceNumber || "-"),
      `Rs. ${Number(grandTotal || 0).toLocaleString("en-IN")}`,
      String(rewardPoints ?? 0),
    ],
    media: {
      url: mediaUrl,
      filename: mediaFilename || "invoice.pdf",
    },
  };

  // Log the exact outgoing JSON payload for debugging — apiKey omitted,
  // every other field (including templateParams/media) logged as-is so a
  // TrdAI rejection can be diagnosed from what we actually sent.
  const { apiKey: _apiKey, ...payloadForLogging } = payload;
  console.log("[whatsapp.service] request payload (apiKey omitted):", JSON.stringify(payloadForLogging));

  let response;
  let body;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}${TRADAI_TRIGGER_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const rawText = await response.text();
    try {
      body = rawText ? JSON.parse(rawText) : null;
    } catch {
      body = rawText;
    }
  } catch (networkError) {
    console.error("[whatsapp.service] network error", networkError.name, networkError.message);
    const error = new Error(
      networkError.name === "TimeoutError"
        ? "WhatsApp API request timed out."
        : "Unable to reach WhatsApp API."
    );
    error.statusCode = 502;
    throw error;
  }

  console.log("[whatsapp.service] response", { status: response.status, body });

  // A 2xx HTTP status alone isn't proof of success — some gateways return
  // 200 with an error payload — so also check common failure shapes in the
  // body before treating this as a successful send.
  const bodyIndicatesFailure =
    body && typeof body === "object" && (body.status === "error" || body.success === false || body.error);

  if (!response.ok || bodyIndicatesFailure) {
    const message =
      (body && typeof body === "object" && (body.message || body.msg || body.error)) ||
      (typeof body === "string" && body) ||
      `WhatsApp API request failed with status ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status >= 400 ? response.status : 502;
    throw error;
  }

  return { success: true, data: body };
};

module.exports = { sendInvoice };
