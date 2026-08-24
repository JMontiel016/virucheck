"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createTransaction } from "@/lib/firebase/transactions";
import { DEFAULT_CATEGORIES } from "@/lib/utils/categories";
import { formatCurrency } from "@/lib/utils/currency";
import { Currency, PaymentMethod } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Upload,
  FileCheck2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Receipt,
  ScanLine,
} from "lucide-react";

export default function OcrPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Manejar selección de imagen
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setExtractedData(null);
      setSavedSuccess(false);
      setErrorMessage("");
    }
  };

  // Enviar a la IA para extracción OCR
  const handleScanReceipt = async () => {
    if (!file) return;

    setIsScanning(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Error al escanear la factura.");
      }

      setExtractedData(json.data);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "No se pudo procesar la imagen con Gemini AI.");
    } finally {
      setIsScanning(false);
    }
  };

  // Guardar en la base de datos de movimientos
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !extractedData) return;

    setIsSaving(true);
    try {
      await createTransaction({
        userId: user.uid,
        type: "expense",
        amount: parseFloat(extractedData.totalAmount),
        currency: (extractedData.currency as Currency) || "PYG",
        date: extractedData.date || new Date().toISOString().split("T")[0],
        categoryId: extractedData.suggestedCategory || "general",
        description: `${extractedData.merchantName || "Compra"} - ${extractedData.description || "Gasto"}`,
        counterpartyName: extractedData.merchantName || "Comercio",
        paymentMethod: "cash",
      });

      setSavedSuccess(true);
    } catch (err) {
      console.error("Error al guardar transacción:", err);
      alert("Hubo un fallo al registrar la transacción.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-blue-400" />
          Escáner OCR de Facturas con IA
        </h1>
        <p className="text-xs text-slate-400">
          Sube tickets o facturas fiscales paraguayas y Gemini AI extraerá automáticamente montos, IVA y contrapartes.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Columna Izquierda: Carga y Vista Previa */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base text-slate-100">Cargar Comprobante</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Formatos aceptados: JPG, PNG, WEBP de fotos o capturas de KuDE
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/40 p-6 text-center hover:border-blue-500/50 transition-colors">
              {previewUrl ? (
                <div className="space-y-3">
                  <img
                    src={previewUrl}
                    alt="Vista previa del comprobante"
                    className="max-h-72 w-auto rounded-lg object-contain mx-auto shadow-md"
                  />
                  <p className="text-xs text-slate-400 font-mono">{file?.name}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 text-slate-500 mx-auto" />
                  <p className="text-sm font-medium text-slate-300">
                    Arrastra una foto o haz clic para seleccionarla
                  </p>
                  <p className="text-xs text-slate-500">Tickets de supermercado, combustible, farmacia...</p>
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="mt-4 text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-500 cursor-pointer"
              />
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-xs text-red-400 border border-red-500/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button
              onClick={handleScanReceipt}
              disabled={!file || isScanning}
              className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold hover:from-blue-500 hover:to-indigo-500"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gemini está analizando la factura...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  Escanear Comprobante con Gemini AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Columna Derecha: Resultado y Formulario de Confirmación */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base text-slate-100 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-400" />
              Datos Extraídos y Validación
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Verifica los datos extraídos por la IA antes de registrarlos en tu contabilidad
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!extractedData ? (
              <div className="py-16 text-center text-xs text-slate-500">
                Sube una imagen y pulsa en "Escanear Comprobante" para ver los datos extraídos.
              </div>
            ) : savedSuccess ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                <h3 className="text-base font-bold text-emerald-300">¡Gasto Registrado con Éxito!</h3>
                <p className="text-xs text-slate-300">
                  La transacción y su desglose ya están en tu historial contable y presupuestos.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    setExtractedData(null);
                    setSavedSuccess(false);
                  }}
                  className="mt-2 text-xs border-slate-700 bg-slate-900 text-slate-200"
                >
                  Escanear otro comprobante
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSaveTransaction} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">Razón Social / Comercio</Label>
                    <Input
                      value={extractedData.merchantName || ""}
                      onChange={(e) => setExtractedData({ ...extractedData, merchantName: e.target.value })}
                      required
                      className="border-slate-800 bg-slate-950 text-slate-100 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">RUC</Label>
                    <Input
                      value={extractedData.ruc || ""}
                      onChange={(e) => setExtractedData({ ...extractedData, ruc: e.target.value })}
                      className="border-slate-800 bg-slate-950 text-slate-100 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">Importe Total</Label>
                    <Input
                      type="number"
                      step="any"
                      value={extractedData.totalAmount || ""}
                      onChange={(e) => setExtractedData({ ...extractedData, totalAmount: e.target.value })}
                      required
                      className="border-slate-800 bg-slate-950 text-slate-100 font-bold text-emerald-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">Moneda</Label>
                    <select
                      value={extractedData.currency || "PYG"}
                      onChange={(e) => setExtractedData({ ...extractedData, currency: e.target.value })}
                      className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100"
                    >
                      <option value="PYG">PYG (Guaraníes)</option>
                      <option value="USD">USD (Dólares)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">Fecha de Emisión</Label>
                    <Input
                      type="date"
                      value={extractedData.date || ""}
                      onChange={(e) => setExtractedData({ ...extractedData, date: e.target.value })}
                      required
                      className="border-slate-800 bg-slate-950 text-slate-100 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">Categoría Sugerida</Label>
                    <select
                      value={extractedData.suggestedCategory || "general"}
                      onChange={(e) => setExtractedData({ ...extractedData, suggestedCategory: e.target.value })}
                      className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100"
                    >
                      {DEFAULT_CATEGORIES.filter((c) => c.type === "expense").map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Detalle / Concepto</Label>
                  <Input
                    value={extractedData.description || ""}
                    onChange={(e) => setExtractedData({ ...extractedData, description: e.target.value })}
                    required
                    className="border-slate-800 bg-slate-950 text-slate-100 text-xs"
                  />
                </div>

                {/* Desglose de Liquidación de IVA */}
                <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3 space-y-1 text-xs">
                  <span className="font-semibold text-slate-400">Liquidación Fiscal (SET / DNIT):</span>
                  <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-slate-300">
                    <div>IVA 10%: {formatCurrency(extractedData.iva10 || 0, extractedData.currency || "PYG")}</div>
                    <div>IVA 5%: {formatCurrency(extractedData.iva5 || 0, extractedData.currency || "PYG")}</div>
                    <div>Exentas: {formatCurrency(extractedData.exentas || 0, extractedData.currency || "PYG")}</div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSaving}
                  className="w-full gap-2 bg-emerald-600 font-semibold hover:bg-emerald-500 text-white"
                >
                  <FileCheck2 className="h-4 w-4" />
                  {isSaving ? "Guardando..." : "Confirmar y Registrar en Movimientos"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}