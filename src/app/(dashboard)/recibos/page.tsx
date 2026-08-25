/**
 * ============================================================================
 * MÓDULO PROFESIONAL DE RECIBOS Y PAGARÉS LEGALES (PARAGUAY) - VIRUCHECK
 * ============================================================================
 * - Recibos y Pagarés con secuencias y numeraciones totalmente independientes.
 * - Identificación visual clara con iconos y etiquetas exclusivas.
 * - Reversión automática del saldo al anular un recibo (afecta correctamente el Dashboard).
 * - Firma manual digital, descarga libre en PDF y anulación con tachado.
 * - Comentarios profesionales línea por línea.
 */

"use client";

import SyncMailModal from "@/components/SyncMailModal";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  MoneyReceipt,
  getNextReceiptNumber,
  createMoneyReceipt,
  getUserReceipts,
  markReceiptAsSigned,
  cancelReceipt,
} from "@/lib/firebase/receipts";
import { createTransaction } from "@/lib/firebase/transactions";
import { generateMoneyReceiptPDF } from "@/lib/utils/pdfReceipt";
import { formatCurrency } from "@/lib/utils/currency";
import { numeroALetrasGuaranies } from "@/lib/utils/numberToWords";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  PlusCircle,
  Eye,
  Download,
  CheckCircle2,
  Ban,
  Search,
  ShieldAlert,
  Sparkles,
  PenTool,
  RotateCcw,
  Scale,
  Lock
} from "lucide-react";

