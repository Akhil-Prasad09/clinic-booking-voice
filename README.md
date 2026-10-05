# Clinic Booking with Voice FAQ Assistant

**[Live demo](https://akhil-prasad09.github.io/clinic-booking-voice/)**

A booking web app for a fictional dental clinic, "Brightsmile Dental (demo)", with a voice-enabled FAQ assistant called DentalBot. It's a portfolio project. All data is synthetic, and it has never been used by any real clinic: the clinic, dentists, address, phone number and patients are invented.

This is a rebuild. The original version was lost, so I rewrote it from scratch with the same features, except Google Sheets sync (see below).

## Features

- Booking flow: pick a service, dentist, date and 30-minute time slot, then enter name, email and phone. Booked slots and past times can't be chosen, Sundays are closed, and every field is validated on both the client and the server.
- Confirmation page with a preview of the confirmation email. No email is actually sent.
- DentalBot: answers questions about hours, services, prices, location, insurance and cancellations, and can start a booking from a sentence like "book a cleaning tomorrow at 10" by filling in the form. It's rule-based (keyword and regex matching against a short intent list); there's no AI model. Voice input uses the browser's Web Speech API where available (for example Chrome), and spoken questions get spoken replies. Typing works everywhere.
- Admin view: a table of all bookings and an "Export bookings as CSV" button. The original synced bookings to a Google Sheet for clinic staff; this rebuild exports the same columns as CSV instead of connecting to Google.
- Express REST API with input validation: `GET /api/services`, `/api/dentists`, `/api/clinic`, `/api/slots?date=&dentistId=`, `/api/bookings`, `/api/bookings.csv`, and `POST /api/bookings` (201 on success, 409 if the slot is taken, 400 for invalid input).

## Two ways to run it

The frontend talks to an API adapter with one interface and two implementations (`src/api.js`):

- **Browser-only (default, used on GitHub Pages).** The same booking logic runs in the browser and bookings are saved in `localStorage`, so each visitor has their own copy. "Reset demo data" in the admin view restores the seed bookings.
- **With the Express server.** Bookings live in the server's memory (they reset when it restarts).

```bash
npm install

# browser-only mode
npm run dev                      # http://localhost:5173/clinic-booking-voice/

# server mode: start the API, then point the frontend at it (the dev server proxies /api)
npm run server                   # http://localhost:3001
VITE_API_URL= npm run dev
```

## Tests

```bash
npm test
```

14 Vitest tests cover slot availability (past times, Sundays, per-dentist double booking), booking validation, DentalBot intent matching and booking parsing, CSV export, and the Express API (status codes for success, double booking and bad input).

## Layout

```
src/core.js      shared logic: synthetic data, slots, validation, CSV, DentalBot intents
src/api.js       browser (localStorage) and HTTP API adapters
src/App.jsx      React UI: booking form, confirmation, DentalBot, admin
server/index.js  Express API
tests/           Vitest tests
```

Stack: React, Vite, Node.js, Express, Web Speech API.
