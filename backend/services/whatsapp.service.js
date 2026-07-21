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

// `campaignNameEnvVar` lets callers point at a different approved TrdAI
// template (e.g. WHATSAPP_OFFER_CAMPAIGN_NAME for offer broadcasts) while
// sharing the same apiKey/baseUrl — those two are account-level, not
// per-template.
const readConfig = (campaignNameEnvVar = "TRADAI_CAMPAIGN_NAME") => {
  const apiKey = process.env.TRADAI_API_KEY;
  const campaignName = process.env[campaignNameEnvVar];
  const baseUrl = process.env.TRADAI_BASE_URL;
  return { apiKey, campaignName, baseUrl };
};

// Shared HTTP mechanics for every TrdAI campaign-trigger call — building the
// request, parsing the response, and normalizing success/failure. Both
// sendInvoice and sendOffer build their own `payload` (different
// templateParams/media) and hand it here so the request/response handling
// (including TrdAI's string-"false" success quirk) only lives in one place.
const postCampaignTrigger = async (payload, { logLabel, baseUrl }) => {
  const { apiKey: _apiKey, ...payloadForLogging } = payload;
  console.log(`[whatsapp.service] ${logLabel} request payload (apiKey omitted):`, JSON.stringify(payloadForLogging));

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
    console.error(`[whatsapp.service] ${logLabel} network error`, networkError.name, networkError.message);
    const error = new Error(
      networkError.name === "TimeoutError"
        ? "WhatsApp API request timed out."
        : "Unable to reach WhatsApp API."
    );
    error.statusCode = 502;
    throw error;
  }

  console.log(`[whatsapp.service] ${logLabel} response`, { status: response.status, body });

  // A 2xx HTTP status alone isn't proof of success — TrdAI's own
  // success/failure flag has been observed as the *string* "true"/"false"
  // rather than a boolean (e.g. {"success":"true","submitted_message_id":
  // "..."}), so a strict `=== false` check would silently miss a
  // string-"false" failure. Normalize before comparing.
  const successFlag = body && typeof body === "object" ? body.success : undefined;
  const successFlagIsFalse =
    successFlag === false || (typeof successFlag === "string" && successFlag.toLowerCase() === "false");
  const bodyIndicatesFailure =
    body && typeof body === "object" && (body.status === "error" || successFlagIsFalse || body.error);

  if (!response.ok || bodyIndicatesFailure) {
    const message =
      (body && typeof body === "object" && (body.message || body.msg || body.error)) ||
      (typeof body === "string" && body) ||
      `WhatsApp API request failed with status ${response.status}`;
    // Explicit, unambiguous failure log — the complete TrdAI error body,
    // not just the derived `message` string being thrown.
    console.error(`[whatsapp.service] ${logLabel}: TrdAI reported failure`, {
      status: response.status,
      body,
      derivedMessage: message,
    });
    const error = new Error(message);
    error.statusCode = response.status >= 400 ? response.status : 502;
    throw error;
  }

  return { success: true, data: body };
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

  // Only the fields the TrdAI Campaign Trigger API documents are ever sent:
  // apiKey, campaignName, destination, userName, media, templateParams
  // (source/tags/attributes are omitted entirely since they're unused here).
  // templateParams is positional and maps 1:1 onto the approved
  // "invoiceandreview" template's body placeholders —
  // {{1}} Parent Name, {{2}} Invoice Number, {{3}} Grand Total, {{4}} Reward
  // Points — nothing else. There is deliberately no "buttons" key: the
  // template's Call button and static URL button are both static (a Call
  // button can never accept a parameter on WhatsApp's platform, and the
  // static URL button needs none), so no button parameters are ever
  // constructed or serialized here.
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

  return postCampaignTrigger(payload, { logLabel: "invoice", baseUrl });
};

// Sends one campaign-triggered WhatsApp message for an offer broadcast.
// Same TrdAI campaign-trigger contract as sendInvoice, but under its own
// campaign name (WHATSAPP_OFFER_CAMPAIGN_NAME) since offer broadcasts use a
// different approved template than the invoice one — and there is no PDF,
// so no `media` key is sent. templateParams maps 1:1 onto that template's
// body placeholders — {{1}} Parent Name, {{2}} Offer Name, {{3}} Offer
// detail.
const sendOffer = async ({ destination, userName, offerName, offerHighlight }) => {
  const { apiKey, campaignName, baseUrl } = readConfig("WHATSAPP_OFFER_CAMPAIGN_NAME");

  if (!apiKey || !campaignName || !baseUrl) {
    const error = new Error("WhatsApp offer sending is not configured on the server.");
    error.statusCode = 500;
    throw error;
  }

  const formattedDestination = formatDestination(destination);
  if (!formattedDestination) {
    const error = new Error("Customer mobile number not found.");
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    apiKey,
    campaignName,
    destination: formattedDestination,
    userName: userName || "Customer",
    // Static lead-source label (not user data) so every offer broadcast is
    // filterable/segmentable as its own source in the TrdAI dashboard —
    // that dashboard is the only place delivery/analytics get monitored,
    // per the "no in-app analytics" requirement for this feature.
    source: "admin-offer-broadcast",
    templateParams: [
      String(userName || "Customer"),
      String(offerName || "-"),
      String(offerHighlight || "-"),
    ],
  };

  return postCampaignTrigger(payload, { logLabel: "offer", baseUrl });
};

module.exports = { sendInvoice, sendOffer };
