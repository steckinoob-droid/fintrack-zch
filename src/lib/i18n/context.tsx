"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { Lang } from "./app";

const STORAGE_KEY = "fintrack_lang";

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "pt") return saved;
  // Fallback: detect browser language
  const browser = navigator.language.toLowerCase();
  return browser.startsWith("pt") ? "pt" : "en";
}

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  toggle: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, l);
    }
  }, []);

  const toggle = useCallback(() => {
    setLang(lang === "en" ? "pt" : "en");
  }, [lang, setLang]);

  return (
    <LangContext.Provider value={{ lang, setLang, toggle }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
