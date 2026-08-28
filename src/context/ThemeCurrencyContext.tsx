/**
 * ============================================================================
 * CONTEXTO GLOBAL DE TEMA Y DIVISA - VIRUCHECK (TIEMPO REAL)
 * ============================================================================
 */

"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

interface ThemeCurrencyContextType {
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => Promise<void>;
  currency: string;
  setCurrency: (currency: string) => Promise<void>;
  formatMoney: (amount: number | string) => string;
}

const ThemeCurrencyContext = createContext<ThemeCurrencyContextType>({} as ThemeCurrencyContextType);

export function ThemeCurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [currency, setCurrencyState] = useState("PYG");

  // Cargar preferencias iniciales y escuchar cambios en tiempo real
  useEffect(() => {
    const savedTheme = (localStorage.getItem("virucheck_theme") as "dark" | "light") || "dark";
    setThemeState(savedTheme);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
    document.documentElement.classList.toggle("light", savedTheme === "light");

    const savedCurrency = localStorage.getItem("virucheck_currency") || "PYG";
    setCurrencyState(savedCurrency);

    // Sincronizar con eventos personalizados del sistema
    const handleStorageChange = () => {
      const currentCurr = localStorage.getItem("virucheck_currency") || "PYG";
      setCurrencyState(currentCurr);
    };

    window.addEventListener("currencyChange", handleStorageChange);
    window.addEventListener("storage", handleStorageChange);

    if (user?.uid) {
      getDoc(doc(db, "users", user.uid)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.theme) {
            setThemeState(data.theme);
            localStorage.setItem("virucheck_theme", data.theme);
            document.documentElement.classList.toggle("dark", data.theme === "dark");
            document.documentElement.classList.toggle("light", data.theme === "light");
          }
          if (data.currency) {
            setCurrencyState(data.currency);
            localStorage.setItem("virucheck_currency", data.currency);
          }
        }
      });
    }

    return () => {
      window.removeEventListener("currencyChange", handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [user]);

  const setTheme = async (newTheme: "dark" | "light") => {
    setThemeState(newTheme);
    localStorage.setItem("virucheck_theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    document.documentElement.classList.toggle("light", newTheme === "light");

    if (user?.uid) {
      try {
        await updateDoc(doc(db, "users", user.uid), { theme: newTheme });
      } catch (err) {
        console.error("Error al guardar tema:", err);
      }
    }
  };

  const setCurrency = async (newCurrency: string) => {
    setCurrencyState(newCurrency);
    localStorage.setItem("virucheck_currency", newCurrency);

    if (user?.uid) {
      try {
        await updateDoc(doc(db, "users", user.uid), { currency: newCurrency });
      } catch (err) {
        console.error("Error al guardar moneda:", err);
      }
    }
    // Disparar evento global para actualizar la UI al instante en componentes hijos
    window.dispatchEvent(new Event("currencyChange"));
  };

  const formatMoney = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount.replace(/\./g, "").replace(",", ".")) : amount;
    if (isNaN(num)) return `0 ${currency === "USD" ? "$" : currency === "EUR" ? "€" : "₲"}`;

    if (currency === "USD") {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
    }
    if (currency === "EUR") {
      return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
    }
    // Formato Guaraníes (PYG)
    return new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 }).format(num).replace("PYG", "₲");
  };

  return (
    <ThemeCurrencyContext.Provider value={{ theme, setTheme, currency, setCurrency, formatMoney }}>
      {children}
    </ThemeCurrencyContext.Provider>
  );
}

export const useThemeCurrency = () => useContext(ThemeCurrencyContext);