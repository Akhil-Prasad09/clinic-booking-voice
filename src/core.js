// Shared booking logic, used by the React app (mock API), the Express server and the tests.
// Everything here is synthetic demo data: no real clinic, people, phone numbers or addresses.

export const CLINIC = {
  name: "Brightsmile Dental (demo)",
  address: "123 Demo Street, Sample City",
  phone: "+00 0000 000000",
  email: "hello@example.com",
  hours: "Monday to Saturday, 9:00 to 17:00. Closed on Sundays.",
};

export const SERVICES = [
  { id: "checkup", name: "Check-up", price: 40 },
  { id: "cleaning", name: "Cleaning", price: 60 },
  { id: "filling", name: "Filling", price: 120 },
  { id: "whitening", name: "Whitening", price: 200 },
];

export const DENTISTS = [
  { id: "d1", name: "Dr. Alex Example" },
  { id: "d2", name: "Dr. Sam Sample" },
];

// ponytail: every service takes one 30-minute slot; per-service durations if the demo ever needs them
export const TIMES = Array.from({ length: 16 }, (_, i) => {
  const mins = 9 * 60 + i * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}); // 09:00 ... 16:30

export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const isSunday = (date) => new Date(`${date}T12:00:00`).getDay() === 0;
const isPast = (date, time, now) => new Date(`${date}T${time}:00`) <= now;
const taken = (bookings, dentistId, date, time) =>
  bookings.some((b) => b.dentistId === dentistId && b.date === date && b.time === time);

export function slotsFor(date, dentistId, bookings, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || isSunday(date)) return [];
  return TIMES.map((time) => ({
    time,
    available: !isPast(date, time, now) && !taken(bookings, dentistId, date, time),
  }));
}

export function validateBooking(input, bookings, now = new Date()) {
  const b = input || {};
  const errors = {};
  if (!SERVICES.some((s) => s.id === b.serviceId)) errors.serviceId = "Choose a service.";
  if (!DENTISTS.some((d) => d.id === b.dentistId)) errors.dentistId = "Choose a dentist.";
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") && !isNaN(new Date(`${b.date}T12:00:00`));
  if (!dateOk) errors.date = "Choose a valid date.";
  else if (isSunday(b.date)) errors.date = "The clinic is closed on Sundays.";
  if (!TIMES.includes(b.time)) errors.time = "Choose a time slot.";
  else if (dateOk && isPast(b.date, b.time, now)) errors.time = "That time has already passed.";
  else if (dateOk && taken(bookings, b.dentistId, b.date, b.time)) errors.time = "That slot is already booked.";
  if (!b.name || b.name.trim().length < 2) errors.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || "")) errors.email = "Enter a valid email.";
  if (!/^\+?[\d\s-]{7,20}$/.test(b.phone || "") || (b.phone.match(/\d/g) || []).length < 7)
    errors.phone = "Enter a valid phone number.";
  return { ok: Object.keys(errors).length === 0, errors };
}

export function makeBooking(input, bookings, now = new Date()) {
  const { ok, errors } = validateBooking(input, bookings, now);
  if (!ok) return { ok, errors };
  const { serviceId, dentistId, date, time } = input;
  const booking = {
    id: `BK-${String(bookings.length + 1).padStart(4, "0")}`,
    serviceId, dentistId, date, time,
    name: input.name.trim(), email: input.email.trim(), phone: input.phone.trim(),
    createdAt: now.toISOString(),
  };
  return { ok: true, booking };
}

// Synthetic bookings so some slots show as taken. Dates are relative to today.
export function seedBookings(now = new Date()) {
  let d = addDays(now, 1);
  if (d.getDay() === 0) d = addDays(d, 1);
  const day = isoDate(d);
  return [
    ["d1", "10:00", "checkup"], ["d1", "11:30", "cleaning"], ["d2", "09:00", "filling"], ["d2", "14:00", "whitening"],
  ].map(([dentistId, time, serviceId], i) => ({
    id: `BK-S${i + 1}`, serviceId, dentistId, date: day, time,
    name: `Test Patient ${i + 1}`, email: `patient${i + 1}@example.com`, phone: "+00 0000 00000" + i,
    createdAt: now.toISOString(),
  }));
}

