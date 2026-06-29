const UUID_V4_OR_V1_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_LOOSE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function looksLikeUuid(value) {
  return UUID_V4_OR_V1_PATTERN.test(value) || UUID_LOOSE_PATTERN.test(value);
}

export function extractTicketUuid(rawTicketValue) {
  const raw = String(rawTicketValue || "").trim();
  if (!raw) return "";

  if (looksLikeUuid(raw)) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    const fromQuery =
      parsed.searchParams.get("ticketUuid") ||
      parsed.searchParams.get("ticket") ||
      parsed.searchParams.get("uuid") ||
      "";

    const normalizedQuery = String(fromQuery).trim();
    if (looksLikeUuid(normalizedQuery)) {
      return normalizedQuery;
    }

    const pathTail = parsed.pathname.split("/").filter(Boolean).at(-1) || "";
    const normalizedPathTail = String(pathTail).trim();

    if (looksLikeUuid(normalizedPathTail)) {
      return normalizedPathTail;
    }
  } catch {
    // Ignore URL parsing errors and fall back to the raw scanner value.
  }

  return raw;
}

