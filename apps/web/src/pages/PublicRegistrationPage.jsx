import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

export function PublicRegistrationPage() {
  const { slug } = useParams();
  const [event, setEvent] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phoneNumber: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/public/events/${slug}`)
      .then(setEvent)
      .catch((err) => setError(err.message));
  }, [slug]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const response = await api(`/api/public/events/${slug}/register`, {
        method: "POST",
        body: form
      });
      setResult(response.attendee);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-xl space-y-4 rounded bg-white p-6 shadow">
      <h1 className="text-2xl font-semibold">{event?.title || "Event Registration"}</h1>
      {event && (
        <p className="text-sm text-slate-600">
          {new Date(event.date).toLocaleString()} - {event.location}
        </p>
      )}
      <p className="text-sm">{event?.description}</p>

      {!result ? (
        <form className="space-y-2" onSubmit={handleSubmit}>
          <input
            className="w-full rounded border p-2"
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="w-full rounded border p-2"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            className="w-full rounded border p-2"
            placeholder="Phone Number"
            value={form.phoneNumber}
            onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
          />
          <button className="w-full rounded bg-slate-900 px-3 py-2 text-white">Register</button>
        </form>
      ) : (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-800">Registration successful</p>
          <p className="mt-2 text-sm">Ticket UUID: {result.ticketUuid}</p>
          <img className="mt-3 max-w-[240px]" src={result.qrCodeDataUrl} alt="QR Ticket" />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

