import { useEffect, useRef, useState } from "react";
import {
  ArrowCounterClockwise, ArrowUp, CheckCircle, DownloadSimple, Microphone, Sparkle, Stethoscope, Sun, Tooth,
} from "@phosphor-icons/react";
import { api } from "./api.js";
import {
  CLINIC, DENTISTS, SERVICES, TIMES, confirmationEmail, dentistName, isoDate, matchIntent, serviceName, toCSV,
} from "./core.js";

const EMPTY = { serviceId: "", dentistId: "", date: "", time: "", name: "", email: "", phone: "" };
const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

// Each service owns one bright color; the whole booking takes on the color of the service you pick.
const LOOK = {
  checkup: { color: "var(--sky)", Icon: Stethoscope },
  cleaning: { color: "var(--mint)", Icon: Sparkle },
  filling: { color: "var(--orange)", Icon: Tooth },
  whitening: { color: "var(--pink)", Icon: Sun },
};
const tone = (serviceId) => LOOK[serviceId]?.color ?? "var(--blue)";
const toneStyle = (serviceId) => ({ "--tone": tone(serviceId), "--tone-ink": LOOK[serviceId] ? "var(--ink-on)" : "#fff" });
const initials = (name) => name.replace(/^Dr\.\s*/, "").split(" ").map((w) => w[0]).join("");

function nextDays(n = 14) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({
      iso: isoDate(d),
      weekday: i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" }),
      day: d.getDate(),
      month: d.toLocaleDateString("en-US", { month: "short" }),
      closed: d.getDay() === 0,
    });
  }
  return out;
}

const prettyDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });

