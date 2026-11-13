import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { Icon } from "../components/Icons.jsx";

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
    <div className="min-h-screen bg-page flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center">
        <span className="inline-flex items-center justify-center h-14 w-14 rounded-tile bg-indigo-tile text-white font-bold shadow-soft">
          <Icon name="qr" className="w-6 h-6" />
        </span>
        <h2 className="mt-4 text-center text-[30px] sm:text-[34px] font-bold text-primary leading-tight">
          Event Registration
        </h2>
        <p className="mt-2 text-center text-[15px] text-muted">
          {isExpired
            ? "Registration is closed for this event."
            : "Register to claim your unique scan-ready QR entrance ticket"}
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-xl animate-scale-up">
        <div className="ui-container overflow-hidden">
          {event && (
            <div className="bg-hero-gradient border-b border-theme px-6 py-6 sm:px-8 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-heading leading-snug">
                {event.title}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs font-semibold text-primary">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface/80 border border-theme">
                  <Icon name="calendar" className="w-3.5 h-3.5 text-primary" />
                  <span>{new Date(event.date).toLocaleString()}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface/80 border border-theme">
                  <Icon name="pin" className="w-3.5 h-3.5 text-primary" />
                  <span>{event.location}</span>
                </span>
              </div>
              {event.description && (
                <p className="text-sm text-body mt-3.5 pt-3.5 border-t border-theme/70 leading-relaxed">
                  {event.description}
                </p>
              )}
            </div>
          )}

          <div className="p-6 sm:p-8 space-y-6">
            {!result ? (
              isExpired ? (
                <div className="p-5 rounded-card bg-warning-tint border border-warning/30 text-sm font-semibold text-warning text-center">
                  This event has expired. Registration is no longer available.
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label className="ui-label">Full Name</label>
                    <input
                      className="ui-input"
                      placeholder="John Doe"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="ui-label">Email Address</label>
                    <input
                      className="ui-input"
                      placeholder="john@example.com"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="ui-label">Phone Number (Optional)</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-tint border border-theme text-xs font-semibold text-primary pointer-events-none">
                        <Icon name="phone" className="w-3.5 h-3.5" />
                        <span>Tel</span>
                      </span>
                      <input
                        className="ui-input pl-18"
                        style={{ paddingLeft: "4.5rem" }}
                        placeholder="+1 (555) 000-0000"
                        value={form.phoneNumber}
                        onChange={(e) =>
                          setForm({ ...form, phoneNumber: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <button type="submit" className="ui-btn-primary w-full">
                      <span>Complete Registration &amp; Claim Ticket</span>
                      <Icon name="qr" className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )
            ) : (
              <div className="rounded-card border-2 border-dashed border-pastel-lavender bg-primary-tint p-6 sm:p-7 flex flex-col items-center text-center space-y-5 animate-scale-up relative">
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-surface border-r border-pastel-lavender rounded-full" />
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-surface border-l border-pastel-lavender rounded-full" />

                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-tint border border-success/30 text-success">
                    <Icon name="check" className="w-6 h-6" />
                  </div>
                  <p className="mt-3 text-lg font-bold text-heading">
                    Your QR Ticket is Ready!
                  </p>
                  <p className="text-sm text-muted mt-1">
                    A copy of this ticket has been emailed to you.
                  </p>
                </div>

                <div className="bg-surface p-4 rounded-card border border-theme shadow-subtle">
                  <img
                    className="max-w-[220px] aspect-square"
                    src={result.qrCodeDataUrl}
                    alt="QR Ticket"
                  />
                </div>

                <div className="text-xs font-mono text-body bg-surface px-4 py-2 rounded-full border border-theme shadow-subtle select-all">
                  Ticket ID:{" "}
                  <span className="font-bold text-primary">
                    {result.ticketUuid}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3.5 rounded-control bg-danger-tint border border-danger/25 text-sm font-semibold text-danger flex items-center gap-2">
                <Icon name="alert" className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
