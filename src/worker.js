import HTML_PAGE from "./index.html";
import ADMIN_PAGE from "./admin.html";

const IGNAV_BASE = "https://ignav.com/api";
const ADMIN_PASSWORD = "trustedfare2026";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
    }
    if (url.pathname === "/" && request.method === "GET") return new Response(HTML_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    if (url.pathname === "/admin" && request.method === "GET") return new Response(ADMIN_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    if (url.pathname === "/api/search" && request.method === "POST") return handleSearch(request, env, ctx);
    if (url.pathname === "/api/search/multi-city" && request.method === "POST") return handleMultiCitySearch(request, env, ctx);
    if (url.pathname === "/api/booking-link" && request.method === "POST") return handleBookingLink(request, env, ctx);
    if (url.pathname === "/api/airports" && request.method === "GET") return handleAirportSearch(request, env, ctx);
    if (url.pathname === "/api/health" && request.method === "GET") return handleHealthCheck(request, env, ctx);
    if (url.pathname === "/api/price-track" && request.method === "POST") return handlePriceTrack(request, env, ctx);
    if (url.pathname === "/api/price-track" && request.method === "GET") return handlePriceTrackGet(request, env, ctx);
    if (url.pathname === "/api/enquiry" && request.method === "POST") return handleEnquiry(request, env, ctx);
    if (url.pathname === "/api/create-booking" && request.method === "POST") return handleCreateBooking(request, env, ctx);
    if (url.pathname === "/api/payment" && request.method === "POST") return handlePaymentSubmit(request, env, ctx);
    if (url.pathname === "/api/upload-passport" && request.method === "POST") return handleUploadPassport(request, env, ctx);
    if (url.pathname === "/api/booking-status" && request.method === "GET") return handleBookingStatus(request, env, ctx);
    if (url.pathname === "/api/admin/login" && request.method === "POST") return handleAdminLogin(request, env, ctx);
    if (url.pathname === "/api/admin/bookings" && request.method === "GET") return handleAdminBookings(request, env, ctx);
    if (url.pathname === "/api/admin/verify" && request.method === "POST") return handleAdminVerify(request, env, ctx);
    if (url.pathname === "/api/admin/ticket" && request.method === "POST") return handleAdminTicket(request, env, ctx);
    if (url.pathname === "/api/ticket-download" && request.method === "GET") return handleTicketDownload(request, env, ctx);
    return new Response("Not found", { status: 404 });
  },
};

// ─── Health Check ──────────────────────────────────────────────
async function handleHealthCheck(request, env, ctx) {
  const cors = corsHeaders();
  try {
    const apiResp = await fetch(IGNAV_BASE + "/health");
    const data = await apiResp.json();
    return jsonResponse({ ...data, worker: "trustedfare" }, 200, cors);
  } catch {
    return jsonResponse({ ok: false, error: "Cannot reach Ignav API" }, 502, cors);
  }
}

// ─── Airport Search ────────────────────────────────────────────
async function handleAirportSearch(request, env, ctx) {
  const cors = corsHeaders();
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  if (!q || q.length < 2) return jsonResponse([], 200, cors);
  if (!env.IGNAV_API_KEY) return jsonResponse([], 200, cors);
  try {
    const limit = url.searchParams.get("limit") || "10";
    const apiResp = await fetch(IGNAV_BASE + "/airports?q=" + encodeURIComponent(q) + "&limit=" + limit, { headers: { "X-Api-Key": env.IGNAV_API_KEY } });
    if (!apiResp.ok) return jsonResponse([], 200, cors);
    const results = await apiResp.json();
    return jsonResponse(results, 200, cors);
  } catch {
    return jsonResponse([], 200, cors);
  }
}

