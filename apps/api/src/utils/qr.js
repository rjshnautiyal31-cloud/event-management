import QRCode from "qrcode";

export async function generateQrCodeDataUrl(ticketUuid) {
  return QRCode.toDataURL(ticketUuid, {
    margin: 1,
    width: 280
  });
}

