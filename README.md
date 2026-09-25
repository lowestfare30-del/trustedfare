# TrustedFare

Flight search, booking, and price-tracking platform built on Cloudflare Workers, powered by the [Ignav](https://ignav.com) Flight Prices API.

## Features

### Flight Search (Ignav API integration)
- **One-way & round-trip search** — `POST /api/search` proxies to Ignav `/fares/one-way` and `/fares/round-trip`
- **Multi-city / open-jaw search** — `POST /api/search/multi-city` proxies to Ignav `/fares/search` with ordered legs
- **Airport autocomplete** — `GET /api/airports?q=...` proxies to Ignav `/airports` (API key kept server-side)
- **Booking links** — `POST /api/booking-link` fetches purchase URLs for a specific itinerary via Ignav `/fares/booking-links`
- **Health check** — `GET /api/health` checks Ignav API availability

### All Ignav filters supported
- `max_stops`, `max_price`, `cabin_class` (economy / premium_economy / business / first)
- `airlines_include`, `airlines_exclude`
- `min_carry_on_bags`, `min_checked_bags`
- `departure_time_range` (earliest_hour, latest_hour, arrival_earliest_hour, arrival_latest_hour)
- `return_time_range` for round-trip return leg
- `allow_self_transfer` toggle
- `market` — 60+ country/currency codes (US/USD, GB/GBP, JP/JPY, IN/INR, etc.)
- Passenger counts: `adults`, `children`, `infants_in_seat`, `infants_on_lap`

### Price Tracking
- `POST /api/price-track` — searches a route, stores cheapest verified fare in KV, alerts on target price or % drop, fetches booking link when alert fires
- `GET /api/price-track?origin=...&destination=...&departure_date=...` — retrieves last tracked price

### Booking & Payment Flow
1. **Lead capture** — every search stores customer contact details in KV (`ENQUIRIES`) and emails the agency via Web3Forms
2. **Quote request** — `POST /api/enquiry` stores a standalone enquiry
3. **Booking creation** — `POST /api/create-booking` creates a D1 record with passenger details, generates a booking ID
4. **Payment submission** — `POST /api/payment` records UTR reference, updates status to `payment_pending`
5. **Booking status** — `GET /api/booking-status?id=...` checks booking progress
6. **Admin panel** at `/admin`:
   - Login with admin password
   - View all bookings with stats (total, pending, verified, confirmed)
   - Verify or reject payments
   - Add PNR / ticket number / PDF link → marks booking confirmed, emails customer

### Email notifications (Web3Forms)
- New flight search → agency notified
- New booking → agency notified
- Payment submitted → agency notified
- Ticket confirmed → customer notified

## Project structure

