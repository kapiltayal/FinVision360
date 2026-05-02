import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportSheet = {
  name: string;
  columns: string[];
  rows: (string | number | null | undefined)[][];
};

export type ExportData = {
  filename: string;
  sheets: ExportSheet[];
};

export function exportCSV(data: ExportData) {
  const lines: string[] = [];
  for (let i = 0; i < data.sheets.length; i++) {
    const sheet = data.sheets[i];
    if (data.sheets.length > 1) {
      if (i > 0) lines.push("");
      lines.push(`# ${sheet.name}`);
    }
    lines.push(sheet.columns.map(quoteCell).join(","));
    for (const row of sheet.rows) {
      lines.push(row.map((c) => quoteCell(String(c ?? ""))).join(","));
    }
  }
  download(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }), `${data.filename}.csv`);
}

export function exportExcel(data: ExportData) {
  const wb = XLSX.utils.book_new();
  for (const sheet of data.sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.columns, ...sheet.rows]);
    const colWidths = sheet.columns.map((col, ci) => ({
      wch: Math.max(col.length, ...sheet.rows.map((r) => String(r[ci] ?? "").length), 10),
    }));
    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${data.filename}.xlsx`);
}

export function exportPDF(data: ExportData) {
  const doc = new jsPDF({ orientation: "landscape" });
  const BRAND: [number, number, number] = [28, 145, 212];

  let y = 16;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND);
  doc.text(data.filename, 14, y);

  y += 7;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`Exported ${new Date().toLocaleString()}`, 14, y);
  y += 5;

  for (let i = 0; i < data.sheets.length; i++) {
    const sheet = data.sheets[i];

    if (data.sheets.length > 1) {
      y += 4;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(sheet.name, 14, y);
      y += 4;
    }

    autoTable(doc, {
      startY: y,
      head: [sheet.columns],
      body: sheet.rows.map((r) => r.map((c) => String(c ?? ""))),
      styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 251, 255] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  doc.save(`${data.filename}.pdf`);
}

function quoteCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
