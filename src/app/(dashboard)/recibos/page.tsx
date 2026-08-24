"use client";

import React, { useEffect, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Lock,
  Search,
  ShieldAlert,
  Edit3,
  X,
} from "lucide-react";

export default function RecibosPage() {
  const { user, profile } = useAuth();

  const [receipts, setReceipts] = useState<MoneyReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [nextNumberData, setNextNumberData] = useState<{ formatted: string; nextNum: number }>({
    formatted: "0000001",
    nextNum: 1,
  });
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerRucCi, setPayerRucCi] = useState("");
  const [concept, setConcept] = useState("");
  const [observations, setObservations] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [paymentDetail, setPaymentDetail] = useState("");
  const [saveAsIncome, setSaveAsIncome] = useState(true);

  // Estados de Previsualización y Anulación
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [selectedForCancel, setSelectedForCancel] = useState<MoneyReceipt | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReceipts = async () => {
    if (!user?.uid) return;
    try {
      const [list, nextNum] = await Promise.all([
        getUserReceipts(user.uid),
        getNextReceiptNumber(user.uid),
      ]);
      setReceipts(list);
      setNextNumberData(nextNum);
    } catch (err) {
      console.error("Error al cargar recibos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [user]);

  const handleOpenNew = async () => {
    if (!user?.uid) return;
    const next = await getNextReceiptNumber(user.uid);
    setNextNumberData(next);
    setAmount("");
    setPayerName("");
    setPayerRucCi("");
    setConcept("");
    setObservations("");
    setPaymentDetail("");
    setPreviewData(null);
    setShowModal(true);
  };

  const handleTriggerPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !payerName || !concept) {
      alert("Por favor completa los campos requeridos.");
      return;
    }

    setPreviewData({
      receiptNumber: nextNumberData.formatted,
      rawNumber: nextNumberData.nextNum,
      date,
      amount: parseFloat(amount),
      currency: "PYG",
      payerName,
      payerRucCi,
      receiverName: profile?.displayName || user?.displayName || "Beneficiario",
      concept,
      observations,
      paymentMethod,
      paymentDetail,
      isNew: true,
    });
  };

  const handleConfirmAndSave = async () => {
    if (!previewData || !user?.uid) {
      alert("No hay datos para guardar.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createMoneyReceipt({
        userId: user.uid,
        receiptNumber: previewData.receiptNumber,
        rawNumber: previewData.rawNumber || 1,
        date: previewData.date,
        amount: Number(previewData.amount),
        currency: "PYG",
        payerName: previewData.payerName,
        payerRucCi: previewData.payerRucCi || "",
        receiverName: previewData.receiverName || "Beneficiario",
        concept: previewData.concept,
        observations: previewData.observations || "",
        paymentMethod: previewData.paymentMethod || "transfer",
        paymentDetail: previewData.paymentDetail || "",
      });

      if (saveAsIncome) {
        try {
          await createTransaction({
            userId: user.uid,
            type: "income",
            amount: Number(previewData.amount),
            currency: "PYG",
            date: previewData.date,
            categoryId: "salario",
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
      alert(`Recibo N° ${previewData.receiptNumber} guardado correctamente en la lista.`);
    } catch (err: any) {
      console.error("Error al guardar recibo:", err);
      alert("Error al guardar: " + (err.message || "Verifica los permisos en Firestore."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkSigned = async (r: MoneyReceipt) => {
    if (r.isSigned) return;
    if (
      !confirm(
        `¿Confirmas que el Recibo N° ${r.receiptNumber} ya fue firmado? Una vez firmado se bloqueará la descarga del original en blanco.`
      )
    )
      return;

    try {
      await markReceiptAsSigned(r.id);
      await fetchReceipts();
    } catch (err) {
      console.error(err);
      alert("Error al actualizar el estado a firmado.");
    }
  };

  const handleExecuteCancel = async () => {
    if (!selectedForCancel || !cancelReason) return;

    try {
      await cancelReceipt(selectedForCancel.id, cancelReason);
      setSelectedForCancel(null);
      setCancelReason("");
      await fetchReceipts();
    } catch (err) {
      console.error(err);
      alert("Error al anular el recibo.");
    }
  };

  const filtered = receipts.filter(
    (r) =>
      r.receiptNumber.includes(searchTerm) ||
      r.payerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.concept.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-400" />
            Recibos de Dinero
          </h1>
          <p className="text-xs text-slate-400">
            Numeración correlativa de 7 dígitos con control de estado y descarga
          </p>
        </div>
        <Button
          onClick={handleOpenNew}
          className="gap-2 bg-blue-600 font-semibold hover:bg-blue-500 text-white"
        >
          <PlusCircle className="h-4 w-4" />
          Emitir Recibo ({nextNumberData.formatted})
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
        <Input
          placeholder="Buscar por N° 0000001, pagador o concepto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-slate-800 bg-slate-900/60 pl-9 text-xs text-slate-200"
        />
      </div>

      {/* MODAL 1: FORMULARIO Y PREVISUALIZACIÓN */}
      {(showModal || previewData) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <Card className="w-full max-w-2xl border-slate-800 bg-slate-900 shadow-2xl my-8">
            <CardHeader className="border-b border-slate-800 pb-3">
              <CardTitle className="text-lg text-slate-100 flex items-center justify-between">
                <span>{previewData ? "Previsualización del Recibo" : "Nuevo Recibo de Dinero"}</span>
                <span className="font-mono text-sm text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/20">
                  N° {previewData ? previewData.receiptNumber : nextNumberData.formatted}
                </span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                {previewData
                  ? "Revisa los detalles del comprobante emitido"
                  : "Ingresa los detalles correspondientes al pago"}
              </CardDescription>
            </CardHeader>

            {!previewData ? (
              <form onSubmit={handleTriggerPreview}>
                <CardContent className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300">Fecha de Emisión</Label>
                      <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                        className="border-slate-800 bg-slate-950 text-slate-100 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300">Monto en Guaraníes (PYG ₲)</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        className="border-slate-800 bg-slate-950 text-emerald-400 font-bold text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300">Recibí de (Nombre / Entidad)</Label>
                      <Input
                        placeholder="Nombre de quien entrega el monto"
                        value={payerName}
                        onChange={(e) => setPayerName(e.target.value)}
                        required
                        className="border-slate-800 bg-slate-950 text-slate-100 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300">C.I. / RUC (Opcional)</Label>
                      <Input
                        placeholder="Documento de identidad"
                        value={payerRucCi}
                        onChange={(e) => setPayerRucCi(e.target.value)}
                        className="border-slate-800 bg-slate-950 text-slate-100 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300">Método de Pago</Label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100"
                      >
                        <option value="transfer">Transferencia Bancaria</option>
                        <option value="cash">Efectivo</option>
                        <option value="cheque">Cheque</option>
                        <option value="debit_card">Tarjeta de Débito</option>
                        <option value="credit_card">Tarjeta de Crédito</option>
                        <option value="billetera">Billetera Digital</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300">Detalles / N° Comprobante / Banco</Label>
                      <Input
                        placeholder="Referencia adicional"
                        value={paymentDetail}
                        onChange={(e) => setPaymentDetail(e.target.value)}
                        className="border-slate-800 bg-slate-950 text-slate-100 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">En Concepto de</Label>
                    <textarea
                      rows={3}
                      placeholder="Motivo o detalle del pago"
                      value={concept}
                      onChange={(e) => setConcept(e.target.value)}
                      required
                      className="w-full rounded-md border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Observaciones Adicionales</Label>
                    <textarea
                      rows={2}
                      placeholder="Notas complementarias (opcional)"
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      className="w-full rounded-md border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="saveIncomeCheck"
                      checked={saveAsIncome}
                      onChange={(e) => setSaveAsIncome(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-blue-600"
                    />
                    <Label htmlFor="saveIncomeCheck" className="text-xs text-slate-300 cursor-pointer">
                      Registrar también como movimiento de ingreso
                    </Label>
                  </div>
                </CardContent>

                <div className="flex justify-end gap-2 border-t border-slate-800 p-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                    className="border-slate-700 text-xs text-slate-300"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 gap-1.5">
                    <Eye className="h-4 w-4" />
                    Previsualizar Recibo
                  </Button>
                </div>
              </form>
            ) : (
              /* PREVISUALIZACIÓN VISUAL DEL RECIBO */
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-6 text-slate-200 shadow-2xl space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="font-bold text-base text-white tracking-wide">
                        COMPROBANTE DE RECEPCIÓN DE DINERO
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono">DOCUMENTO DE RESPALDO</p>
                    </div>
                    <span className="font-mono text-base font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded border border-blue-500/30">
                      N° {previewData.receiptNumber}
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase">Monto Total:</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      {formatCurrency(previewData.amount, "PYG")}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs leading-relaxed">
                    <p>
                      <strong className="text-slate-400">Recibí(mos) de:</strong>{" "}
                      <span className="text-slate-100 font-semibold">{previewData.payerName}</span>{" "}
                      {previewData.payerRucCi && (
                        <span className="font-mono text-slate-400">({previewData.payerRucCi})</span>
                      )}
                    </p>
                    <p>
                      <strong className="text-slate-400">Monto en letras:</strong>{" "}
                      <span className="text-slate-100 font-medium italic">
                        {numeroALetrasGuaranies(previewData.amount)}
                      </span>
                    </p>
                    <div>
                      <strong className="text-slate-400">En concepto de:</strong>
                      <p className="mt-1 text-slate-100 bg-slate-900/50 p-2.5 rounded border border-slate-800/80 whitespace-pre-line">
                        {previewData.concept}
                      </p>
                    </div>

                    {previewData.observations && (
                      <div>
                        <strong className="text-slate-400">Observaciones:</strong>
                        <p className="mt-1 text-slate-300 bg-slate-900/30 p-2 rounded border border-slate-800/50 whitespace-pre-line">
                          {previewData.observations}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 pt-2 text-[11px] text-slate-400 border-t border-slate-800/80">
                      <div>
                        <span className="font-bold text-slate-300">Forma de Pago:</span>{" "}
                        {previewData.paymentMethod?.toUpperCase()}
                        {previewData.paymentDetail && ` (${previewData.paymentDetail})`}
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-300">Fecha:</span> {previewData.date}
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 flex justify-end">
                    <div className="text-center border-t border-slate-700 pt-2 w-52">
                      <p className="text-xs font-bold text-slate-100">{previewData.receiverName}</p>
                      <p className="text-[10px] text-slate-500">Firma y Aclaración</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  {previewData.isNew ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setPreviewData(null)}
                        className="border-slate-700 text-xs text-slate-300 gap-1.5"
                      >
                        <Edit3 className="h-4 w-4" />
                        Modificar
                      </Button>
                      <Button
                        onClick={handleConfirmAndSave}
                        disabled={isSubmitting}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {isSubmitting ? "Guardando..." : "Confirmar y Guardar"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPreviewData(null);
                        setShowModal(false);
                      }}
                      className="w-full border-slate-700 text-xs text-slate-300"
                    >
                      Cerrar Vista
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {selectedForCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md border-red-500/30 bg-slate-900 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-base text-red-400 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Anular Recibo N° {selectedForCancel.receiptNumber}
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                El recibo quedará anulado permanentemente en el registro.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">Motivo de Anulación</Label>
                <Input
                  placeholder="Detalla el motivo"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="border-slate-800 bg-slate-950 text-slate-100 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedForCancel(null)}
                  className="border-slate-700 text-xs text-slate-300"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleExecuteCancel}
                  disabled={!cancelReason}
                  className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
                >
                  Confirmar Anulación
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-100">Registro de Recibos Emitidos</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            {filtered.length} recibos en total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Cargando recibos...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No hay recibos registrados aún. Presiona <strong>Emitir Recibo</strong> para generar uno.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {filtered.map((r) => {
                const isCanceled = r.status === "ANULADO";
                const isSigned = r.status === "FIRMADO" || r.isSigned;

                return (
                  <div key={r.id} className="flex items-center justify-between py-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg font-mono font-bold text-xs ${
                          isCanceled
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : isSigned
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        N° {r.receiptNumber.slice(-3)}
                      </div>
                      <div className="space-y-0.5 max-w-md">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-100 text-sm">
                            N° {r.receiptNumber}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              isCanceled
                                ? "bg-red-950 text-red-400 border border-red-800"
                                : isSigned
                                ? "bg-blue-950 text-blue-400 border border-blue-800"
                                : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            }`}
                          >
                            {r.status}
                          </span>
                        </div>
                        <p className="text-slate-300 font-medium truncate">
                          {r.payerName} • {r.concept}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {r.date} • {r.paymentMethod.toUpperCase()}
                          {r.cancelReason && ` • Motivo Anulación: ${r.cancelReason}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono font-bold text-sm ${
                          isCanceled ? "line-through text-slate-500" : "text-emerald-400"
                        }`}
                      >
                        {formatCurrency(r.amount, r.currency)}
                      </span>

                      {/* Botón Ojo: Previsualiza el recibo en pantalla */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setPreviewData(r)}
                        className="h-8 w-8 text-slate-400 hover:text-blue-400"
                        title="Ver detalle del recibo"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {!isCanceled && !isSigned ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => generateMoneyReceiptPDF(r)}
                          className="h-8 w-8 text-slate-400 hover:text-emerald-400"
                          title="Descargar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span
                          className="h-8 w-8 flex items-center justify-center text-slate-600"
                          title={isSigned ? "Recibo firmado (Descarga bloqueada)" : "Recibo Anulado"}
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      )}

                      {!isCanceled && !isSigned && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkSigned(r)}
                          className="gap-1 border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-[11px] h-8"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Marcar Firmado
                        </Button>
                      )}

                      {!isCanceled && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setSelectedForCancel(r)}
                          className="h-8 w-8 text-slate-500 hover:text-red-400"
                          title="Anular Recibo"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}