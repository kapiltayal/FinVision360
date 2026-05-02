import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportCSV, exportExcel, exportPDF, type ExportData } from "@/lib/export";

export function ExportMenu({ data }: { data: ExportData }) {
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePDF = async () => {
    setPdfLoading(true);
    try {
      await exportPDF(data);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-export" disabled={pdfLoading}>
          {pdfLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {pdfLoading ? "Generating…" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Download as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exportCSV(data)} data-testid="export-csv">
          CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportExcel(data)} data-testid="export-excel">
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePDF} disabled={pdfLoading} data-testid="export-pdf">
          PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
