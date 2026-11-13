import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { AppShell } from "../components/Navbar.jsx";
import { Icon } from "../components/Icons.jsx";

export function ScannerPage({ auth }) {
  const [result, setResult] = useState(null);
  const [gateNumber, setGateNumber] = useState(
    auth.user?.assignedGateName || "Gate A"
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const isProcessingRef = useRef(false);
  const cooldownTimeoutRef = useRef(null);
  const scannerRef = useRef(null);

  function resetScanner() {
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
    }
    setResult(null);
    isProcessingRef.current = false;
    setIsProcessing(false);
  }

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("qr-reader", {
      fps: 15,
      qrbox: { width: 250, height: 250 }
    });

    scanner.render(
      async (decodedText) => {
        // If already processing or in cooldown, ignore this camera frame
        if (isProcessingRef.current) return;

        isProcessingRef.current = true;
        setIsProcessing(true);
        setResult(null);

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
      () => {
        // Silent error to prevent cluttering console
      }
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(console.error);
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
      }
    };
  }, [gateNumber, auth.token]);

  return (
    <AppShell auth={auth} pageTitle="Entrance Scanner">
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 animate-scale-up">
        {/* Page Heading */}
        <div className="ui-hero-card p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold text-primary leading-tight">
              Entrance Scanner
            </h1>
            <p className="text-sm text-body mt-1">
              Validate attendee QR passes in real time with double-scan protection.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 self-start sm:self-center px-3.5 py-1.5 rounded-full bg-surface/85 border border-theme text-xs font-bold text-primary">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isProcessing ? "bg-warning animate-pulse" : "bg-success animate-pulse"
              }`}
            />
            <span>{isProcessing ? "Paused" : "Live Ready"}</span>
          </span>
        </div>

        {/* Real-time Scan Result Alerts with Cooldown UI */}
        {result && (
          <div
            className={`rounded-card border p-5 sm:p-6 shadow-soft transition-all duration-300 ${
              result.status === "granted"
                ? "border-success/35 bg-success-tint text-heading"
                : result.status === "already_checked_in"
                  ? "border-warning/35 bg-warning-tint text-heading"
                  : "border-danger/35 bg-danger-tint text-heading"
            }`}
          >
            <div className="flex items-start gap-3.5">
              <span
                className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${
                  result.status === "granted"
                    ? "bg-success text-white"
                    : result.status === "already_checked_in"
                      ? "bg-warning text-white"
                      : "bg-danger text-white"
                }`}
              >
                <Icon
                  name={result.status === "granted" ? "check" : "alert"}
                  className="w-5 h-5"
                />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg text-heading leading-snug">
                  {result.message || "Scan result"}
                </p>
                {result.checkedInAt && (
                  <p className="text-xs font-medium text-body mt-1 inline-flex items-center gap-1.5">
                    <Icon name="clock" className="w-3.5 h-3.5 text-primary" />
                    <span>
                      Checked in: {new Date(result.checkedInAt).toLocaleString()}
                    </span>
                  </p>
                )}
                {result.attendee?.name && (
                  <div className="text-sm mt-3.5 border-t border-theme/80 pt-3 space-y-0.5">
                    <p className="font-bold text-heading">
                      Attendee: {result.attendee.name}
                    </p>
                    <p className="text-xs text-muted">{result.attendee.email}</p>
                  </div>
                )}

                {/* Visual Cooldown Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-3.5 border-t border-theme/80">
                  <span className="text-xs font-semibold text-muted animate-pulse">
                    Scanner Paused (Avoiding Double-Scans)
                  </span>
                  <button
                    type="button"
                    onClick={resetScanner}
                    className="ui-btn-primary-sm min-w-[160px]"
                  >
                    <span>Scan Next Now</span>
                    <Icon name="arrow-right" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gate Configuration Card */}
        <div className="ui-card p-6 space-y-2.5">
          <label className="ui-label flex items-center gap-2 mb-0">
            <span className="h-8 w-8 rounded-tile bg-primary-soft text-primary flex items-center justify-center">
              <Icon name="pin" className="w-4 h-4" />
            </span>
            <span>Validator Gate Location</span>
          </label>
          <input
            className="ui-input"
            value={gateNumber}
            onChange={(e) => setGateNumber(e.target.value)}
            disabled={!!auth.user?.assignedGateName}
            placeholder="Gate Number"
          />
          {auth.user?.assignedGateName && (
            <p className="text-[13px] text-muted">
              Assigned gate location is locked by Admin and cannot be changed.
            </p>
          )}
        </div>

        {/* Scanner Lens Card */}
        <div className="ui-container p-5 sm:p-6 relative overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-4 px-1">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isProcessing
                    ? "bg-warning animate-pulse"
                    : "bg-success animate-pulse"
                }`}
              />
              <span className="text-sm font-bold text-heading">
                {isProcessing
                  ? "Scanner Lens is Paused..."
                  : "Camera Live Validation Lens"}
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-primary-tint text-primary text-xs font-semibold border border-theme">
              {gateNumber}
            </span>
          </div>

          <div
            className={`rounded-[20px] overflow-hidden border border-pastel-lavender bg-[#1D123F] aspect-square flex items-center justify-center transition-all duration-300 ${
              isProcessing ? "opacity-35 scale-[0.985]" : "opacity-100"
            }`}
          >
            <div id="qr-reader" className="w-full h-full bg-[#1D123F]" />
          </div>

          <div className="mt-4 text-center border-t border-theme pt-3">
            <p className="text-xs text-muted font-medium">
              Powered by Rajesh Nautiyal
            </p>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
