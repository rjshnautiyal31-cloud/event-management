import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import QRCode from "qrcode";
import { Navbar } from "../components/Navbar.jsx";

export function QRGeneratorPage({ auth }) {
  const isAdminRole = auth.user?.role === "admin" || auth.user?.role === "super_admin" || auth.user?.role === "event_admin";
  if (!isAdminRole) {
    return <Navigate to="/dashboard" replace />;
  }

  const [url, setUrl] = useState("https://example.com");
  const [fgColor, setFgColor] = useState("#0A2D59"); // Brand Navy #0A2D59
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
      // Generate QR Code on the canvas
      await QRCode.toCanvas(canvasRef.current, url || "https://example.com", {
        width: size,
        margin: margin,
        errorCorrectionLevel: errorLevel,
        color: {
          dark: fgColor,
          light: bgColor,
        },
      });

      // Overlay logo if uploaded
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

          // Draw backdrop card for logo to mask background QR modules
          ctx.fillStyle = bgColor;
          const borderOffset = lSize * 0.15;
          const bgX = x - borderOffset;
          const bgY = y - borderOffset;
          const bgSize = lSize + borderOffset * 2;

          ctx.beginPath();
          // Draw rounded rectangle backdrop
          if (ctx.roundRect) {
            ctx.roundRect(bgX, bgY, bgSize, bgSize, bgSize * 0.2);
          } else {
            ctx.rect(bgX, bgY, bgSize, bgSize);
          }
          ctx.fill();

          // Render logo image
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
        // SVG output
        let svgString = await QRCode.toString(url || "https://example.com", {
          type: "svg",
          width: size,
          margin: margin,
          errorCorrectionLevel: errorLevel,
          color: {
            dark: fgColor,
            light: bgColor,
          },
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

        const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
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
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Shared Navbar Header & Hamburger Menu */}
      <Navbar auth={auth} />

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-slate-800 text-white shadow-sm mb-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight">QR Code Generator</h1>
            <p className="text-xs text-indigo-200 mt-1 font-medium">Create and customize highly recognizable QR codes with custom styling and branding.</p>
          </div>
          <span className="inline-flex items-center rounded-md bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-300 border border-indigo-400/20">
            Interactive Generator
          </span>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3">
                1. QR Content
              </h2>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Target URL / Text
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/tickets/123"
                  className="w-full rounded-xl border border-slate-200 p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-850"
                />
              </div>

              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3 pt-2">
                2. Branding & Colors
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Foreground Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="w-12 h-10 p-1 bg-white border border-slate-200 rounded-xl cursor-pointer"
                    />
                    <input
                      type="text"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      placeholder="#000000"
                      className="flex-1 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Background Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-12 h-10 p-1 bg-white border border-slate-200 rounded-xl cursor-pointer"
                    />
                    <input
                      type="text"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      placeholder="#FFFFFF"
                      className="flex-1 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Embed Center Logo (Optional)
                </label>
                {logoPreview ? (
                  <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-12 w-12 object-contain rounded bg-white p-1 border border-slate-100"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {logoFile ? logoFile.name : "Custom Logo"}
                      </p>
                      <button
                        type="button"
                        onClick={clearLogo}
                        className="text-[10px] font-bold uppercase tracking-wider text-red-600 hover:text-red-500 mt-1 transition-colors"
                      >
                        Remove Logo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 transition-all p-4 text-center cursor-pointer relative bg-slate-50">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <span className="text-xl">📁</span>
                    <p className="text-xs font-bold text-slate-700 mt-1">Upload Brand Logo</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Supports PNG, JPG (Max 2MB)</p>
                  </div>
                )}
              </div>

              {logoPreview && (
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    <span>Logo Size Offset</span>
                    <span>{logoSize}%</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="28"
                    value={logoSize}
                    onChange={(e) => setLogoSize(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 italic mt-1">
                    Note: Larger logo sizes require a higher error correction level to keep the QR code scannable.
                  </p>
                </div>
              )}

              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3 pt-2">
                3. QR Code Parameters
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Error Correction Level
                  </label>
                  <select
                    value={errorLevel}
                    onChange={(e) => setErrorLevel(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-semibold text-slate-800"
                  >
                    <option value="L">Low (7% Recovery)</option>
                    <option value="M">Medium (15% Recovery)</option>
                    <option value="Q">Quartile (25% Recovery)</option>
                    <option value="H">High (30% Recovery)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Quiet Zone (Margin)
                  </label>
                  <select
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-semibold text-slate-800"
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

          {/* Preview & Download Card */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center">
              <h2 className="w-full text-sm font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3 mb-6 text-center">
                Live Preview
              </h2>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl shadow-inner flex items-center justify-center aspect-square w-full max-w-[280px]">
                <canvas ref={canvasRef} className="max-w-full max-h-full rounded shadow-sm object-contain" />
              </div>

              <div className="w-full border-t border-slate-100 mt-6 pt-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Download File Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDownloadFormat("png")}
                      className={`py-2 text-xs font-bold uppercase tracking-wider border rounded-xl transition-all ${
                        downloadFormat === "png"
                          ? "bg-slate-900 border-slate-900 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      PNG (Raster)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDownloadFormat("svg")}
                      className={`py-2 text-xs font-bold uppercase tracking-wider border rounded-xl transition-all ${
                        downloadFormat === "svg"
                          ? "bg-slate-900 border-slate-900 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      SVG (Vector)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Resolution (Export Width)
                  </label>
                  <select
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-800"
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
                  className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-extrabold uppercase tracking-wider py-3.5 shadow-md shadow-indigo-100 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
                >
                  <span>💾</span>
                  <span>Download Code</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
