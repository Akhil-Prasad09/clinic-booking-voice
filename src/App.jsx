import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import {
  CLINIC, DENTISTS, SERVICES, TIMES, confirmationEmail, dentistName, isoDate, matchIntent, serviceName, toCSV,
} from "./core.js";

const EMPTY = { serviceId: "", dentistId: "", date: "", time: "", name: "", email: "", phone: "" };
const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function App() {
  const [view, setView] = useState("book");
  const [form, setForm] = useState(EMPTY);
  const [slots, setSlots] = useState([]);
  const [errors, setErrors] = useState({});
  const [confirmed, setConfirmed] = useState(null);
  const formRef = useRef(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  useEffect(() => {
    if (!form.date || !form.dentistId) return setSlots([]);
    api.getSlots(form.date, form.dentistId).then(setSlots);
  }, [form.date, form.dentistId, confirmed]);

  async function submit(e) {
    e.preventDefault();
    const result = await api.createBooking(form);
    if (result.ok) { setConfirmed(result.booking); setErrors({}); }
    else setErrors(result.errors);
  }

  function fillFromBot(b) {
    setConfirmed(null);
    setView("book");
    setForm((f) => ({
      ...f,
      serviceId: b.serviceId ?? f.serviceId,
      dentistId: f.dentistId || DENTISTS[0].id,
      date: b.date ?? f.date,
      time: b.time && TIMES.includes(b.time) ? b.time : f.time,
    }));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="page">
      <header className="top">
        <div>
          <h1>{CLINIC.name}</h1>
          <p className="muted">{CLINIC.address} · {CLINIC.phone}</p>
        </div>
        <nav>
          <button className={view === "book" ? "tab on" : "tab"} onClick={() => setView("book")}>Book</button>
          <button className={view === "admin" ? "tab on" : "tab"} onClick={() => setView("admin")}>Admin</button>
        </nav>
      </header>

      <p className="notice">
        Portfolio demo with synthetic data. This is not a real clinic and no emails are sent.
        Bookings are stored {api.mode === "mock" ? "in your browser only" : "on the demo server"}.
      </p>

      {view === "admin" ? (
        <Admin />
      ) : (
        <main className="grid">
          <section ref={formRef} className="card">
            {confirmed ? (
              <Confirmation booking={confirmed} onDone={() => { setConfirmed(null); setForm(EMPTY); }} />
            ) : (
              <form onSubmit={submit} noValidate>
                <h2>Book an appointment</h2>
                <Field label="Service" error={errors.serviceId}>
                  <select value={form.serviceId} onChange={set("serviceId")}>
                    <option value="">Choose a service</option>
                    {SERVICES.map((s) => <option key={s.id} value={s.id}>{s.name} (${s.price})</option>)}
                  </select>
                </Field>
                <Field label="Dentist" error={errors.dentistId}>
                  <select value={form.dentistId} onChange={set("dentistId")}>
                    <option value="">Choose a dentist</option>
                    {DENTISTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
                <Field label="Date" error={errors.date}>
                  <input type="date" min={isoDate(new Date())} value={form.date} onChange={set("date")} />
                </Field>
                <fieldset className="slots">
                  <legend>Time</legend>
                  {!form.date || !form.dentistId ? (
                    <p className="muted">Pick a dentist and a date to see open times.</p>
                  ) : slots.length === 0 ? (
                    <p className="muted">The clinic is closed on Sundays.</p>
                  ) : (
                    <div className="slot-grid">
                      {slots.map((s) => (
                        <button
                          type="button" key={s.time} disabled={!s.available}
                          className={form.time === s.time ? "slot on" : "slot"}
                          aria-pressed={form.time === s.time}
                          onClick={() => setForm((f) => ({ ...f, time: s.time }))}
                        >{s.time}</button>
                      ))}
                    </div>
                  )}
                  {errors.time && <p className="error">{errors.time}</p>}
                </fieldset>
                <Field label="Name" error={errors.name}>
                  <input value={form.name} onChange={set("name")} autoComplete="name" />
                </Field>
                <Field label="Email" error={errors.email}>
                  <input type="email" value={form.email} onChange={set("email")} autoComplete="email" />
                </Field>
                <Field label="Phone" error={errors.phone}>
                  <input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
                </Field>
                <button className="primary" type="submit">Confirm booking</button>
              </form>
            )}
          </section>
          <DentalBot onBook={fillFromBot} />
        </main>
      )}
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <span className="error">{error}</span>}
    </label>
  );
}

function Confirmation({ booking, onDone }) {
  return (
    <div>
      <h2>Booking confirmed</h2>
      <p>
        {serviceName(booking.serviceId)} with {dentistName(booking.dentistId)} on {booking.date} at {booking.time}.
        Reference <strong>{booking.id}</strong>.
      </p>
      <h3>Email preview</h3>
      <p className="muted">This is what the confirmation email would say. Nothing is actually sent in this demo.</p>
      <pre className="email">{confirmationEmail(booking)}</pre>
      <button className="primary" onClick={onDone}>Book another</button>
    </div>
  );
}

function DentalBot({ onBook }) {
  const [log, setLog] = useState([
    { who: "bot", text: "Hi, I'm DentalBot. Ask about hours, services, prices, location, insurance or cancellations, or say something like: book a cleaning tomorrow at 10." },
  ]);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const logRef = useRef(null);

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [log]);

  function ask(question, spoken = false) {
    if (!question.trim()) return;
    const result = matchIntent(question);
    setLog((l) => [...l, { who: "you", text: question }, { who: "bot", text: result.reply }]);
    if (result.intent === "book") onBook(result.booking);
    if (spoken && "speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(result.reply));
  }

  function listen() {
    const rec = new SR();
    rec.lang = "en-US";
    rec.onresult = (e) => ask(e.results[0][0].transcript, true);
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  return (
    <section className="card bot">
      <h2>DentalBot</h2>
      <p className="muted">A rule-based assistant: it matches keywords against a short list of FAQs. No AI model is involved.</p>
      <div className="log" ref={logRef} aria-live="polite">
        {log.map((m, i) => <p key={i} className={`msg ${m.who}`}>{m.text}</p>)}
      </div>
      <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(text); setText(""); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a question" aria-label="Question for DentalBot" />
        <button type="submit">Send</button>
        {SR && (
          <button type="button" onClick={listen} disabled={listening} aria-label="Ask by voice">
            {listening ? "Listening…" : "🎤 Speak"}
          </button>
        )}
      </form>
      {!SR && <p className="muted small">Voice input needs a browser with the Web Speech API (for example Chrome). Typing works everywhere.</p>}
    </section>
  );
}

function Admin() {
  const [bookings, setBookings] = useState([]);
  const load = () => api.listBookings().then(setBookings);
  useEffect(() => { load(); }, []);

  function exportCSV() {
    const url = URL.createObjectURL(new Blob([toCSV(bookings)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "bookings.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="card">
      <div className="row">
        <h2>Bookings ({bookings.length})</h2>
        <div className="row">
          <button onClick={exportCSV}>Export bookings as CSV</button>
          {api.reset && <button onClick={() => api.reset().then(load)}>Reset demo data</button>}
        </div>
      </div>
      <p className="muted">The CSV holds the same columns a staff spreadsheet would.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Ref</th><th>Date</th><th>Time</th><th>Service</th><th>Dentist</th><th>Name</th><th>Email</th></tr></thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>{b.id}</td><td>{b.date}</td><td>{b.time}</td><td>{serviceName(b.serviceId)}</td>
                <td>{dentistName(b.dentistId)}</td><td>{b.name}</td><td>{b.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
