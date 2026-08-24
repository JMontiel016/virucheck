"use client";
import React, { useState } from "react";

interface MailSyncModalProps {
  userEmail: string;
  onTransactionsLoaded: (items: any[]) => void;
}

export default function MailSyncModal({ userEmail, onTransactionsLoaded }: MailSyncModalProps) {
  const [loading, setLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sync-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await res.json();
      if (data.success && data.transactions.length > 0) {
        onTransactionsLoaded(data.transactions);
        setShowPrompt(false);
      } else {
        alert("No se encontraron comprobantes o facturas pendientes en los últimos 2 meses.");
        setShowPrompt(false);
      }
    } catch (err) {
      console.error(err);
      alert("Hubo un problema sincronizando el correo.");
    } finally {
      setLoading(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="p-4 mb-6 bg-blue-950/40 border border-blue-500/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md shadow-lg">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl text-lg">
          📬
        </div>
        <div>
          <h4 className="text-white font-medium text-sm">
            ¿Deseas verificar tu correo en busca de comprobantes?
          </h4>
          <p className="text-gray-400 text-xs mt-0.5">
            Analizaremos facturas y recibos de los últimos 2 meses para <b>{userEmail}</b>.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end md:self-auto">
        <button
          onClick={() => setShowPrompt(false)}
          className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition cursor-pointer"
        >
          No, más tarde
        </button>
        <button
          onClick={handleSync}
          disabled={loading}
          className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20"
        >
          {loading ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Buscando...
            </>
          ) : (
            "Sí, sincronizar"
          )}
        </button>
      </div>
    </div>
  );
}