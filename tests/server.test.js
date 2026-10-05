import request from "supertest";
import { expect, it } from "vitest";
import { createApp } from "../server/index.js";

it("serves the API and validates bookings", async () => {
  const app = createApp([]);
  expect((await request(app).get("/api/services")).body.length).toBe(4);
  const d = new Date(); d.setDate(d.getDate() + 2); if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const body = { serviceId: "filling", dentistId: "d2", date, time: "15:00", name: "Test User", email: "t@example.com", phone: "+00 0000 000000" };

  const created = await request(app).post("/api/bookings").send(body);
  expect(created.status).toBe(201);
  expect((await request(app).post("/api/bookings").send(body)).status).toBe(409);       // double booking
  expect((await request(app).post("/api/bookings").send({ ...body, email: "x" })).status).toBe(400);
  const slots = (await request(app).get(`/api/slots?date=${date}&dentistId=d2`)).body;
  expect(slots.find((s) => s.time === "15:00").available).toBe(false);
  expect((await request(app).get("/api/bookings.csv")).text).toMatch(/Test User/);
});
