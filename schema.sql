-- TrustedFare D1 schema
-- Run this in the D1 console after creating the database

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date TEXT NOT NULL,
  return_date TEXT,
  cabin_class TEXT DEFAULT 'economy',
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  infants INTEGER DEFAULT 0,
  price_amount REAL,
  price_currency TEXT DEFAULT 'INR',
  ignav_id TEXT,
  status TEXT DEFAULT 'pending_payment',
  payment_status TEXT DEFAULT 'pending',
  utr_reference TEXT,
  pnr TEXT,
  ticket_number TEXT,
  ticket_pdf TEXT,
  customer_name TEXT NOT NULL,
  customer_mobile TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS passengers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT NOT NULL,
  title TEXT,
  first_name TEXT,
  last_name TEXT,
  date_of_birth TEXT,
  passport_number TEXT,
  passport_expiry TEXT,
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);
