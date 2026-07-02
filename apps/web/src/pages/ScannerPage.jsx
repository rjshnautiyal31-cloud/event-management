import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function ScannerPage({ auth }) {
  const [result, setResult] = useState(null);
  const [gateNumber, setGateNumber] = useState(auth.user?.assignedGateName || "Gate A");
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("qr-reader", {
      fps: 15,
      qrbox: { width: 250, height: 250 }
    });

    scanner.render(
      async (decodedText) => {
        try {
          const response = await api("/api/scan/validate", {
            token: auth.token,
            method: "POST",
            body: { ticketUuid: decodedText, gateNumber }
          });
          setResult(response);
        } catch (err) {
          setResult({ status: "invalid", message: err.message });
        }
      },
      (error) => {
        // Silent error to prevent cluttering console
      }
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [gateNumber, auth.token]);

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Premium Top Navigation */}
      <nav className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm shadow-md">
                QR
              </span>
              <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                Gate Validator
              </span>
            </div>
            <Link 
              to="/dashboard" 
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
            >
              <span>Dashboard</span>
              <span className="text-[10px]">➔</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-lg px-4 sm:px-6 mt-6 space-y-5 animate-scale-up">
        {/* Real-time Scan Result Alerts */}
        {result && (
          <div
            className={`rounded-2xl border p-4 shadow-sm transition-all duration-300 ${
              result.status === "granted"
                ? "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-emerald-50/20"
                : result.status === "already_checked_in"
                  ? "border-amber-200 bg-amber-50 text-amber-950 shadow-amber-50/20"
                  : "border-red-200 bg-red-50 text-red-950 shadow-red-50/20"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">
                {result.status === "granted" ? "🟢" : result.status === "already_checked_in" ? "🟡" : "🔴"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-base tracking-tight leading-snug">
                  {result.message || "Scan result"}
                </p>
                {result.checkedInAt && (
                  <p className="text-xs font-semibold opacity-80 mt-1">
                    📅 Checked in: {new Date(result.checkedInAt).toLocaleString()}
                  </p>
                )}
                {result.attendee?.name && (
                  <div className="text-sm mt-3 border-t pt-2.5 border-current/10 space-y-0.5">
                    <p className="font-bold">Attendee: {result.attendee.name}</p>
                    <p className="text-xs opacity-80">{result.attendee.email}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Gate Configuration Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-base">📍</span>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Validator Gate Location
            </label>
          </div>
          <input
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50 font-semibold text-slate-800"
            value={gateNumber}
            onChange={(e) => setGateNumber(e.target.value)}
            disabled={!!auth.user?.assignedGateName} // Lock if assigned directly by Admin
            placeholder="Gate Number"
          />
          {auth.user?.assignedGateName && (
            <p className="text-[10px] font-semibold text-slate-400 italic">
              ℹ️ Locked by Admin to your assigned post.
            </p>
          )}
        </div>

        {/* Scanner Lens Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-600" />
          <div className="flex items-center gap-1.5 mb-3 px-1">
            <span className="animate-pulse h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Camera Live Validation Lens
            </span>
          </div>
          
          <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-900 aspect-square flex items-center justify-center">
            <div id="qr-reader" className="w-full h-full bg-slate-900" />
          </div>

          <div className="mt-3.5 text-center border-t border-slate-50 pt-2.5">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Powered by Rajesh Nautiyal
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
