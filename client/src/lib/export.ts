import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportFormat = "csv" | "pdf";

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export function downloadTextAsFile(text: string, filename: string, mimeType: string) {
  downloadBlob(new Blob([text], { type: mimeType }), filename);
}

function escapeCsvCell(value: unknown) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>, columns: string[]) {
  const header = columns.map(escapeCsvCell).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsvCell(row[c])).join(","));
  return [header, ...lines].join("\n") + "\n";
}

export function keyValueToRows(obj: Record<string, unknown>) {
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
}

export function parseCsvToTable(csvText: string) {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const columns = (parsed.meta.fields || []).map(String);
  const rows = Array.isArray(parsed.data) ? parsed.data : [];
  return { columns, rows };
}

export function exportTableToPdf(options: {
  title: string;
  filename: string;
  tables: Array<{ columns: string[]; rows: Array<Record<string, unknown>>; headerLabel?: string }>;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  doc.setFontSize(14);
  doc.text(options.title, 40, 40);

  let currentY = 60;

  for (let idx = 0; idx < options.tables.length; idx++) {
    const table = options.tables[idx];
    if (table.headerLabel) {
      doc.setFontSize(11);
      doc.text(table.headerLabel, 40, currentY);
      currentY += 10;
    }

    autoTable(doc, {
      startY: currentY,
      head: [table.columns],
      body: table.rows.map((row: Record<string, unknown>) =>
        table.columns.map((col: string) => (row[col] == null ? "" : String(row[col])))
      ),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [240, 240, 240], textColor: 20 },
      margin: { left: 40, right: 40 },
      theme: "grid",
    });

    const finalY = (doc as any).lastAutoTable?.finalY;
    currentY = typeof finalY === "number" ? finalY + 20 : currentY + 20;

    if (idx < options.tables.length - 1 && currentY > 740) {
      doc.addPage();
      currentY = 40;
    }
  }

  doc.save(options.filename);
}
