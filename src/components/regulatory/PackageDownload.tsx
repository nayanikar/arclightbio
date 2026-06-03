"use client";

import { useState } from "react";
import type { RegulatoryPackage } from "@/types/RegulatoryPackage";
import { Button } from "@/components/ui/button";
import {
  buildRegulatoryPdfFilename,
  generateRegulatoryPdf,
} from "@/lib/regulatoryPdf";
import { Download, Loader2 } from "lucide-react";

interface PackageDownloadProps {
  pkg: RegulatoryPackage;
  hypothesisStatement: string;
  searchQuery: string;
}

export function PackageDownload({
  pkg,
  hypothesisStatement,
  searchQuery,
}: PackageDownloadProps) {
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const blob = await generateRegulatoryPdf({
        pkg,
        searchQuery,
        hypothesisStatement,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildRegulatoryPdfFilename(searchQuery);
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExportPdf}
      disabled={exporting}
      className="bg-brand-purple hover:bg-brand-purple/90"
    >
      {exporting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating PDF…
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </>
      )}
    </Button>
  );
}