export const serviceName = (id) => SERVICES.find((s) => s.id === id)?.name ?? id;
export const dentistName = (id) => DENTISTS.find((d) => d.id === id)?.name ?? id;

export function confirmationEmail(b) {
  return [
    `To: ${b.email}`,
    `Subject: Your ${serviceName(b.serviceId)} at ${CLINIC.name} is confirmed`,
    "",
    `Hi ${b.name},`,
    "",
    `Your appointment is booked for ${b.date} at ${b.time} with ${dentistName(b.dentistId)}.`,
    `Booking reference: ${b.id}`,
    `Address: ${CLINIC.address}`,
    "",
    "To cancel or reschedule, reply to this email at least 24 hours before your visit.",
  ].join("\n");
}

export function toCSV(bookings) {
  const cols = ["id", "date", "time", "service", "dentist", "name", "email", "phone", "createdAt"];
  const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = bookings.map((b) =>
    [b.id, b.date, b.time, serviceName(b.serviceId), dentistName(b.dentistId), b.name, b.email, b.phone, b.createdAt]
      .map((v) => esc(String(v))).join(","));
  return [cols.join(","), ...rows].join("\n");
}

// ---------------------------------------------------------------- DentalBot (rule-based, no LLM)
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SERVICE_WORDS = [
  [/clean/, "cleaning"], [/check\s*-?\s*up|exam/, "checkup"], [/fill/, "filling"], [/whiten/, "whitening"],
];

function parseDate(text, now) {
  if (/\btoday\b/.test(text)) return isoDate(now);
  if (/\btomorrow\b/.test(text)) return isoDate(addDays(now, 1));
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const wd = WEEKDAYS.findIndex((w) => new RegExp(`\\b${w}\\b`).test(text));
  if (wd >= 0) return isoDate(addDays(now, ((wd - now.getDay() + 7) % 7) || 7));
  return null;
}

function parseTime(text) {
  const m = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/) || text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (!m[3] && h < 9) h += 12; // "at 2" in clinic hours means 14:00
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

const FAQ = [
  ["cancellation", /cancel|reschedul/, "You can cancel or reschedule for free up to 24 hours before your appointment. Just reply to your confirmation email."],
  ["insurance", /insur|cover/, "We accept most major dental insurance plans (demo answer). Bring your insurance card to your visit."],
  ["prices", /price|cost|fee|how much|charge/, () => `Prices: ${SERVICES.map((s) => `${s.name} $${s.price}`).join(", ")}. These are demo prices.`],
  ["hours", /hour|open|close|timing|when are you/, "We're open Monday to Saturday, 9:00 to 17:00, and closed on Sundays."],
  ["location", /where|address|location|located|direction/, `We're at ${CLINIC.address}. It's a demo address.`],
  ["services", /service|treat|offer|do you do/, () => `We offer ${SERVICES.map((s) => s.name.toLowerCase()).join(", ")}.`],
];

export function matchIntent(input, now = new Date()) {
  const text = (input || "").toLowerCase();
  if (/\b(book|appointment|schedule|reserve)\b/.test(text)) {
    const serviceId = SERVICE_WORDS.find(([re]) => re.test(text))?.[1] ?? null;
    const date = parseDate(text, now);
    const time = parseTime(text);
    const parts = [serviceId && serviceName(serviceId).toLowerCase(), date && `on ${date}`, time && `at ${time}`].filter(Boolean);
    return {
      intent: "book",
      booking: { serviceId, date, time },
      reply: parts.length
        ? `I've started a booking for a ${parts.join(" ")}. Check the form, add your details and confirm.`
        : "Sure. Tell me the service, day and time, for example: book a cleaning tomorrow at 10.",
    };
  }
  for (const [intent, re, reply] of FAQ) {
    if (re.test(text)) return { intent, reply: typeof reply === "function" ? reply() : reply };
  }
  return {
    intent: "unknown",
    reply: "I can answer questions about hours, services, prices, location, insurance and cancellations, or start a booking.",
  };
}
