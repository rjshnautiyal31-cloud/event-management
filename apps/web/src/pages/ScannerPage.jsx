import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function ScannerPage({ auth }) {
  const [result, setResult] = useState(null);
  const [gateNumber, setGateNumber] = useState("Gate-A");
  const busyRef = useRef(false);
  const gateRef = useRef("Gate-A");
  const scannerRef = useRef(null);

  useEffect(() => {
    gateRef.current = gateNumber;
  }, [gateNumber]);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: 220
      },
      false
    );

    scannerRef.current = scanner;

    scanner.render(
      async (decodedText) => {
        if (busyRef.current) return;
        busyRef.current = true;
        try {
          const payload = await api("/api/scan/validate", {
            token: auth.token,
            method: "POST",
            body: { ticketUuid: decodedText, gateNumber: gateRef.current }
          });
          setResult(payload);
        } catch (err) {
          setResult({ status: "error", message: err.message });
        } finally {
          setTimeout(() => {
            busyRef.current = false;
          }, 1200);
        }
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [auth.token]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">QR Check-in Scanner</h1>
        <Link to="/dashboard" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
          Dashboard
        </Link>
      </div>

      <div className="rounded bg-white p-4 shadow">
        <label className="text-sm font-medium">Gate Number</label>
        <input
          className="mt-2 w-full rounded border p-2"
          value={gateNumber}
          onChange={(e) => setGateNumber(e.target.value)}
        />
      </div>

      <div className="rounded bg-white p-4 shadow">
        <div id="qr-reader" />
      </div>

      {result && (
        <div
          className={`rounded border p-4 ${
            result.status === "granted"
              ? "border-emerald-300 bg-emerald-50"
              : result.status === "already_checked_in"
                ? "border-amber-300 bg-amber-50"
                : "border-red-300 bg-red-50"
          }`}
        >
          <p className="font-semibold">{result.message || "Scan result"}</p>
          {result.checkedInAt && (
            <p className="text-sm">Checked in at: {new Date(result.checkedInAt).toLocaleString()}</p>
          )}
          {result.attendee?.name && <p className="text-sm">Attendee: {result.attendee.name}</p>}
        </div>
      )}
    </div>
  );
}