// ─── One-Way & Round-Trip Search ───────────────────────────────
async function handleSearch(request, env, ctx) {
  const cors = corsHeaders();
  let data;
  try { data = await request.json(); } catch { return jsonResponse({ success: false, message: "Invalid JSON body." }, 400, cors); }
  if (!data.origin || !data.destination || !data.departure_date) return jsonResponse({ success: false, message: "Missing required fields." }, 400, cors);
  if (data.origin === data.destination) return jsonResponse({ success: false, message: "Origin and destination cannot be the same." }, 400, cors);
  const isRoundTrip = !!data.return_date;
  const endpoint = isRoundTrip ? IGNAV_BASE + "/fares/round-trip" : IGNAV_BASE + "/fares/one-way";
  const apiBody = { origin: data.origin, destination: data.destination, departure_date: data.departure_date };
  if (isRoundTrip) apiBody.return_date = data.return_date;
  if (data.cabin_class) apiBody.cabin_class = data.cabin_class;
  if (data.adults) apiBody.adults = data.adults;
  if (data.children) apiBody.children = data.children;
  if (data.infants_in_seat) apiBody.infants_in_seat = data.infants_in_seat;
  if (data.infants_on_lap) apiBody.infants_on_lap = data.infants_on_lap;
  if (data.infants) {
    const adults = data.adults || 1;
    if (data.infants <= adults) {
      apiBody.infants_on_lap = data.infants;
    } else {
      apiBody.infants_on_lap = adults;
      apiBody.infants_in_seat = data.infants - adults;
    }
  }
  if (data.max_stops !== undefined && data.max_stops !== null) apiBody.max_stops = data.max_stops;
  if (data.min_carry_on_bags) apiBody.min_carry_on_bags = data.min_carry_on_bags;
  if (data.min_checked_bags) apiBody.min_checked_bags = data.min_checked_bags;
  if (data.max_price) apiBody.max_price = data.max_price;
  if (data.departure_time_range) apiBody.departure_time_range = data.departure_time_range;
  if (isRoundTrip && data.return_time_range) apiBody.return_time_range = data.return_time_range;
  if (data.airlines_include) apiBody.airlines_include = data.airlines_include;
  if (data.airlines_exclude) apiBody.airlines_exclude = data.airlines_exclude;
  if (data.allow_self_transfer !== undefined) apiBody.allow_self_transfer = data.allow_self_transfer;
  if (data.market) apiBody.market = data.market;
  if (env.ENQUIRIES) {
    const enquiryId = "enquiry_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    ctx.waitUntil(env.ENQUIRIES.put(enquiryId, JSON.stringify(data), { expirationTtl: 7776000 }));
  }
  if (env.WEB3FORMS_KEY) ctx.waitUntil(sendNotificationEmail(env, data, isRoundTrip));
  if (!env.IGNAV_API_KEY) return jsonResponse({ success: false, message: "Flight search is not configured." }, 500, cors);
  try {
    const apiResp = await fetch(endpoint, { method: "POST", headers: { "X-Api-Key": env.IGNAV_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify(apiBody) });
    if (!apiResp.ok) return jsonResponse({ success: false, message: "Flight search temporarily unavailable. Call +91 6239946206." }, 502, cors);
    const flightData = await apiResp.json();
    return jsonResponse(flightData, 200, cors);
  } catch {
    return jsonResponse({ success: false, message: "Unable to reach flight search." }, 502, cors);
  }
}

// ─── Multi-City / Flexible Search ──────────────────────────────
async function handleMultiCitySearch(request, env, ctx) {
  const cors = corsHeaders();
  let data;
  try { data = await request.json(); } catch { return jsonResponse({ success: false, message: "Invalid JSON body." }, 400, cors); }
  if (!data.legs || !Array.isArray(data.legs) || data.legs.length === 0) return jsonResponse({ success: false, message: "Missing or invalid legs array." }, 400, cors);
  for (const leg of data.legs) {
    if (!leg.origin || !leg.destination || !leg.departure_date) return jsonResponse({ success: false, message: "Each leg needs origin, destination, and departure_date." }, 400, cors);
  }
  const apiBody = { legs: data.legs };
  if (data.adults) apiBody.adults = data.adults;
  if (data.children) apiBody.children = data.children;
  if (data.infants_in_seat) apiBody.infants_in_seat = data.infants_in_seat;
  if (data.infants_on_lap) apiBody.infants_on_lap = data.infants_on_lap;
  if (data.infants) {
    const adults = data.adults || 1;
    if (data.infants <= adults) { apiBody.infants_on_lap = data.infants; }
    else { apiBody.infants_on_lap = adults; apiBody.infants_in_seat = data.infants - adults; }
  }
  if (data.cabin_class) apiBody.cabin_class = data.cabin_class;
  if (data.min_carry_on_bags) apiBody.min_carry_on_bags = data.min_carry_on_bags;
  if (data.min_checked_bags) apiBody.min_checked_bags = data.min_checked_bags;
  if (data.max_price) apiBody.max_price = data.max_price;
  if (data.airlines_include) apiBody.airlines_include = data.airlines_include;
  if (data.airlines_exclude) apiBody.airlines_exclude = data.airlines_exclude;
  if (data.allow_self_transfer !== undefined) apiBody.allow_self_transfer = data.allow_self_transfer;
  if (data.market) apiBody.market = data.market;
  if (!env.IGNAV_API_KEY) return jsonResponse({ success: false, message: "Flight search is not configured." }, 500, cors);
  try {
    const apiResp = await fetch(IGNAV_BASE + "/fares/search", { method: "POST", headers: { "X-Api-Key": env.IGNAV_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify(apiBody) });
    if (!apiResp.ok) return jsonResponse({ success: false, message: "Flight search temporarily unavailable. Call +91 6239946206." }, 502, cors);
    const flightData = await apiResp.json();
    return jsonResponse(flightData, 200, cors);
  } catch {
    return jsonResponse({ success: false, message: "Unable to reach flight search." }, 502, cors);
  }
}

// ─── Booking Links ─────────────────────────────────────────────
async function handleBookingLink(request, env, ctx) {
  const cors = corsHeaders();
  let data;
  try { data = await request.json(); } catch { return jsonResponse({ success: false, message: "Invalid JSON body." }, 400, cors); }
  if (!data.ignav_id) return jsonResponse({ success: false, message: "Missing ignav_id." }, 400, cors);
  if (!env.IGNAV_API_KEY) return jsonResponse({ success: false, message: "Booking not configured." }, 500, cors);
  try {
    const apiResp = await fetch(IGNAV_BASE + "/fares/booking-links", { method: "POST", headers: { "X-Api-Key": env.IGNAV_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ ignav_id: data.ignav_id }) });
    if (!apiResp.ok) return jsonResponse({ success: false, message: "Could not retrieve booking link." }, 502, cors);
    const result = await apiResp.json();
    let bookingUrl = null;
    let allLinks = [];
    if (result.booking_options && result.booking_options.length > 0) {
      for (const option of result.booking_options) {
        if (option.links) {
          for (const link of option.links) {
            allLinks.push({ provider_name: link.provider_name, provider_type: link.provider_type, price: link.price, url: link.url, leg_indexes: option.leg_indexes });
            if (!bookingUrl) bookingUrl = link.url;
          }
        }
      }
    }
    return jsonResponse({ success: true, booking_url: bookingUrl, all_links: allLinks, itinerary: result.itinerary || null, booking_options: result.booking_options || [] }, 200, cors);
  } catch {
    return jsonResponse({ success: false, message: "Could not retrieve booking link." }, 502, cors);
  }
}

// ─── Price Tracking (stores in KV) ─────────────────────────────
async function handlePriceTrack(request, env, ctx) {
  const cors = corsHeaders();
  let data;
  try { data = await request.json(); } catch { return jsonResponse({ success: false, message: "Invalid JSON body." }, 400, cors); }
  if (!data.origin || !data.destination || !data.departure_date) return jsonResponse({ success: false, message: "Missing origin, destination, or departure_date." }, 400, cors);
  const trackKey = "track:" + data.origin + ":" + data.destination + ":" + data.departure_date;
  const targetPrice = data.target_price || null;
  const dropPercent = data.drop_percent || 10;
  if (!env.IGNAV_API_KEY) return jsonResponse({ success: false, message: "Flight search is not configured." }, 500, cors);
  try {
    const apiResp = await fetch(IGNAV_BASE + "/fares/one-way", { method: "POST", headers: { "X-Api-Key": env.IGNAV_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ origin: data.origin, destination: data.destination, departure_date: data.departure_date, cabin_class: data.cabin_class || "economy" }) });
    if (!apiResp.ok) return jsonResponse({ success: false, message: "Flight search unavailable." }, 502, cors);
    const flightData = await apiResp.json();
    const itineraries = (flightData.itineraries || []).filter(i => i.price && i.price.status === "verified");
    if (itineraries.length === 0) return jsonResponse({ success: false, message: "No verified fares found." }, 200, cors);
    const best = itineraries.reduce((a, b) => (parseFloat(a.price.amount) < parseFloat(b.price.amount) ? a : b));
    const price = parseFloat(best.price.amount);
    const currency = best.price.currency;
    const checkedAt = new Date().toISOString();
    let previous = null;
    if (env.ENQUIRIES) {
      const prev = await env.ENQUIRIES.get(trackKey);
      if (prev) previous = JSON.parse(prev);
    }
    const record = { price, currency, ignav_id: best.ignav_id, checked_at: checkedAt, origin: data.origin, destination: data.destination, departure_date: data.departure_date };
    if (env.ENQUIRIES) ctx.waitUntil(env.ENQUIRIES.put(trackKey, JSON.stringify(record), { expirationTtl: 7776000 }));
    let alert = null;
    let bookingUrl = null;
    const dropped = previous && price <= previous.price * (1 - dropPercent / 100);
    if (targetPrice && price <= targetPrice) alert = "Target price reached: " + price + " " + currency;
    else if (dropped) alert = "Price dropped " + dropPercent + "%+: now " + price + " " + currency + " (was " + previous.price + " " + previous.currency + ")";
    if (alert) {
      try {
        const bkResp = await fetch(IGNAV_BASE + "/fares/booking-links", { method: "POST", headers: { "X-Api-Key": env.IGNAV_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ ignav_id: best.ignav_id }) });
        if (bkResp.ok) {
          const bkData = await bkResp.json();
          if (bkData.booking_options && bkData.booking_options.length > 0) {
            const firstOption = bkData.booking_options[0];
            if (firstOption.links && firstOption.links.length > 0) bookingUrl = firstOption.links[0].url;
          }
        }
      } catch {}
    }
    return jsonResponse({ success: true, current_price: price, currency, ignav_id: best.ignav_id, checked_at: checkedAt, previous_price: previous ? previous.price : null, alert, booking_url: bookingUrl }, 200, cors);
  } catch {
    return jsonResponse({ success: false, message: "Unable to reach flight search." }, 502, cors);
  }
}

