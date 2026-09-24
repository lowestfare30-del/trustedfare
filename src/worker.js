import HTML_PAGE from "./index.html";

const IGNAV_BASE = "https://ignav.com/api";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
    }
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(HTML_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (url.pathname === "/api/search" && request.method === "POST") { return handleSearch(request, env, ctx); }
    if (url.pathname === "/api/booking-link" && request.method === "POST") { return handleBookingLink(request, env, ctx); }
    if (url.pathname === "/api/enquiry" && request.method === "POST") { return handleEnquiry(request, env, ctx); }
    if (url.pathname === "/api/airports" && request.method === "GET") { return handleAirportSearch(request, env, ctx); }
    return new Response("Not found", { status: 404 });
  },
};

async function handleAirportSearch(request, env, ctx) {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  if (!q || q.length < 2) { return jsonResponse([], 200, cors); }
  if (!env.IGNAV_API_KEY) { return jsonResponse([], 200, cors); }
  try {
    const limit = url.searchParams.get("limit") || "8";
    const apiResp = await fetch(IGNAV_BASE + "/airports?q=" + encodeURIComponent(q) + "&limit=" + limit, {
      headers: { "X-Api-Key": env.IGNAV_API_KEY }
    });
    if (!apiResp.ok) { return jsonResponse([], 200, cors); }
    const results = await apiResp.json();
    return jsonResponse(results, 200, cors);
  } catch (e) { return jsonResponse([], 200, cors); }
}

async function handleSearch(request, env, ctx) {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  let data;
  try { data = await request.json(); } catch { return jsonResponse({ success: false, message: "Invalid JSON body." }, 400, cors); }
  if (!data.origin || !data.destination || !data.departure_date) { return jsonResponse({ success: false, message: "Missing required fields." }, 400, cors); }
  if (data.origin === data.destination) { return jsonResponse({ success: false, message: "Origin and destination cannot be the same." }, 400, cors); }
  const isRoundTrip = !!data.return_date;
  const endpoint = isRoundTrip ? IGNAV_BASE + "/fares/round-trip" : IGNAV_BASE + "/fares/one-way";
  const apiBody = { origin: data.origin, destination: data.destination, departure_date: data.departure_date, cabin_class: data.cabin_class || "economy" };
  if (isRoundTrip) apiBody.return_date = data.return_date;
  if (data.adults) apiBody.adults = data.adults;
  if (data.children) apiBody.children = data.children;
  if (data.infants) apiBody.infants = data.infants;
  if (env.ENQUIRIES) { const enquiryId = "enquiry_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8); ctx.waitUntil(env.ENQUIRIES.put(enquiryId, JSON.stringify(data), { expirationTtl: 7776000 })); }
  if (env.WEB3FORMS_KEY) { ctx.waitUntil(sendNotificationEmail(env, data, isRoundTrip)); }
  if (!env.IGNAV_API_KEY) { return jsonResponse({ success: false, message: "Flight search is not configured." }, 500, cors); }
  try {
    const apiResp = await fetch(endpoint, { method: "POST", headers: { "X-Api-Key": env.IGNAV_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify(apiBody) });
    if (!apiResp.ok) { return jsonResponse({ success: false, message: "Flight search temporarily unavailable. Call +91 6239946206." }, 502, cors); }
    const flightData = await apiResp.json();
    return jsonResponse(flightData, 200, cors);
  } catch (e) { return jsonResponse({ success: false, message: "Unable to reach flight search." }, 502, cors); }
}

async function handleBookingLink(request, env, ctx) {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  let data;
  try { data = await request.json(); } catch { return jsonResponse({ success: false, message: "Invalid JSON body." }, 400, cors); }
  if (!data.ignav_id) { return jsonResponse({ success: false, message: "Missing ignav_id." }, 400, cors); }
  if (!env.IGNAV_API_KEY) { return jsonResponse({ success: false, message: "Booking not configured." }, 500, cors); }
  try {
    const apiResp = await fetch(IGNAV_BASE + "/fares/booking-links", { method: "POST", headers: { "X-Api-Key": env.IGNAV_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ ignav_id: data.ignav_id }) });
    if (!apiResp.ok) { return jsonResponse({ success: false, message: "Could not retrieve booking link." }, 502, cors); }
    const result = await apiResp.json();
    let bookingUrl = null;
    if (result.booking_options && result.booking_options.length > 0) { const firstOption = result.booking_options[0]; if (firstOption.links && firstOption.links.length > 0) { bookingUrl = firstOption.links[0].url; } }
    if (!bookingUrl) { bookingUrl = result.booking_url || result.url || result.link; }
    if (bookingUrl) { return jsonResponse({ success: true, booking_url: bookingUrl }, 200, cors); }
    else { return jsonResponse({ success: false, message: "No booking link available." }, 404, cors); }
  } catch (e) { return jsonResponse({ success: false, message: "Could not retrieve booking link." }, 502, cors); }
}

async function handleEnquiry(request, env, ctx) {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  let data;
  try { data = await request.json(); } catch { return jsonResponse({ success: false, message: "Invalid JSON body." }, 400, cors); }
  const enquiryId = "enquiry_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  if (env.ENQUIRIES) { ctx.waitUntil(env.ENQUIRIES.put(enquiryId, JSON.stringify(data), { expirationTtl: 7776000 })); }
  if (env.WEB3FORMS_KEY) { ctx.waitUntil(sendNotificationEmail(env, data, !!data.return_date)); }
  return jsonResponse({ success: true, message: "Enquiry submitted.", enquiryId }, 200, cors);
}

async function sendNotificationEmail(env, data, isRoundTrip) {
  try {
    const tp = [];
    if (data.adults) tp.push(data.adults + " Adult(s)");
    if (data.children) tp.push(data.children + " Child(ren)");
    if (data.infants) tp.push(data.infants + " Infant(s)");
    const travelerSummary = tp.join(", ") || "1 Adult";
    const messageBody = ["NEW FLIGHT SEARCH - TRUSTEDFARE", "================================", "", "Route: " + data.origin + " to " + data.destination, "Departure: " + data.departure_date, isRoundTrip ? "Return: " + data.return_date : "One-way", "Cabin: " + (data.cabin_class || "economy"), "Travelers: " + travelerSummary, "", "CUSTOMER CONTACT", "Phone: " + (data.customerMobile || "N/A"), "Email: " + (data.customerEmail || "N/A"), "", "Submitted: " + (data.submittedAt || new Date().toISOString()), "================================"].join("\n");
    await fetch("https://api.web3forms.com/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_key: env.WEB3FORMS_KEY, subject: "New Flight Search - " + data.origin + " to " + data.destination, from_name: "TrustedFare Website", to: "gm@trustedfare.com", replyto: data.customerEmail || "noreply@trustedfare.com", message: messageBody }) });
  } catch (e) { console.error("Email send failed:", e.message); }
}

function jsonResponse(obj, status, headers) { return new Response(JSON.stringify(obj), { status, headers }); }