export default function App() {
  const [view, setView] = useState("book");
  const [form, setForm] = useState(EMPTY);
  const [slots, setSlots] = useState([]);
  const [errors, setErrors] = useState({});
  const [confirmed, setConfirmed] = useState(null);
  const formRef = useRef(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const pick = (field, value) => setForm((f) => ({ ...f, [field]: value, ...(field === "date" || field === "dentistId" ? { time: "" } : {}) }));

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
    <>
      <header className="bar">
        <div className="bar-inner">
          <p className="brand">
            <span className="brand-mark" aria-hidden="true"><Tooth weight="fill" /></span>
            {CLINIC.name}
          </p>
          <div className="seg" role="tablist" aria-label="View" data-on={view}>
            <span className="seg-thumb" aria-hidden="true" />
            <button role="tab" aria-selected={view === "book"} onClick={() => setView("book")}>Book</button>
            <button role="tab" aria-selected={view === "admin"} onClick={() => setView("admin")}>Admin</button>
          </div>
        </div>
      </header>

      <div className="page">
        <p className="notice">
          Portfolio demo with synthetic data. This is not a real clinic and no emails are sent.
          Bookings are stored {api.mode === "mock" ? "in your browser only" : "on the demo server"}.
        </p>

        {view === "admin" ? (
          <Admin />
        ) : (
          <>
            <section className="hero">
              <h1>Book a dental visit.</h1>
              <p>Pick a service, a dentist and a time, or ask DentalBot by voice.</p>
            </section>

            <main className="grid">
              <section ref={formRef} className="flow" style={toneStyle(form.serviceId)}>
                {confirmed ? (
                  <Confirmation booking={confirmed} onDone={() => { setConfirmed(null); setForm(EMPTY); }} />
                ) : (
                  <form onSubmit={submit} noValidate>
                    <Step title="Service" error={errors.serviceId}>
                      <div className="services" role="radiogroup" aria-label="Service">
                        {SERVICES.map((s) => {
                          const { color, Icon } = LOOK[s.id] ?? { color: "var(--blue)", Icon: Tooth };
                          const on = form.serviceId === s.id;
                          return (
                            <button
                              type="button" key={s.id} role="radio" aria-checked={on}
                              className={on ? "service on" : "service"} style={{ "--c": color }}
                              onClick={() => pick("serviceId", s.id)}
                            >
                              <Icon className="service-icon" weight="duotone" aria-hidden="true" />
                              <span className="service-name">{s.name}</span>
                              <span className="service-price">${s.price}</span>
                              {on && <CheckCircle className="service-check" weight="fill" aria-hidden="true" />}
                            </button>
                          );
                        })}
                      </div>
                    </Step>

                    <Step title="Dentist" error={errors.dentistId}>
                      <div className="dentists" role="radiogroup" aria-label="Dentist">
                        {DENTISTS.map((d) => (
                          <button
                            type="button" key={d.id} role="radio" aria-checked={form.dentistId === d.id}
                            className={form.dentistId === d.id ? "dentist on" : "dentist"}
                            onClick={() => pick("dentistId", d.id)}
                          >
                            <span className="avatar" aria-hidden="true">{initials(d.name)}</span>
                            {d.name}
                          </button>
                        ))}
                      </div>
                    </Step>

                    <Step title="Day" error={errors.date}>
                      <div className="days" role="radiogroup" aria-label="Day">
                        {nextDays().map((d) => (
                          <button
                            type="button" key={d.iso} role="radio" aria-checked={form.date === d.iso} disabled={d.closed}
                            className={form.date === d.iso ? "day on" : "day"}
                            aria-label={d.closed ? `${d.weekday} ${d.day} ${d.month}, closed` : `${d.weekday} ${d.day} ${d.month}`}
                            onClick={() => pick("date", d.iso)}
                          >
                            <span className="day-week">{d.weekday}</span>
                            <span className="day-num">{d.day}</span>
                            <span className="day-month">{d.closed ? "Closed" : d.month}</span>
                          </button>
                        ))}
                      </div>
                      <label className="other-date">
                        Another date
                        <input type="date" min={isoDate(new Date())} value={form.date} onChange={(e) => pick("date", e.target.value)} />
                      </label>
                    </Step>

                    <Step title="Time" error={errors.time}>
                      {!form.date || !form.dentistId ? (
                        <p className="hint">Pick a dentist and a day to see open times.</p>
                      ) : slots.length === 0 ? (
                        <p className="hint">The clinic is closed on Sundays.</p>
                      ) : (
                        <div className="slots">
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
                    </Step>

                    <Step title="Your details">
                      <div className="fields">
                        <Field label="Name" error={errors.name}>
                          <input value={form.name} onChange={set("name")} autoComplete="name" />
                        </Field>
                        <Field label="Email" error={errors.email}>
                          <input type="email" value={form.email} onChange={set("email")} autoComplete="email" />
                        </Field>
                        <Field label="Phone" error={errors.phone}>
                          <input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
                        </Field>
                      </div>
                    </Step>

                    <div className="checkout">
                      <p className="summary" aria-live="polite">
                        {form.serviceId ? (
                          <>
                            <strong>{serviceName(form.serviceId)}</strong>
                            {form.dentistId && <> with {dentistName(form.dentistId)}</>}
                            {form.date && <>, {prettyDate(form.date)}</>}
                            {form.time && <> at {form.time}</>}
                          </>
                        ) : "Choose a service to start."}
                      </p>
                      <button className="primary" type="submit">Confirm booking</button>
                    </div>
                  </form>
                )}
              </section>
              <DentalBot onBook={fillFromBot} />
            </main>
          </>
        )}
      </div>
    </>
  );
}

function Step({ title, error, children }) {
  return (
    <fieldset className="step">
      <legend>{title}</legend>
      {children}
      {error && <p className="error">{error}</p>}
    </fieldset>
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
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="done" style={toneStyle(booking.serviceId)}>
      <div className="ticket">
        <CheckCircle className="done-icon" weight="fill" aria-hidden="true" />
        <h2 ref={ref} tabIndex={-1}>You're booked.</h2>
        <p>
          {serviceName(booking.serviceId)} with {dentistName(booking.dentistId)}
          <br />
          {prettyDate(booking.date)} at {booking.time}
        </p>
        <p className="ref">Reference {booking.id}</p>
      </div>
      <details className="email">
        <summary>Email preview</summary>
        <p className="hint">This is what the confirmation email would say. Nothing is actually sent in this demo.</p>
        <pre>{confirmationEmail(booking)}</pre>
      </details>
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

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [log]);

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
    <aside className="assistant" aria-label="DentalBot">
      <div className="bot-head">
        <span className="bot-avatar" aria-hidden="true"><Tooth weight="fill" /></span>
        <div>
          <h2>DentalBot</h2>
          <p>Matches keywords against a short FAQ list. No AI model.</p>
        </div>
      </div>
      <div className="log" ref={logRef} aria-live="polite">
        {log.map((m, i) => <p key={i} className={`msg ${m.who}`}>{m.text}</p>)}
      </div>
      <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(text); setText(""); }}>
        {SR && (
          <button
            type="button" className={listening ? "mic on" : "mic"} onClick={listen} disabled={listening}
            aria-label={listening ? "Listening" : "Ask by voice"}
          ><Microphone weight="fill" /></button>
        )}
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask DentalBot" aria-label="Question for DentalBot" />
        <button type="submit" className="send" aria-label="Send" disabled={!text.trim()}><ArrowUp weight="bold" /></button>
      </form>
      {!SR && <p className="hint small">Voice input needs a browser with the Web Speech API (for example Chrome). Typing works everywhere.</p>}
    </aside>
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
    <main className="admin">
      <div className="admin-head">
        <div>
          <h1>Bookings</h1>
          <p className="hint">{bookings.length} in total. The CSV holds the same columns a staff spreadsheet would.</p>
        </div>
        <div className="admin-actions">
          {api.reset && (
            <button className="ghost" onClick={() => api.reset().then(load)}>
              <ArrowCounterClockwise weight="bold" aria-hidden="true" /> Reset demo data
            </button>
          )}
          <button className="primary" onClick={exportCSV}>
            <DownloadSimple weight="bold" aria-hidden="true" /> Export CSV
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Ref</th><th>Date</th><th>Time</th><th>Service</th><th>Dentist</th><th>Name</th><th>Email</th></tr></thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td className="mono">{b.id}</td><td>{b.date}</td><td className="mono">{b.time}</td>
                <td><span className="chip" style={{ "--c": tone(b.serviceId) }}>{serviceName(b.serviceId)}</span></td>
                <td>{dentistName(b.dentistId)}</td><td>{b.name}</td><td>{b.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
