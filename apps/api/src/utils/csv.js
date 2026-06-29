import { parse } from "csv-parse/sync";
import XLSX from "xlsx";

function normalizeRows(rows) {
  return rows
    .map((row) => ({
      name: row.Name || row.name || "",
      email: row.Email || row.email || "",
      phoneNumber: row["Phone Number"] || row.phone || row.Phone || row.phoneNumber || ""
    }))
    .filter((row) => row.name && row.email);
}

export function parseAttendeeCsv(buffer) {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return normalizeRows(records);
}

export function parseAttendeeSpreadsheet(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  return normalizeRows(rows);
}