async function handlePriceTrackGet(request, env, ctx) {
  const cors = corsHeaders();
  const url = new URL(request.url);
  const origin = url.searchParams.get("origin");
  const destination = url.searchParams.get("destination");
  const departureDate = url.searchParams.get("departure_date");
  if (!origin || !destination || !departureDate) return jsonResponse({ success: false, message: "Missing origin, destination, or departure_date." }, 400, cors);
  const trackKey = "track:" + origin + ":" + destination + ":" + departureDate;
  if (!env.ENQUIRIES) return jsonResponse({ success: false, message: "Tracking not configured." }, 500, cors);
  const record = await env.ENQUIRIES.get(trackKey);
  if (!record) return jsonResponse({ success: false, message: "No tracking data found." }, 404, cors);
  return jsonResponse({ success: true, ...JSON.parse(record) }, 200, cors);
}

// ─── Enquiry ───────────────────────────────────────────────────
async function handleEnquiry(request, env, ctx) {
  const cors = corsHeaders();
  let data;
  try { data = await request.json(); } catch { return jsonResponse({ success: false, message: "Invalid JSON body." }, 400, cors); }
  const enquiryId = "enquiry_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  if (env.ENQUIRIES) ctx.waitUntil(env.ENQUIRIES.put(enquiryId, JSON.stringify(data), { expirationTtl: 7776000 }));
  if (env.WEB3FORMS_KEY) ctx.waitUntil(sendNotificationEmail(env, data, !!data.return_date));
  return jsonResponse({ success: true, message: "Enquiry submitted.", enquiryId }, 200, cors);
}

