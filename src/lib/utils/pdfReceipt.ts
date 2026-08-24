import { formatCurrency } from "./currency";
import { numeroALetrasGuaranies } from "./numberToWords";
import { Transaction } from "@/types";

export interface ReceiptData {
  receiptNumber?: string;
  date: string;
  amount: number;
  currency: "PYG" | "USD";
  payerName: string;
  payerRucCi?: string;
  receiverName?: string;
  receiverRucCi?: string;
  concept: string;
  observations?: string;
  paymentMethod: string;
  paymentDetail?: string; // N° de Cheque, Banco, N° Transferencia
}

export async function generateMoneyReceiptPDF(data: ReceiptData) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const receiptNum = data.receiptNumber || `001-${String(Date.now()).slice(-4)}`;
  const amountInWords = numeroALetrasGuaranies(data.amount);
  const formattedAmount = formatCurrency(data.amount, data.currency);

  // Marco exterior (Estilo KuDE)
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.7);
  doc.roundedRect(12, 12, 186, 145, 2, 2);

  // Encabezado
  doc.setFillColor(15, 23, 42);
  doc.rect(12, 12, 186, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("COMPROBANTE OFICIAL DE RECEPCIÓN DE DINERO", 18, 22);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("RESPALDO CIVIL - REPÚBLICA DEL PARAGUAY", 18, 28);

  // N° de Recibo (7 dígitos)
  doc.setFont("courier", "bold");
  doc.setFontSize(13);
  doc.text(`N° ${receiptNum}`, 148, 25);

  // Recuadro de Monto Destacado
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(18, 38, 174, 12, 1.5, 1.5, "FD");

  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("IMPORTE RECIBIDO:", 22, 45.5);

  doc.setTextColor(13, 148, 136);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(formattedAmount, 68, 46);

  // Desglose de Datos
  let y = 58;
  doc.setTextColor(15, 23, 42);

  // Pagador
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Recibí(mos) de:", 18, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.payerName} ${data.payerRucCi ? `— CI / RUC: ${data.payerRucCi}` : ""}`, 52, y);

  // Cantidad en Letras
  y += 9;
  doc.setFont("helvetica", "bold");
  doc.text("La suma de:", 18, y);
  doc.setFont("helvetica", "italic");
  doc.text(amountInWords, 52, y, { maxWidth: 140 });

  // Concepto (Soporta multilínea amplia)
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.text("En concepto de:", 18, y);
  doc.setFont("helvetica", "normal");
  const splitConcept = doc.splitTextToSize(data.concept, 140);
  doc.text(splitConcept, 52, y);
  y += splitConcept.length * 4.5 + 4;

  // Observaciones / Otros (si existen)
  if (data.observations) {
    doc.setFont("helvetica", "bold");
    doc.text("Otros / Notas:", 18, y);
    doc.setFont("helvetica", "normal");
    const splitObs = doc.splitTextToSize(data.observations, 140);
    doc.text(splitObs, 52, y);
    y += splitObs.length * 4.5 + 4;
  }

  // Forma de Pago y Fecha
  doc.setFillColor(248, 250, 252);
  doc.rect(18, y, 174, 14, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(18, y, 174, 14, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Forma de Pago:", 22, y + 6);
  doc.setFont("helvetica", "normal");
  const payInfo = `${data.paymentMethod.toUpperCase()}${data.paymentDetail ? ` (${data.paymentDetail})` : ""}`;
  doc.text(payInfo, 52, y + 6);

  doc.setFont("helvetica", "bold");
  doc.text("Fecha Emisión:", 120, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text(data.date, 148, y + 6);

  // Marco Legal inferior
  y += 22;
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Constancia civil emitida conforme a la legislación vigente de la República del Paraguay. Válido como instrumento privado de cancelación y prueba de pago.",
    18,
    y,
    { maxWidth: 174 }
  );

  // Línea de Firma
  y += 18;
  doc.setLineWidth(0.4);
  doc.setDrawColor(100, 116, 139);
  doc.line(115, y, 182, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.receiverName || "Beneficiario", 148, y + 4.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Firma y Aclaración del Receptor", 148, y + 8, { align: "center" });

  doc.save(`Recibo-${receiptNum}.pdf`);
}

export async function generatePDFReceipt(tx: Transaction, userName?: string) {
  await generateMoneyReceiptPDF({
    receiptNumber: tx.receiptNumber || `001-${String(Date.now()).slice(-4)}`,
    date: tx.date,
    amount: tx.amount,
    currency: tx.currency,
    payerName: tx.counterpartyName || "Cliente / Pagador",
    receiverName: userName || "Beneficiario",
    concept: tx.description || "Transacción registrada",
    paymentMethod: tx.paymentMethod || "transfer",
  });
}