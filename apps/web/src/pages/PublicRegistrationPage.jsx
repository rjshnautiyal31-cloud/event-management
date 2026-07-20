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

  const isExpired = event ? new Date() > new Date(event.date) : false;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <span className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-600 text-white font-bold text-xl shadow-md shadow-indigo-200">
          🎟️
        </span>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Event Registration
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 font-medium">
          {isExpired ? "Registration is closed for this event." : "Register to claim your unique scan-ready QR entrance ticket"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl animate-scale-up">
        <div className="bg-white shadow-md rounded-2xl border border-slate-100 relative overflow-hidden p-6 md:p-8 space-y-6">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 to-violet-600" />

          {event && (
            <div className="border-b border-slate-100 pb-4 text-center sm:text-left">
              <h1 className="text-xl font-bold text-slate-950">{event.title}</h1>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mt-1.5 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <span className="flex items-center gap-1">📅 {new Date(event.date).toLocaleString()}</span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="flex items-center gap-1">📍 {event.location}</span>
              </p>
              {event.description && (
                <p className="text-sm text-slate-500 mt-3 border-t pt-3 border-slate-50 leading-relaxed">
                  {event.description}
                </p>
              )}
            </div>
          )}

          {!result ? (
            isExpired ? (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm font-semibold text-amber-800 text-center">
                This event has expired. Registration is no longer available.
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  placeholder="john@example.com"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Phone Number (Optional)
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  placeholder="+1 (555) 000-0000"
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                />
              </div>

              <button className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors py-3 text-white font-semibold text-sm shadow-sm shadow-indigo-100 flex items-center justify-center gap-1.5 mt-2">
                <span>Complete Registration & Claim Ticket</span>
                <span className="text-xs">🎟️</span>
              </button>
            </form>
            )
          ) : (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 flex flex-col items-center text-center space-y-4 animate-scale-up relative">
              <div className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-slate-50 border-r border-slate-200 rounded-full" />
              <div className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-slate-50 border-l border-slate-200 rounded-full" />
              
              <div>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 font-bold text-lg">
                  ✓
                </div>
                <p className="mt-2.5 text-base font-bold text-slate-900">Your QR Ticket is Ready!</p>
                <p className="text-xs text-slate-500 mt-1">A copy of this ticket has been emailed to you.</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <img className="max-w-[220px] aspect-square" src={result.qrCodeDataUrl} alt="QR Ticket" />
              </div>

              <div className="text-xs font-mono text-slate-600 bg-white px-3 py-1.5 rounded border border-slate-200 shadow-sm select-all">
                Ticket ID: <span className="font-semibold text-slate-900">{result.ticketUuid}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-xs font-semibold text-red-700 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

