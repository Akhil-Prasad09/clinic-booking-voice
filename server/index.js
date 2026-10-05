// Express REST API for the booking demo. In-memory storage, seeded with synthetic bookings.
import express from "express";
import { pathToFileURL } from "node:url";
import { CLINIC, DENTISTS, SERVICES, makeBooking, seedBookings, slotsFor, toCSV } from "../src/core.js";

export function createApp(bookings = seedBookings()) {
  const app = express();
  app.use(express.json({ limit: "10kb" }));

  app.get("/api/clinic", (_req, res) => res.json(CLINIC));
  app.get("/api/services", (_req, res) => res.json(SERVICES));
  app.get("/api/dentists", (_req, res) => res.json(DENTISTS));
  app.get("/api/slots", (req, res) => res.json(slotsFor(String(req.query.date || ""), String(req.query.dentistId || ""), bookings)));
  app.get("/api/bookings", (_req, res) => res.json(bookings));
  app.get("/api/bookings.csv", (_req, res) => res.type("text/csv").send(toCSV(bookings)));
  app.post("/api/bookings", (req, res) => {
    const result = makeBooking(req.body, bookings);
    if (!result.ok) {
      const onlyTaken = Object.keys(result.errors).length === 1 && result.errors.time === "That slot is already booked.";
      return res.status(onlyTaken ? 409 : 400).json(result);
    }
    bookings.push(result.booking);
    res.status(201).json(result);
  });
  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3001);
  createApp().listen(port, () => console.log(`Booking API on http://localhost:${port}`));
}
