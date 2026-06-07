"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { Lang } from "./app";
import { formatCurrency, formatCompact } from "@/lib/utils/currency";

const STORAGE_KEY          = "fintrack_lang";
const CURRENCY_STORAGE_KEY = "fintrack_currency";

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "pt") return saved;
  const browser = navigator.language.toLowerCase();
  return browser.startsWith("pt") ? "pt" : "en";
}

function getInitialCurrency(): string {
  if (typeof window === "undefined") return "BRL";
  return localStorage.getItem(CURRENCY_STORAGE_KEY) ?? "BRL";
}

interface LangContextValue {
  lang:        Lang;
  setLang:     (l: Lang) => void;
  toggle:      () => void;
  currency:    string;
  setCurrency: (c: string) => void;
  /** formatCurrency bound to the user's selected currency */
  fc:  (n: number) => string;
  /** formatCompact bound to the user's selected currency */
  fck: (n: number) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: "en", setLang: () => {}, toggle: () => {},
  currency: "BRL", setCurrency: () => {},
  fc:  (n) => formatCurrency(n, "BRL"),
  fck: (n) => formatCompact(n, "BRL"),
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang,     setLangState]     = useState<Lang>(getInitialLang);
  const [currency, setCurrencyState] = useState<string>(getInitialCurrency);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const setCurrency = useCallback((c: string) => {
    setCurrencyState(c);
    if (typeof window !== "undefined") localStorage.setItem(CURRENCY_STORAGE_KEY, c);
  }, []);

  const toggle = useCallback(() => {
    setLang(lang === "en" ? "pt" : "en");
  }, [lang, setLang]);

  const fc  = useCallback((n: number) => formatCurrency(n, currency), [currency]);
  const fck = useCallback((n: number) => formatCompact(n, currency),  [currency]);

  return (
    <LangContext.Provider value={{ lang, setLang, toggle, currency, setCurrency, fc, fck }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
