import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import QRCode from "qrcode";
import { AppShell } from "../components/Navbar.jsx";
import { Icon } from "../components/Icons.jsx";

export function QRGeneratorPage({ auth }) {
  const isAdminRole =
    auth.user?.role === "admin" ||
    auth.user?.role === "super_admin" ||
    auth.user?.role === "event_admin" ||
    auth.user?.role === "owner" ||
    auth.user?.role === "co_owner";
  if (!isAdminRole) {
    return <Navigate to="/dashboard" replace />;
  }

  const [url, setUrl] = useState("https://example.com");
  const [fgColor, setFgColor] = useState("#34206F"); // Primary Deep Indigo token
  const [bgColor, setBgColor] = useState("#ffffff");
  const [size, setSize] = useState(256);
  const [margin, setMargin] = useState(4);
  const [errorLevel, setErrorLevel] = useState("H"); // Default high for logos
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoSize, setLogoSize] = useState(20); // percentage (10 to 30)
  const [downloadFormat, setDownloadFormat] = useState("png");
  const [error, setError] = useState("");

  const canvasRef = useRef(null);

  useEffect(() => {
    generateQR();
  }, [url, fgColor, bgColor, size, margin, errorLevel, logoPreview, logoSize]);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024 * 2) {
        setError("Logo must be smaller than 2MB");
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview("");
  };

  const generateQR = async () => {
    if (!canvasRef.current) return;
    setError("");

    try {
      await QRCode.toCanvas(canvasRef.current, url || "https://example.com", {
        width: size,
        margin: margin,
        errorCorrectionLevel: errorLevel,
        color: {
          dark: fgColor,
          light: bgColor
        }
      });

      if (logoPreview) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.src = logoPreview;
        img.onload = () => {
          const qrSize = canvas.width;
          const lSize = (qrSize * logoSize) / 100;
          const x = (qrSize - lSize) / 2;
          const y = (qrSize - lSize) / 2;

          ctx.fillStyle = bgColor;
          const borderOffset = lSize * 0.15;
          const bgX = x - borderOffset;
          const bgY = y - borderOffset;
          const bgSize = lSize + borderOffset * 2;

          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(bgX, bgY, bgSize, bgSize, bgSize * 0.2);
          } else {
            ctx.rect(bgX, bgY, bgSize, bgSize);
          }
          ctx.fill();

          ctx.drawImage(img, x, y, lSize, lSize);
        };
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const downloadQR = async () => {
    try {
      if (downloadFormat === "png") {
        const canvas = canvasRef.current;
        const urlData = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = urlData;
        link.download = `qrcode_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        let svgString = await QRCode.toString(url || "https://example.com", {
          type: "svg",
          width: size,
          margin: margin,
          errorCorrectionLevel: errorLevel,
          color: {
            dark: fgColor,
            light: bgColor
          }
        });

        if (logoPreview) {
          const lSize = (size * logoSize) / 100;
          const x = (size - lSize) / 2;
          const y = (size - lSize) / 2;
          const bgSize = lSize * 1.3;
          const bgX = (size - bgSize) / 2;
          const bgY = (size - bgSize) / 2;

          const logoSvgElement = `
            <g>
              <rect x="${bgX}" y="${bgY}" width="${bgSize}" height="${bgSize}" rx="${bgSize * 0.25}" fill="${bgColor}" />
              <image x="${x}" y="${y}" width="${lSize}" height="${lSize}" href="${logoPreview}" />
            </g>
          `;
          svgString = svgString.replace("</svg>", `${logoSvgElement}</svg>`);
        }

        const blob = new Blob([svgString], {
          type: "image/svg+xml;charset=utf-8"
        });
        const urlData = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = urlData;
        link.download = `qrcode_${Date.now()}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(urlData);
      }
    } catch (err) {
      setError("Failed to download: " + err.message);
    }
  };

  return (
    <AppShell auth={auth} pageTitle="QR Code Generator">
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 animate-fade-in">
        {/* Hero Banner */}
        <div className="ui-hero-card p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold text-primary leading-tight">
              QR Code Generator
            </h1>
            <p className="text-[15px] text-body mt-1.5">
              Create and customize highly recognizable QR codes with custom styling and branding.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/85 px-4 py-2 text-xs font-bold text-primary border border-pastel-lavender shadow-subtle shrink-0">
            <Icon name="sparkles" className="w-4 h-4 text-primary" />
            <span>Interactive Generator</span>
          </span>
        </div>

        {error && (
          <div className="p-4 rounded-control bg-danger-tint border border-danger/25 text-danger text-sm font-semibold flex items-center gap-2">
            <Icon name="alert" className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Card */}
          <div className="lg:col-span-2">
            <div className="ui-card p-6 sm:p-7 space-y-7">
              {/* Section 1 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-theme">
                  <span className="h-8 w-8 rounded-tile bg-primary-soft text-primary font-bold text-xs flex items-center justify-center">
                    01
                  </span>
                  <h2 className="text-lg font-bold text-heading">
                    QR Content
                  </h2>
                </div>

                <div>
                  <label className="ui-label">Target URL / Text</label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/tickets/123"
                    className="ui-input"
                  />
                </div>
              </div>

              {/* Section 2 */}
              <div className="space-y-5 pt-1 border-t border-theme">
                <div className="flex items-center gap-2.5 pt-2 pb-1">
                  <span className="h-8 w-8 rounded-tile bg-primary-soft text-primary font-bold text-xs flex items-center justify-center">
                    02
                  </span>
                  <h2 className="text-lg font-bold text-heading">
                    Branding &amp; Colors
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="ui-label">Foreground Color</label>
                    <div className="flex gap-2.5">
                      <input
                        type="color"
                        value={fgColor}
                        onChange={(e) => setFgColor(e.target.value)}
                        className="w-14 h-[52px] p-1.5 bg-surface border border-theme rounded-control cursor-pointer shrink-0"
                        aria-label="Foreground color picker"
                      />
                      <input
                        type="text"
                        value={fgColor}
                        onChange={(e) => setFgColor(e.target.value)}
                        placeholder="#34206F"
                        className="ui-input font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="ui-label">Background Color</label>
                    <div className="flex gap-2.5">
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-14 h-[52px] p-1.5 bg-surface border border-theme rounded-control cursor-pointer shrink-0"
                        aria-label="Background color picker"
                      />
                      <input
                        type="text"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        placeholder="#FFFFFF"
                        className="ui-input font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="ui-label">Embed Center Logo (Optional)</label>
                  {logoPreview ? (
                    <div className="flex items-center gap-4 p-4 bg-primary-tint border border-pastel-lavender rounded-card">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="h-14 w-14 object-contain rounded-tile bg-surface p-1.5 border border-theme"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-heading truncate">
                          {logoFile ? logoFile.name : "Custom Logo"}
                        </p>
                        <button
                          type="button"
                          onClick={clearLogo}
                          className="inline-flex items-center gap-1 text-xs font-bold text-danger hover:underline mt-1 cursor-pointer"
                        >
                          <Icon name="trash" className="w-3.5 h-3.5" />
                          <span>Remove Logo</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-pastel-lavender rounded-card hover:border-primary/50 transition-all p-6 text-center cursor-pointer relative bg-primary-tint/70 hover:bg-primary-soft/50">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        aria-label="Upload Brand Logo"
                      />
                      <span className="mx-auto h-11 w-11 rounded-full bg-surface border border-theme text-primary flex items-center justify-center shadow-subtle">
                        <Icon name="upload" className="w-5 h-5" />
                      </span>
                      <p className="text-sm font-bold text-heading mt-2.5">
                        Upload Brand Logo
                      </p>
                      <p className="text-xs text-muted mt-1">
                        Supports PNG, JPG (Max 2MB)
                      </p>
                    </div>
                  )}
                </div>

                {logoPreview && (
                  <div className="p-4 rounded-card bg-primary-tint/60 border border-theme">
                    <div className="flex justify-between text-sm font-bold text-heading mb-2">
                      <span>Logo Size Offset</span>
                      <span className="text-primary">{logoSize}%</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="28"
                      value={logoSize}
                      onChange={(e) => setLogoSize(Number(e.target.value))}
                      className="w-full accent-[#34206F] cursor-pointer"
                    />
                    <p className="text-xs text-muted mt-1.5">
                      Note: Larger logo sizes require a higher error correction level to keep the QR code scannable.
                    </p>
                  </div>
                )}
              </div>

              {/* Section 3 */}
              <div className="space-y-4 pt-1 border-t border-theme">
                <div className="flex items-center gap-2.5 pt-2 pb-1">
                  <span className="h-8 w-8 rounded-tile bg-primary-soft text-primary font-bold text-xs flex items-center justify-center">
                    03
                  </span>
                  <h2 className="text-lg font-bold text-heading">
                    QR Code Parameters
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="ui-label">Error Correction Level</label>
                    <select
                      value={errorLevel}
                      onChange={(e) => setErrorLevel(e.target.value)}
                      className="ui-select"
                    >
                      <option value="L">Low (7% Recovery)</option>
                      <option value="M">Medium (15% Recovery)</option>
                      <option value="Q">Quartile (25% Recovery)</option>
                      <option value="H">High (30% Recovery)</option>
                    </select>
                  </div>

                  <div>
                    <label className="ui-label">Quiet Zone (Margin)</label>
                    <select
                      value={margin}
                      onChange={(e) => setMargin(Number(e.target.value))}
                      className="ui-select"
                    >
                      <option value="0">No Border (0)</option>
                      <option value="2">Compact (2)</option>
                      <option value="4">Standard (4)</option>
                      <option value="6">Wide (6)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preview & Download Card */}
          <div>
            <div className="ui-container p-6 sm:p-7 flex flex-col items-center lg:sticky lg:top-6">
              <div className="w-full flex items-center justify-between border-b border-theme pb-4 mb-6">
                <h2 className="text-lg font-bold text-heading">Live Preview</h2>
                <span className="px-2.5 py-1 rounded-full bg-pastel-mint text-heading text-xs font-bold">
                  {size}px
                </span>
              </div>

              <div className="p-5 bg-primary-tint border border-pastel-lavender rounded-card flex items-center justify-center aspect-square w-full max-w-[280px]">
                <canvas
                  ref={canvasRef}
                  className="max-w-full max-h-full rounded-tile bg-surface shadow-subtle object-contain"
                />
              </div>

              <div className="w-full border-t border-theme mt-6 pt-6 space-y-5">
                <div>
                  <label className="ui-label">Download File Format</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDownloadFormat("png")}
                      className={`min-h-[46px] px-3 py-2 text-xs sm:text-sm rounded-control transition-all cursor-pointer ${
                        downloadFormat === "png"
                          ? "bg-primary-soft border-2 border-primary text-primary font-bold"
                          : "bg-surface border border-theme text-body font-semibold hover:bg-primary-tint"
                      }`}
                    >
                      PNG (Raster)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDownloadFormat("svg")}
                      className={`min-h-[46px] px-3 py-2 text-xs sm:text-sm rounded-control transition-all cursor-pointer ${
                        downloadFormat === "svg"
                          ? "bg-primary-soft border-2 border-primary text-primary font-bold"
                          : "bg-surface border border-theme text-body font-semibold hover:bg-primary-tint"
                      }`}
                    >
                      SVG (Vector)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="ui-label">Resolution (Export Width)</label>
                  <select
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                    className="ui-select"
                  >
                    <option value="128">128 x 128 px</option>
                    <option value="256">256 x 256 px</option>
                    <option value="512">512 x 512 px</option>
                    <option value="1024">1024 x 1024 px</option>
                    <option value="2048">2048 x 2048 px</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={downloadQR}
                  className="ui-btn-primary w-full"
                >
                  <Icon name="download" className="w-5 h-5" />
                  <span>Download Code</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