export default function RecibosPage() {
  const { user, profile } = useAuth();

  // Estados principales de datos y control de interfaz
  const [receipts, setReceipts] = useState<MoneyReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"recibo" | "pagare">("recibo"); // Tipo: Recibo o Pagaré
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "recibo" | "pagare">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "PENDIENTE" | "FIRMADO" | "ANULADO">("all");

  // Numeración correlativa independiente para Recibos (0000001) y Pagarés (PG-0000001)
  const [nextReceiptNumData, setNextReceiptNumData] = useState<{ formatted: string; nextNum: number }>({
    formatted: "0000001",
    nextNum: 1,
  });
  const [nextPromissoryNumData, setNextPromissoryNumData] = useState<{ formatted: string; nextNum: number }>({
    formatted: "PG-0000001",
    nextNum: 1,
  });

  // Campos del formulario
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30*24*60*60*1000).toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerRucCi, setPayerRucCi] = useState("");
  const [miniConcept, setMiniConcept] = useState("");
  const [observations, setObservations] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [saveAsIncome, setSaveAsIncome] = useState(true);

  // Referencia y estados para la firma manual digital en Canvas
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Estados para previsualización y anulación
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [selectedForCancel, setSelectedForCancel] = useState<MoneyReceipt | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Carga inicial de documentos y secuencias desde Firebase Firestore
   */
  const fetchReceipts = async () => {
    if (!user?.uid) return;
    try {
      const [list, nextRecNum] = await Promise.all([
        getUserReceipts(user.uid),
        getNextReceiptNumber(user.uid),
      ]);
      setReceipts(list);
      setNextReceiptNumData(nextRecNum);

      const pagaresList = list.filter(r => r.receiptNumber.startsWith("PG-"));
      const nextPgNum = pagaresList.length + 1;
      setNextPromissoryNumData({
        formatted: `PG-${String(nextPgNum).padStart(7, "0")}`,
        nextNum: nextPgNum,
      });
    } catch (err) {
      console.error("Error al cargar documentos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [user]);

  /**
   * Abre el modal limpio para emitir un nuevo Recibo o Pagaré
   */
  const handleOpenNew = async (type: "recibo" | "pagare" = "recibo") => {
    if (!user?.uid) return;
    
    if (type === "recibo") {
      const next = await getNextReceiptNumber(user.uid);
      setNextReceiptNumData(next);
    } else {
      const pagaresList = receipts.filter(r => r.receiptNumber.startsWith("PG-"));
      const nextPgNum = pagaresList.length + 1;
      setNextPromissoryNumData({
        formatted: `PG-${String(nextPgNum).padStart(7, "0")}`,
        nextNum: nextPgNum,
      });
    }

    setModalType(type);
    setAmount("");
    setPayerName("");
    setPayerRucCi("");
    setMiniConcept("");
    setObservations("");
    setChequeNumber("");
    setChequeBank("");
    setPreviewData(null);
    setShowModal(true);
    setTimeout(() => clearSignature(), 100);
  };

  // ==========================================
  // FUNCIONES DE FIRMA DIGITAL EN CANVAS
  // ==========================================
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const formattedReadableDate = useMemo(() => {
    try {
      const [y, m, d] = date.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return date;
    }
  }, [date]);

  const handleTriggerPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !payerName || !miniConcept) {
      alert("Por favor completa el monto, nombre y concepto.");
      return;
    }

    const currentFormattedNum = modalType === "pagare" ? nextPromissoryNumData.formatted : nextReceiptNumData.formatted;
    const signatureDataUrl = signatureCanvasRef.current ? signatureCanvasRef.current.toDataURL() : "";

    setPreviewData({
      receiptNumber: currentFormattedNum,
      rawNumber: modalType === "pagare" ? nextPromissoryNumData.nextNum : nextReceiptNumData.nextNum,
      type: modalType,
      date,
      dueDate,
      readableDate: formattedReadableDate,
      amount: parseFloat(amount),
      currency: "PYG",
      payerName,
      payerRucCi,
      receiverName: profile?.displayName || user?.displayName || "Beneficiario",
      concept: miniConcept,
      observations,
      paymentMethod,
      chequeNumber,
      chequeBank,
      signatureImage: signatureDataUrl,
      isNew: true,
    });
  };

  /**
   * Confirma y guarda el recibo o pagaré. Si es recibo, crea la transacción de ingreso.
   */
  const handleConfirmAndSave = async () => {
    if (!previewData || !user?.uid) return;

    setIsSubmitting(true);
    try {
      const finalConcept = previewData.type === "pagare" 
        ? `[PAGARÉ LEGAL] ${previewData.concept}` 
        : previewData.concept;

      await createMoneyReceipt({
        userId: user.uid,
        receiptNumber: previewData.receiptNumber,
        rawNumber: previewData.rawNumber || 1,
        date: previewData.date,
        amount: Number(previewData.amount),
        currency: "PYG",
        payerName: previewData.payerName,
        payerRucCi: previewData.payerRucCi || "XXX",
        receiverName: previewData.receiverName || "Beneficiario",
        concept: finalConcept,
        observations: previewData.observations || "",
        paymentMethod: previewData.paymentMethod || "transfer",
        paymentDetail: previewData.chequeNumber ? `Cheque N° ${previewData.chequeNumber} (${previewData.chequeBank})` : "",
      });

      if (saveAsIncome && previewData.type === "recibo") {
        try {
          await createTransaction({
            userId: user.uid,
            type: "income",
            amount: Number(previewData.amount),
            currency: "PYG",
            date: previewData.date,
            categoryId: "Ventas / Servicios",
            description: `Recibo N° ${previewData.receiptNumber}: ${previewData.concept}`,
            counterpartyName: previewData.payerName,
            receiptNumber: previewData.receiptNumber,
            paymentMethod: previewData.paymentMethod as any,
          });
        } catch (txErr) {
          console.warn("No se pudo duplicar en movimientos:", txErr);
        }
      }

      setPreviewData(null);
      setShowModal(false);
      await fetchReceipts();
      alert(`¡${previewData.type === "pagare" ? "Pagaré" : "Recibo"} guardado correctamente!`);
    } catch (err: any) {
      console.error(err);
      alert("Error al guardar: " + (err.message || "Verifica Firestore."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkSigned = async (r: MoneyReceipt) => {
    if (r.status === "ANULADO") return;
    try {
      await markReceiptAsSigned(r.id);
      await fetchReceipts();
    } catch (err) {
      console.error(err);
      alert("Error al actualizar firma.");
    }
  };

  /**
   * ANULACIÓN CON REVERSIÓN DE SALDO:
   * Al anular el recibo, crea automáticamente una transacción de gasto/ajuste por el mismo monto
   * para restar el ingreso duplicado y devolver el saldo exacto en el Dashboard.
   */
  const handleExecuteCancel = async () => {
    if (!selectedForCancel || !cancelReason || !user?.uid) return;
    try {
      // 1. Anular el documento en la colección de recibos
      await cancelReceipt(selectedForCancel.id, cancelReason);

      // 2. Revertir el impacto en el balance creando un egreso de ajuste por anulación
      await createTransaction({
        userId: user.uid,
        type: "expense",
        amount: Number(selectedForCancel.amount),
        currency: "PYG",
        date: new Date().toISOString().split("T")[0],
        categoryId: "Ajuste por Anulación",
        description: `[ANULACIÓN] Recibo N° ${selectedForCancel.receiptNumber} - Motivo: ${cancelReason}`,
        counterpartyName: selectedForCancel.payerName,
        paymentMethod: "transfer",
      });

      setSelectedForCancel(null);
      setCancelReason("");
      await fetchReceipts();
      alert("Documento anulado con éxito y saldo revertido en el Dashboard.");
    } catch (err) {
      console.error(err);
      alert("Error al anular y revertir saldo.");
    }
  };

  const filtered = receipts.filter((r) => {
    const isPagare = r.receiptNumber.startsWith("PG-") || r.concept?.includes("[PAGARÉ LEGAL]");
    
    if (typeFilter === "recibo" && isPagare) return false;
    if (typeFilter === "pagare" && !isPagare) return false;

    if (statusFilter !== "all" && r.status !== statusFilter) return false;

    const matchesSearch =
      r.receiptNumber.includes(searchTerm) ||
      r.payerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.concept.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-28 md:pb-12 px-4 sm:px-6 animate-in fade-in duration-300">
      
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-6 pt-2">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold tracking-wide uppercase shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> Módulo Legal y Comprobantes
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            Recibos y Pagarés Legales
          </h1>
          <p className="text-xs text-slate-400">
            Control independiente de recibos digitales y pagarés formales con numeración separada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => handleOpenNew("recibo")}
            className="h-11 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs gap-2 shadow-lg shadow-blue-600/25 transition-all"
          >
            <PlusCircle className="h-4 w-4" /> Emitir Recibo ({nextReceiptNumData.formatted})
          </Button>

          <Button
            onClick={() => handleOpenNew("pagare")}
            className="h-11 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white font-extrabold text-xs gap-2 shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Scale className="h-4 w-4" /> Emitir Pagaré Legal ({nextPromissoryNumData.formatted})
          </Button>
        </div>
      </div>

      {/* FILTROS Y BUSCADOR MODERNO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-xl">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Buscar por N°, pagador o concepto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 pl-10 rounded-2xl border-slate-800 bg-slate-950 text-xs text-slate-100 shadow-inner"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button onClick={() => setTypeFilter("all")} className={`px-3 py-1.5 text-[11px] font-bold rounded-xl transition-all ${typeFilter === "all" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}>Todos</button>
            <button onClick={() => setTypeFilter("recibo")} className={`px-3 py-1.5 text-[11px] font-bold rounded-xl transition-all ${typeFilter === "recibo" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}>Recibos</button>
            <button onClick={() => setTypeFilter("pagare")} className={`px-3 py-1.5 text-[11px] font-bold rounded-xl transition-all ${typeFilter === "pagare" ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}>Pagarés</button>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button onClick={() => setStatusFilter("all")} className={`px-2.5 py-1.5 text-[11px] font-bold rounded-xl transition-all ${statusFilter === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}>Estados</button>
            <button onClick={() => setStatusFilter("PENDIENTE")} className={`px-2.5 py-1.5 text-[11px] font-bold rounded-xl transition-all ${statusFilter === "PENDIENTE" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-white"}`}>Pendiente</button>
            <button onClick={() => setStatusFilter("FIRMADO")} className={`px-2.5 py-1.5 text-[11px] font-bold rounded-xl transition-all ${statusFilter === "FIRMADO" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"}`}>Firmado</button>
            <button onClick={() => setStatusFilter("ANULADO")} className={`px-2.5 py-1.5 text-[11px] font-bold rounded-xl transition-all ${statusFilter === "ANULADO" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"}`}>Anulado</button>
          </div>
        </div>
      </div>

      {/* MODAL DE EMISIÓN / PREVISUALIZACIÓN */}
      {(showModal || previewData) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl my-8 overflow-hidden flex flex-col max-h-[92vh]">
            
            <div className="border-b border-slate-800 bg-slate-950/80 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  {modalType === "pagare" ? <Scale className="h-5 w-5 text-purple-400" /> : <FileText className="h-5 w-5 text-blue-400" />}
                  {previewData ? `Previsualización de ${modalType === "pagare" ? "Pagaré Legal" : "Recibo"}` : `Emitir Nuevo ${modalType === "pagare" ? "Pagaré" : "Recibo"}`}
                </h3>
              </div>
              <span className={`font-mono text-xs font-bold px-3 py-1.5 rounded-xl border ${
                modalType === "pagare" ? "text-purple-400 bg-purple-500/10 border-purple-500/30" : "text-blue-400 bg-blue-500/10 border-blue-500/30"
              }`}>
                N° {previewData ? previewData.receiptNumber : (modalType === "pagare" ? nextPromissoryNumData.formatted : nextReceiptNumData.formatted)}
              </span>
            </div>

            {!previewData ? (
              <form onSubmit={handleTriggerPreview} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-bold">Fecha de Emisión</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs font-mono px-4" />
                    <p className="text-[10px] text-cyan-400 font-mono mt-1">📅 {formattedReadableDate}</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-bold">Monto en Guaraníes (PYG ₲) *</Label>
                    <Input type="text" inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ej: 1500000 (XXX)" className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-emerald-400 font-black text-base px-4 font-mono" />
                  </div>
                </div>

                {modalType === "pagare" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-purple-300 font-bold">Fecha de Vencimiento del Pagaré *</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="h-11 rounded-2xl border-purple-500/30 bg-slate-950 text-purple-200 text-xs font-mono px-4" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-bold">Nombre del Deudor / Pagador *</Label>
                    <Input placeholder="Ej: Juan Pérez (XXX)" value={payerName} onChange={(e) => setPayerName(e.target.value)} required className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-bold">Documento / C.I. / RUC</Label>
                    <Input placeholder="Ej: 1.234.567-8 (XXX)" value={payerRucCi} onChange={(e) => setPayerRucCi(e.target.value)} className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4 font-mono" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-bold">Forma de Pago</Label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full h-11 rounded-2xl border border-slate-800 bg-slate-950 px-4 text-xs text-slate-100 outline-none font-medium">
                      <option value="transfer">Transferencia Bancaria</option>
                      <option value="cash">Efectivo</option>
                      <option value="cheque">Cheque (XXX)</option>
                      <option value="billetera">Billetera Digital</option>
                    </select>
                  </div>

                  {paymentMethod === "cheque" && (
                    <div className="space-y-3 p-4 rounded-2xl border border-amber-500/30 bg-amber-950/20">
                      <Label className="text-xs text-amber-300 font-bold">Datos del Cheque (Opcionales)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="N° de Cheque (XXX)" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} className="h-9 rounded-xl border-slate-800 bg-slate-950 text-xs" />
                        <Input placeholder="Banco Emisor (XXX)" value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} className="h-9 rounded-xl border-slate-800 bg-slate-950 text-xs" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Mini Concepto / Motivo *</Label>
                  <Input placeholder="Ej: Préstamo personal / Servicios de consultoría (XXX)" value={miniConcept} onChange={(e) => setMiniConcept(e.target.value)} required className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-slate-100 text-xs px-4" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Observación</Label>
                  <textarea rows={2} placeholder="Notas complementarias... (XXX)" value={observations} onChange={(e) => setObservations(e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-100 outline-none resize-none font-medium" />
                </div>

                {/* FIRMA DIGITAL */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
                      <PenTool className="h-3.5 w-3.5 text-cyan-400" /> Firma Manual Digital
                    </Label>
                    <Button type="button" size="sm" variant="ghost" onClick={clearSignature} className="h-7 px-2 text-rose-400 text-[11px] gap-1">
                      <RotateCcw className="h-3 w-3" /> Limpiar
                    </Button>
                  </div>
                  <div className="relative rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden flex justify-center p-2">
                    <canvas ref={signatureCanvasRef} width={500} height={120} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className="cursor-crosshair bg-slate-900/60 rounded-xl border border-dashed border-slate-700 w-full touch-none" />
                  </div>
                </div>

                {modalType === "recibo" && (
                  <div className="flex items-center gap-2 pt-1">
                    <input type="checkbox" id="saveIncomeCheck" checked={saveAsIncome} onChange={(e) => setSaveAsIncome(e.target.checked)} className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-blue-600 cursor-pointer" />
                    <Label htmlFor="saveIncomeCheck" className="text-xs text-slate-300 cursor-pointer">Registrar también como movimiento de ingreso en el Dashboard</Label>
                  </div>
                )}

                <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="rounded-xl border-slate-700 text-xs text-slate-300 h-10 px-4">Cancelar</Button>
                  <Button type="submit" className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 font-bold text-xs text-white h-10 px-6 gap-2">
                    <Eye className="h-4 w-4" /> Previsualizar Documento
                  </Button>
                </div>
              </form>
            ) : (
              /* PREVISUALIZACIÓN DE DOCUMENTO */
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="rounded-2xl border border-slate-700 bg-slate-950 p-6 text-slate-200 shadow-2xl space-y-5">
                  <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="font-black text-base text-white tracking-wide uppercase">
                        {previewData.type === "pagare" ? "Pagaré a la Orden (Ley Paraguaya)" : "Comprobante de Recepción de Dinero"}
                      </h3>
                      <p className="text-[10px] text-cyan-400 font-mono mt-0.5">DOCUMENTO LEGAL VERIFICADO</p>
                    </div>
                    <span className={`font-mono text-sm font-bold px-3 py-1.5 rounded-xl border ${
                      previewData.type === "pagare" ? "text-purple-400 bg-purple-500/10 border-purple-500/30" : "text-blue-400 bg-blue-500/10 border-blue-500/30"
                    }`}>
                      N° {previewData.receiptNumber}
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase">Monto Total:</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">
                      {formatCurrency(previewData.amount, "PYG")}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs leading-relaxed">
                    {previewData.type === "pagare" ? (
                      <p className="text-slate-300 leading-relaxed text-justify">
                        Debo y pagaré sin protesto a la orden de <strong className="text-white">{previewData.receiverName}</strong>, en la ciudad de Asunción, República del Paraguay, el día <strong className="text-cyan-300">{previewData.dueDate}</strong>, la cantidad de <strong className="text-emerald-300">{formatCurrency(previewData.amount, "PYG")}</strong> ({numeroALetrasGuaranies(previewData.amount)}). Valor recibido a mi entera satisfacción en concepto de: <strong className="text-white">{previewData.concept}</strong>.
                      </p>
                    ) : (
                      <>
                        <p><strong className="text-slate-400">Recibí(mos) de:</strong> <span className="text-slate-100 font-semibold">{previewData.payerName}</span></p>
                        <p><strong className="text-slate-400">Monto en letras:</strong> <span className="text-slate-200 font-medium italic">{numeroALetrasGuaranies(previewData.amount)}</span></p>
                        <p><strong className="text-slate-400">Concepto:</strong> <span className="text-slate-100">{previewData.concept}</span></p>
                      </>
                    )}

                    {previewData.observations && (
                      <p><strong className="text-slate-400">Observaciones:</strong> {previewData.observations}</p>
                    )}
                  </div>

                  <div className="pt-6 flex justify-end">
                    <div className="text-center border-t border-slate-700 pt-2 w-52">
                      {previewData.signatureImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previewData.signatureImage} alt="Firma" className="h-12 mx-auto object-contain filter invert opacity-90" />
                      )}
                      <p className="text-xs font-bold text-slate-100 mt-1">{previewData.payerName}</p>
                      <p className="text-[10px] text-slate-500">Deudor / Firmante</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button variant="outline" onClick={() => setPreviewData(null)} className="rounded-xl border-slate-700 text-xs text-slate-300 h-10 px-4">Modificar</Button>
                  <Button onClick={handleConfirmAndSave} disabled={isSubmitting} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white h-10 px-6 gap-2">
                    <CheckCircle2 className="h-4 w-4" /> {isSubmitting ? "Guardando..." : "Confirmar y Guardar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL ANULACIÓN */}
      {selectedForCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in zoom-in-95">
          <div className="w-full max-w-md rounded-3xl border border-red-500/30 bg-slate-900 p-7 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-red-400 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> Anular Documento N° {selectedForCancel.receiptNumber}
            </h3>
            <Input placeholder="Motivo de anulación" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="h-11 rounded-2xl border-slate-800 bg-slate-950 text-xs px-4" />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setSelectedForCancel(null)} className="rounded-xl border-slate-700 text-xs h-10 px-4">Cancelar</Button>
              <Button onClick={handleExecuteCancel} disabled={!cancelReason} className="rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold h-10 px-5">Confirmar Anulación y Revertir Saldo</Button>
            </div>
          </div>
        </div>
      )}

      {/* LISTADO GENERAL DE RECIBOS Y PAGARÉS */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-2xl shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100">Registro General de Recibos y Pagarés</h3>
            <p className="text-[11px] text-slate-400">{filtered.length} documentos encontrados</p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Cargando registros...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No hay documentos en esta sección.</div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filtered.map((r) => {
              const isCanceled = r.status === "ANULADO";
              const isSigned = r.status === "FIRMADO" || r.isSigned;
              const isPagare = r.receiptNumber.startsWith("PG-") || r.concept?.includes("[PAGARÉ LEGAL]");

              return (
                <div key={r.id} className={`flex items-center justify-between py-4 text-xs hover:bg-slate-950/60 px-3 rounded-2xl transition-all ${isCanceled ? "opacity-60 bg-red-950/10" : ""}`}>
                  <div className="flex items-center gap-3.5">
                    
                    {/* ICONO Y COLOR DISTINTIVO */}
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl font-mono font-bold text-xs shadow-inner ${
                      isCanceled ? "bg-red-500/10 text-red-400 border border-red-500/20" : isPagare ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    }`}>
                      {isPagare ? <Scale className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </div>

                    <div className="space-y-0.5 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold text-sm ${isCanceled ? "line-through text-slate-500" : "text-slate-100"}`}>
                          N° {r.receiptNumber}
                        </span>
                        
                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold border ${
                          isPagare ? "bg-purple-950/50 text-purple-300 border-purple-800" : "bg-blue-950/50 text-blue-300 border-blue-800"
                        }`}>
                          {isPagare ? "PAGARÉ LEGAL" : "RECIBO"}
                        </span>

                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold border ${
                          isCanceled ? "bg-red-950/50 text-red-400 border-red-800" : isSigned ? "bg-emerald-950/50 text-emerald-400 border-emerald-800" : "bg-amber-950/50 text-amber-400 border-amber-800"
                        }`}>
                          {r.status}
                        </span>
                      </div>
                      <p className={`font-medium truncate ${isCanceled ? "line-through text-slate-500" : "text-slate-300"}`}>
                        {r.payerName} • {r.concept.replace("[PAGARÉ LEGAL] ", "")}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {r.date} {r.cancelReason && ` • Motivo Anulación: ${r.cancelReason}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* MONTO TACHADO SI ESTÁ ANULADO */}
                    <span className={`font-mono font-black text-base ${isCanceled ? "line-through text-red-400/70" : "text-emerald-400"}`}>
                      {formatCurrency(r.amount, r.currency)}
                    </span>

                    <Button size="icon" variant="ghost" onClick={() => setPreviewData(r)} className="h-9 w-9 text-slate-400 hover:text-blue-400 rounded-xl" title="Ver detalle">
                      <Eye className="h-4 w-4" />
                    </Button>

                    <Button size="icon" variant="ghost" onClick={() => generateMoneyReceiptPDF(r)} className="h-9 w-9 text-slate-400 hover:text-emerald-400 rounded-xl" title="Descargar PDF">
                      <Download className="h-4 w-4" />
                    </Button>

                    {!isCanceled && !isSigned && (
                      <Button size="sm" variant="outline" onClick={() => handleMarkSigned(r)} className="rounded-xl border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-[11px] h-9 font-bold gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Firmar
                      </Button>
                    )}

                    {isSigned && (
                      <span className="h-9 w-9 flex items-center justify-center text-blue-400" title="Firmado">
                        <Lock className="h-4 w-4" />
                      </span>
                    )}

                    {!isCanceled && (
                      <Button size="icon" variant="ghost" onClick={() => setSelectedForCancel(r)} className="h-9 w-9 text-slate-500 hover:text-red-400 rounded-xl" title="Anular y Revertir Saldo">
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}