// ─── Create Booking ────────────────────────────────────────────
async function handleCreateBooking(request, env, ctx) {
  const cors = corsHeaders();
  let data;
  try { data = await request.json(); } catch { return jsonResponse({ success: false, message: "Invalid JSON body." }, 400, cors); }
  if (!data.origin || !data.destination || !data.departure_date || !data.customer_name || !data.customer_mobile || !data.customer_email) return jsonResponse({ success: false, message: "Missing required fields." }, 400, cors);
  if (!env.DB) return jsonResponse({ success: false, message: "Database not configured." }, 500, cors);
  const bookingId = "TF" + Date.now().toString().slice(-8) + Math.random().toString(36).slice(2, 5).toUpperCase();
  try {
    await env.DB.prepare("INSERT INTO bookings (id, origin, destination, departure_date, return_date, cabin_class, adults, children, infants, price_amount, price_currency, ignav_id, status, customer_name, customer_mobile, customer_email, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(bookingId, data.origin, data.destination, data.departure_date, data.return_date || null, data.cabin_class || "economy", data.adults || 1, data.children || 0, data.infants || 0, data.price_amount || null, data.price_currency || "INR", data.ignav_id || null, "pending_payment", data.customer_name, data.customer_mobile, data.customer_email, "pending").run();
    if (data.passengers && Array.isArray(data.passengers)) {
      for (const p of data.passengers) {
        await env.DB.prepare("INSERT INTO passengers (booking_id, title, first_name, last_name, date_of_birth, passport_number, passport_expiry) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(bookingId, p.title || "", p.first_name || "", p.last_name || "", p.date_of_birth || "", p.passport_number || "", p.passport_expiry || "").run();
      }
    }
    if (env.WEB3FORMS_KEY) ctx.waitUntil(sendBookingEmail(env, data, bookingId));
    return jsonResponse({ success: true, booking_id: bookingId, message: "Booking created. Please complete payment." }, 200, cors);
  } catch (e) {
    console.error("Create booking failed:", e.message);
    return jsonResponse({ success: false, message: "Could not create booking. Please try again." }, 500, cors);
  }
}

// ─── Payment Submit ────────────────────────────────────────────
async function handlePaymentSubmit(request, env, ctx) {
  const cors = corsHeaders();
  let data;
  try { data = await request.json(); } catch { return jsonResponse({ success: false, message: "Invalid JSON body." }, 400, cors); }
  if (!data.booking_id || !data.utr_reference) return jsonResponse({ success: false, message: "Missing booking ID or UTR reference." }, 400, cors);
  if (!env.DB) return jsonResponse({ success: false, message: "Database not configured." }, 500, cors);
  try {
    const booking = await env.DB.prepare("SELECT * FROM bookings WHERE id = ?").bind(data.booking_id).first();
    if (!booking) return jsonResponse({ success: false, message: "Booking not found." }, 404, cors);
    await env.DB.prepare("UPDATE bookings SET utr_reference = ?, payment_status = 'submitted', status = 'payment_pending', updated_at = datetime('now') WHERE id = ?").bind(data.utr_reference, data.booking_id).run();
    if (env.WEB3FORMS_KEY) ctx.waitUntil(sendPaymentEmail(env, booking, data.utr_reference));
    return jsonResponse({ success: true, message: "Payment submitted. We will verify and confirm your booking shortly." }, 200, cors);
  } catch (e) {
    console.error("Payment submit failed:", e.message);
    return jsonResponse({ success: false, message: "Could not submit payment." }, 500, cors);
  }
}

// ─── Booking Status ────────────────────────────────────────────
async function handleBookingStatus(request, env, ctx) {
  const cors = corsHeaders();
  const url = new URL(request.url);
  const bookingId = url.searchParams.get("id");
  if (!bookingId) return jsonResponse({ success: false, message: "Missing booking ID." }, 400, cors);
  if (!env.DB) return jsonResponse({ success: false, message: "Database not configured." }, 500, cors);
  try {
    const booking = await env.DB.prepare("SELECT * FROM bookings WHERE id = ?").bind(bookingId).first();
    if (!booking) return jsonResponse({ success: false, message: "Booking not found." }, 404, cors);
    return jsonResponse({ success: true, booking }, 200, cors);
  } catch {
    return jsonResponse({ success: false, message: "Could not fetch booking." }, 500, cors);
  }
}

// ─── Admin Endpoints ────────────────────────────────────────────
async function handleAdminLogin(request, env, ctx) {
  const cors = corsHeaders();
  let data;
  try { data = await request.json(); } catch { return jsonResponse({ success: false, message: "Invalid JSON body." }, 400, cors); }
  if (data.password === ADMIN_PASSWORD) return jsonResponse({ success: true, token: "admin-token-" + Date.now() }, 200, cors);
  return jsonResponse({ success: false, message: "Invalid password." }, 401, cors);
}

async function handleAdminBookings(request, env, ctx) {
  const cors = corsHeaders();
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer admin-token-")) return jsonResponse({ success: false, message: "Unauthorized." }, 401, cors);
  if (!env.DB) return jsonResponse({ success: false, message: "Database not configured." }, 500, cors);
  try {
    const results = await env.DB.prepare("SELECT * FROM bookings ORDER BY created_at DESC LIMIT 100").all();
    return jsonResponse({ success: true, bookings: results.results }, 200, cors);
  } catch {
    return jsonResponse({ success: false, message: "Could not fetch bookings." }, 500, cors);
  }
}

async function handleAdminVerify(request, env, ctx) {
  const cors = corsHeaders();
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer admin-token-")) return jsonResponse({ success: false, message: "Unauthorized." }, 401, cors);
  let data;
  try { data = await request.json(); } catch { return jsonResponse({ success: false, message: "Invalid JSON body." }, 400, cors); }
  if (!data.booking_id || !data.action) return jsonResponse({ success: false, message: "Missing booking ID or action." }, 400, cors);
  if (!env.DB) return jsonResponse({ success: false, message: "Database not configured." }, 500, cors);
  try {
    if (data.action === "approve") {
      await env.DB.prepare("UPDATE bookings SET payment_status = 'verified', status = 'processing', updated_at = datetime('now') WHERE id = ?").bind(data.booking_id).run();
      return jsonResponse({ success: true, message: "Payment verified. Booking is now processing." }, 200, cors);
    } else if (data.action === "reject") {
      await env.DB.prepare("UPDATE bookings SET payment_status = 'rejected', status = 'payment_rejected', updated_at = datetime('now') WHERE id = ?").bind(data.booking_id).run();
      return jsonResponse({ success: true, message: "Payment rejected." }, 200, cors);
    }
    return jsonResponse({ success: false, message: "Invalid action." }, 400, cors);
  } catch {
    return jsonResponse({ success: false, message: "Could not update booking." }, 500, cors);
  }
}

async function handleAdminTicket(request, env, ctx) {
  const cors = corsHeaders();
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer admin-token-")) return jsonResponse({ success: false, message: "Unauthorized." }, 401, cors);
  let data;
  try { data = await request.json(); } catch { return jsonResponse({ success: false, message: "Invalid JSON body." }, 400, cors); }
  if (!data.booking_id || !data.pnr) return jsonResponse({ success: false, message: "Missing booking ID or PNR." }, 400, cors);
  if (!env.DB) return jsonResponse({ success: false, message: "Database not configured." }, 500, cors);
  try {
    if (data.ticket_file_data && env.ENQUIRIES) {
      const ticketKey = "ticket:" + data.booking_id;
      const ticketRecord = { booking_id: data.booking_id, filename: data.ticket_filename, filetype: data.ticket_filetype, uploaded_at: new Date().toISOString() };
      const dataSize = data.ticket_file_data.length;
      if (dataSize < 1000000) {
        ctx.waitUntil(env.ENQUIRIES.put(ticketKey, JSON.stringify({ ...ticketRecord, file_data: data.ticket_file_data }), { expirationTtl: 7776000 }));
      } else {
        ctx.waitUntil(env.ENQUIRIES.put(ticketKey, JSON.stringify(ticketRecord), { expirationTtl: 7776000 }));
      }
    }
    await env.DB.prepare("UPDATE bookings SET pnr = ?, ticket_number = ?, ticket_pdf = ?, status = 'confirmed', payment_status = 'verified', updated_at = datetime('now') WHERE id = ?").bind(data.pnr, data.ticket_number || "", data.ticket_filename || "", data.booking_id).run();
    const booking = await env.DB.prepare("SELECT * FROM bookings WHERE id = ?").bind(data.booking_id).first();
    if (env.WEB3FORMS_KEY && booking) ctx.waitUntil(sendTicketEmail(env, booking));
    return jsonResponse({ success: true, message: "Ticket added. Customer notified." }, 200, cors);
  } catch {
    return jsonResponse({ success: false, message: "Could not add ticket." }, 500, cors);
  }
}

// ─── Ticket Download ───────────────────────────────────────────
async function handleTicketDownload(request, env, ctx) {
  const cors = corsHeaders();
  const url = new URL(request.url);
  const bookingId = url.searchParams.get("id");
  if (!bookingId) return jsonResponse({ success: false, message: "Missing booking ID." }, 400, cors);
  if (!env.ENQUIRIES) return jsonResponse({ success: false, message: "Not configured." }, 500, cors);
  const record = await env.ENQUIRIES.get("ticket:" + bookingId);
  if (!record) return jsonResponse({ success: false, message: "No ticket found." }, 404, cors);
  const parsed = JSON.parse(record);
  if (parsed.file_data) {
    const base64Data = parsed.file_data.split(",")[1] || parsed.file_data;
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Response(bytes, { headers: { "Content-Type": parsed.filetype || "application/pdf", "Content-Disposition": 'attachment; filename="' + (parsed.filename || "ticket.pdf") + '"' } });
  }
  return jsonResponse({ success: false, message: "Ticket file not available." }, 404, cors);
}

// ─── Upload Passport ───────────────────────────────────────────
async function handleUploadPassport(request, env, ctx) {
  const cors = corsHeaders();
  let data;
  try { data = await request.json(); } catch { return jsonResponse({ success: false, message: "Invalid JSON." }, 400, cors); }
  if (!data.booking_id) return jsonResponse({ success: false, message: "Missing booking ID." }, 400, cors);
  if (!data.data) return jsonResponse({ success: false, message: "No file data." }, 400, cors);
  const key = "passport:" + data.booking_id + ":" + (data.passenger_index || 0);
  const record = { booking_id: data.booking_id, passenger_index: data.passenger_index || 0, filename: data.filename, filetype: data.filetype, uploaded_at: new Date().toISOString() };
  if (env.ENQUIRIES) {
    const dataSize = data.data.length;
    if (dataSize < 1000000) {
      ctx.waitUntil(env.ENQUIRIES.put(key, JSON.stringify({ ...record, file_data: data.data }), { expirationTtl: 7776000 }));
    } else {
      ctx.waitUntil(env.ENQUIRIES.put(key, JSON.stringify(record), { expirationTtl: 7776000 }));
    }
  }
  return jsonResponse({ success: true, message: "Passport uploaded.", filename: data.filename }, 200, cors);
}

// ─── Email Helpers ─────────────────────────────────────────────
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

async function sendBookingEmail(env, data, bookingId) {
  try {
    const messageBody = ["NEW BOOKING - TRUSTEDFARE", "================================", "", "Booking ID: " + bookingId, "Route: " + data.origin + " to " + data.destination, "Departure: " + data.departure_date, data.return_date ? "Return: " + data.return_date : "One-way", "Cabin: " + (data.cabin_class || "economy"), "Price: " + (data.price_amount || "TBD") + " " + (data.price_currency || "INR"), "", "CUSTOMER", "Name: " + data.customer_name, "Phone: " + data.customer_mobile, "Email: " + data.customer_email, "", "Status: PENDING PAYMENT", "================================"].join("\n");
    await fetch("https://api.web3forms.com/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_key: env.WEB3FORMS_KEY, subject: "New Booking " + bookingId + " - " + data.origin + " to " + data.destination, from_name: "TrustedFare Website", to: "gm@trustedfare.com", replyto: data.customer_email || "noreply@trustedfare.com", message: messageBody }) });
  } catch (e) { console.error("Booking email failed:", e.message); }
}

async function sendPaymentEmail(env, booking, utr) {
  try {
    const messageBody = ["PAYMENT SUBMITTED - TRUSTEDFARE", "================================", "", "Booking ID: " + booking.id, "Route: " + booking.origin + " to " + booking.destination, "Amount: " + (booking.price_amount || "N/A") + " " + (booking.price_currency || "INR"), "UTR Reference: " + utr, "", "Customer: " + booking.customer_name, "Phone: " + booking.customer_mobile, "Email: " + booking.customer_email, "", "Status: PENDING VERIFICATION", "================================"].join("\n");
    await fetch("https://api.web3forms.com/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_key: env.WEB3FORMS_KEY, subject: "Payment Submitted for " + booking.id, from_name: "TrustedFare Website", to: "gm@trustedfare.com", replyto: booking.customer_email || "noreply@trustedfare.com", message: messageBody }) });
  } catch (e) { console.error("Payment email failed:", e.message); }
}

async function sendTicketEmail(env, booking) {
  try {
    const messageBody = ["TICKET CONFIRMED - TRUSTEDFARE", "================================", "", "Booking ID: " + booking.id, "Route: " + booking.origin + " to " + booking.destination, "Departure: " + booking.departure_date, "PNR: " + booking.pnr, "Ticket Number: " + (booking.ticket_number || "N/A"), "", "Customer: " + booking.customer_name, "", "Your flight ticket is confirmed. Thank you for choosing TrustedFare!", "================================"].join("\n");
    await fetch("https://api.web3forms.com/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_key: env.WEB3FORMS_KEY, subject: "Ticket Confirmed - " + booking.id + " - " + booking.origin + " to " + booking.destination, from_name: "TrustedFare Website", to: booking.customer_email, replyto: "gm@trustedfare.com", message: messageBody }) });
  } catch (e) { console.error("Ticket email failed:", e.message); }
}

// ─── Utils ─────────────────────────────────────────────────────
function corsHeaders() {
  return { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
}

function jsonResponse(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers });
}
