import { describe, expect, it } from "vitest";
import { makeBooking, matchIntent, seedBookings, slotsFor, toCSV, validateBooking } from "../src/core.js";

const NOW = new Date("2026-10-07T12:15:00"); // a Wednesday
const ok = { serviceId: "cleaning", dentistId: "d1", date: "2026-10-08", time: "10:00", name: "Test User", email: "test@example.com", phone: "+00 0000 000000" };

describe("slots", () => {
  it("hides past times today and returns nothing on Sundays", () => {
    const today = slotsFor("2026-10-07", "d1", [], NOW);
    expect(today.find((s) => s.time === "12:00").available).toBe(false);
    expect(today.find((s) => s.time === "12:30").available).toBe(true);
    expect(slotsFor("2026-10-11", "d1", [], NOW)).toEqual([]); // Sunday
  });

  it("marks a booked slot as taken for that dentist only", () => {
    const booked = [{ ...ok }];
    expect(slotsFor("2026-10-08", "d1", booked, NOW).find((s) => s.time === "10:00").available).toBe(false);
    expect(slotsFor("2026-10-08", "d2", booked, NOW).find((s) => s.time === "10:00").available).toBe(true);
  });
});

describe("validation", () => {
  it("accepts a good booking and rejects a double booking", () => {
    const first = makeBooking(ok, [], NOW);
    expect(first.ok).toBe(true);
    const again = makeBooking(ok, [first.booking], NOW);
    expect(again.ok).toBe(false);
    expect(again.errors.time).toMatch(/already booked/);
  });

  it("rejects past times, Sundays, unknown services and bad contact details", () => {
    expect(validateBooking({ ...ok, date: "2026-10-07", time: "09:00" }, [], NOW).errors.time).toMatch(/passed/);
    expect(validateBooking({ ...ok, date: "2026-10-11" }, [], NOW).errors.date).toMatch(/Sunday/);
    const bad = validateBooking({ ...ok, serviceId: "x", time: "10:15", email: "nope", phone: "12", name: " " }, [], NOW).errors;
    expect(Object.keys(bad).sort()).toEqual(["email", "name", "phone", "serviceId", "time"]);
  });
});

describe("DentalBot intents", () => {
  it.each([
    ["what are your opening hours?", "hours"],
    ["how much does whitening cost", "prices"],
    ["where are you located", "location"],
    ["do you take insurance", "insurance"],
    ["can I cancel my visit", "cancellation"],
    ["what services do you offer", "services"],
    ["tell me a joke", "unknown"],
  ])("%s -> %s", (q, intent) => expect(matchIntent(q, NOW).intent).toBe(intent));

  it("parses a booking request into service, date and time", () => {
    expect(matchIntent("Book a cleaning tomorrow at 10", NOW).booking).toEqual({ serviceId: "cleaning", date: "2026-10-08", time: "10:00" });
    expect(matchIntent("I want an appointment for a check-up on friday at 2pm", NOW).booking).toEqual({ serviceId: "checkup", date: "2026-10-09", time: "14:00" });
  });
});

it("seed and CSV use synthetic data only", () => {
  const csv = toCSV(seedBookings(NOW));
  expect(csv.split("\n")[0]).toBe("id,date,time,service,dentist,name,email,phone,createdAt");
  expect(csv).toMatch(/@example\.com/);
});
