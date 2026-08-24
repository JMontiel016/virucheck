"use client";

import React, { useState } from "react";
import { Transaction } from "@/types";
import { exportTransactionsToExcel, exportTransactionsToCSV } from "@/lib/utils/excel";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Download, FileText, ChevronDown } from "lucide-react";

interface ExportExcelButtonProps {
  transactions: Transaction[];
}

export default function ExportExcelButton({ transactions }: ExportExcelButtonProps) {
  const [openMenu, setOpenMenu] = useState(false);

  const handleExportXLSX = () => {
    if (transactions.length === 0) return;
    exportTransactionsToExcel(transactions);
    setOpenMenu(false);
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    exportTransactionsToCSV(transactions);
    setOpenMenu(false);
  };

  const disabled = transactions.length === 0;

  return (
    <div className="relative inline-block text-left">
      <Button
        variant="outline"
        onClick={() => !disabled && setOpenMenu(!openMenu)}
        disabled={disabled}
        className="gap-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Exportar Datos
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </Button>

      {openMenu && (
        <div className="absolute right-0 z-50 mt-2 w-52 rounded-lg border border-slate-800 bg-slate-900 p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur-md">
          <button
            onClick={handleExportXLSX}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            Descargar Excel (.xlsx)
          </button>
          <button
            onClick={handleExportCSV}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <FileText className="h-3.5 w-3.5 text-blue-400" />
            Descargar Archivo CSV (.csv)
          </button>
        </div>
      )}
    </div>
  );
}