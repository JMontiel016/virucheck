import * as XLSX from "xlsx";
import { Transaction } from "@/types";

/**
 * Genera un libro de cálculo Excel (.xlsx) con pestañas diferenciadas
 */
export function exportTransactionsToExcel(
  transactions: Transaction[],
  fileName: string = "ViruCheck_Reporte_Financiero"
) {
  // 1. Mapeo de transacciones a formato de columnas amigable para auditoría
  const dataMovimientos = transactions.map((t, index) => ({
    "Nº": index + 1,
    "Fecha": t.date,
    "Tipo": t.type === "income" ? "Ingreso" : "Egreso",
    "Importe": t.amount,
    "Moneda": t.currency,
    "Contraparte": t.counterpartyName || "N/A",
    "Concepto / Comercio": t.description,
    "Medio de Pago": t.paymentMethod.toUpperCase(),
    "Nº Recibo Correlativo": t.receiptNumber || "N/A",
    "Importe en Palabras": t.amountInWords || "",
  }));

  // 2. Resumen consolidado de totales
  const totalIngresos = transactions
    .filter((t) => t.type === "income")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalEgresos = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const balance = totalIngresos - totalEgresos;

  const dataResumen = [
    { Indicador: "Total Ingresos Registrados", Monto: totalIngresos },
    { Indicador: "Total Gastos / Egresos", Monto: totalEgresos },
    { Indicador: "Balance Neto Disponible", Monto: balance },
    {
      Indicador: "Tasa de Ahorro Real",
      Monto:
        totalIngresos > 0
          ? `${((balance / totalIngresos) * 100).toFixed(2)}%`
          : "0.00%",
    },
    { Indicador: "Cantidad Total de Movimientos", Monto: transactions.length },
  ];

  // 3. Crear Workbook y hojas de trabajo
  const wb = XLSX.utils.book_new();

  // Hoja 1: Movimientos
  const wsMovimientos = XLSX.utils.json_to_sheet(dataMovimientos);
  // Autoajuste de anchos de columna
  wsMovimientos["!cols"] = [
    { wch: 5 },  // Nº
    { wch: 12 }, // Fecha
    { wch: 10 }, // Tipo
    { wch: 15 }, // Importe
    { wch: 8 },  // Moneda
    { wch: 28 }, // Contraparte
    { wch: 35 }, // Concepto
    { wch: 18 }, // Medio de Pago
    { wch: 20 }, // Nº Recibo
    { wch: 45 }, // Importe en Palabras
  ];

  // Hoja 2: Resumen Financiero
  const wsResumen = XLSX.utils.json_to_sheet(dataResumen);
  wsResumen["!cols"] = [{ wch: 35 }, { wch: 20 }];

  // Añadir hojas al libro
  XLSX.utils.book_append_sheet(wb, wsMovimientos, "Movimientos Consolidados");
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen y Balance");

  // 4. Descargar archivo en el navegador
  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `${fileName}_${dateStr}.xlsx`);
}

/**
 * Exporta el historial transaccional a formato CSV estándar
 */
export function exportTransactionsToCSV(
  transactions: Transaction[],
  fileName: string = "ViruCheck_Movimientos"
) {
  const data = transactions.map((t) => ({
    Fecha: t.date,
    Tipo: t.type === "income" ? "Ingreso" : "Egreso",
    Importe: t.amount,
    Moneda: t.currency,
    Contraparte: t.counterpartyName || "",
    Concepto: t.description,
    MedioPago: t.paymentMethod,
    Recibo: t.receiptNumber || "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const csvOutput = XLSX.utils.sheet_to_csv(ws);

  const blob = new Blob([csvOutput], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split("T")[0];

  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}