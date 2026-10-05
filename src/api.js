// Two adapters with the same interface:
//  - HTTP: talks to the Express server (set VITE_API_URL, e.g. "" with the dev proxy or "http://localhost:3001")
//  - mock: runs the same core logic in the browser, storing bookings in localStorage (used on GitHub Pages)
import { CLINIC, DENTISTS, SERVICES, makeBooking, seedBookings, slotsFor } from "./core.js";

const KEY = "clinic-booking-voice:bookings";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved)) return saved;
  } catch { /* storage unavailable or corrupt: fall back to seed */ }
  return seedBookings();
}

function save(bookings) {
  try { localStorage.setItem(KEY, JSON.stringify(bookings)); } catch { /* private mode: keep in memory only */ }
}

let memory = null;
const mock = {
  mode: "mock",
  getClinic: async () => CLINIC,
  getServices: async () => SERVICES,
  getDentists: async () => DENTISTS,
  getSlots: async (date, dentistId) => slotsFor(date, dentistId, (memory ??= load())),
  listBookings: async () => (memory ??= load()),
  createBooking: async (input) => {
    memory ??= load();
    const result = makeBooking(input, memory);
    if (result.ok) { memory = [...memory, result.booking]; save(memory); }
    return result;
  },
  reset: async () => { memory = seedBookings(); save(memory); },
};

function http(base) {
  const get = (path) => fetch(`${base}/api/${path}`).then((r) => r.json());
  return {
    mode: "server",
    getClinic: () => get("clinic"),
    getServices: () => get("services"),
    getDentists: () => get("dentists"),
    getSlots: (date, dentistId) => get(`slots?date=${encodeURIComponent(date)}&dentistId=${encodeURIComponent(dentistId)}`),
    listBookings: () => get("bookings"),
    createBooking: (input) =>
      fetch(`${base}/api/bookings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })
        .then((r) => r.json()),
    reset: null,
  };
}

const url = import.meta.env.VITE_API_URL;
export const api = url === undefined ? mock : http(url);
