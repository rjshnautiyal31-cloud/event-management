import { parse } from "csv-parse/sync";
import XLSX from "xlsx";

function normalizeRows(rows) {
  return rows
    .map((row) => {
      // Create a clean row with lowercased, trimmed keys and stripped BOMs (UTF-8 signature)
      const cleanRow = {};
      for (const key of Object.keys(row)) {
        if (key) {
          const cleanKey = key.replace(/^\uFEFF/, "").trim().toLowerCase();
          cleanRow[cleanKey] = row[key];
        }
      }

      return {
        name: cleanRow.name || cleanRow.fullname || "",
        email: cleanRow.email || "",
        phoneNumber: cleanRow["phone number"] || cleanRow.phone || cleanRow.phonenumber || cleanRow.telephone || ""
      };
    })
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

