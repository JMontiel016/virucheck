"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  ReceiptText,
  ScanText,
  FileText,
  Settings,
  LogOut,
  Wallet,
  Clock,
  Calendar,
  Sparkles,
  Smartphone,
  Globe,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

// Módulos activos actualmente en el demo
const activeNavItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Movimientos", href: "/movimientos", icon: ReceiptText },
  { name: "Bandeja OCR", href: "/ocr", icon: ScanText },
  { name: "Recibos PDF", href: "/recibos", icon: FileText },
  { name: "Configuración", href: "/configuracion", icon: Settings },
];

// Módulos proyectados para el futuro (Web & Móvil)
const futureNavItems: NavItem[] = [
  { name: "App Nativa iOS/Android", href: "#", icon: Smartphone, badge: "Próximamente" },
  { name: "Sincronización Bancaria IA", href: "#", icon: Sparkles, badge: "Futuro" },
];

const mobileBottomNav = [
  { name: "Inicio", href: "/", icon: LayoutDashboard },
  { name: "Movimientos", href: "/movimientos", icon: ReceiptText },
  { name: "Escanear", href: "/ocr", icon: ScanText },
  { name: "Recibos", href: "/recibos", icon: FileText },
  { name: "Ajustes", href: "/configuracion", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { profile, logout } = useAuth();

  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDateTime(new Date());
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentDateTime
    ? currentDateTime.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-- ---, ----";

  const formattedTime = currentDateTime
    ? currentDateTime.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
        
        {/* HEADER MÓVIL */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur-md md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/20 text-blue-500 ring-1 ring-blue-500/30">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white">ViruCheck</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-900/80 px-2.5 py-1 border border-slate-800 font-mono text-[11px] text-cyan-400 font-bold">
              <Clock className="h-3 w-3 text-cyan-400 animate-pulse" />
              <span>{formattedTime}</span>
            </div>

            <button
              onClick={() => logout()}
              title="Cerrar sesión"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {/* SIDEBAR ESCRITORIO */}
        <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-64 flex-col border-r border-slate-800 bg-slate-950/95 backdrop-blur-md">
          <div className="flex h-20 flex-col justify-center border-b border-slate-800/80 px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-500 ring-1 ring-blue-500/30">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-white">ViruCheck</span>
                <p className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">Demo Financiero</p>
              </div>
            </div>
          </div>

          {/* Reloj y Fecha */}
          <div className="px-3 pt-3">
            <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-br from-slate-900/80 to-slate-950 p-3 shadow-inner">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 capitalize">
                  <Calendar className="h-3.5 w-3.5 text-blue-400" />
                  {formattedDate}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-base font-black text-cyan-400">
                <Clock className="h-4 w-4 animate-pulse text-cyan-400" />
                <span>{formattedTime}</span>
              </div>
            </div>
          </div>

          {/* Navegación Activa */}
          <nav className="flex-1 space-y-1 px-3 py-3 overflow-y-auto">
            <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Módulos Activos</p>
            {activeNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-blue-400" : "text-slate-400"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            {/* Sección de Futuras Actualizaciones */}
            <div className="pt-4">
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Roadmap Futuro
              </p>
              {futureNavItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-xs text-slate-500 bg-slate-900/30 border border-slate-900 cursor-not-allowed my-1"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-slate-600" />
                      <span className="line-through">{item.name}</span>
                    </div>
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md font-mono">
                      {item.badge}
                    </span>
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Perfil & Salir */}
          <div className="border-t border-slate-800/80 p-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-900/60 p-2.5 border border-slate-800/60">
              <div className="flex flex-col truncate pr-2">
                <span className="truncate text-xs font-bold text-slate-200">
                  {profile?.displayName || "Usuario"}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Base: PYG
                </span>
              </div>
              <button
                onClick={() => logout()}
                title="Cerrar sesión"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* CONTENEDOR PRINCIPAL */}
        <div className="flex flex-1 flex-col md:pl-64 pb-20 md:pb-8">
          <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>

        {/* BARRA INFERIOR MÓVIL */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-slate-800 bg-slate-950/95 px-2 backdrop-blur-lg md:hidden">
          {mobileBottomNav.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors ${
                  isActive ? "text-blue-400 font-bold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px]">{item.name}</span>
              </Link>
            );
          })}
        </nav>

      </div>
    </ProtectedRoute>
  );
}