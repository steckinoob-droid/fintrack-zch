"use client";

import { useState, useCallback } from "react";

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  action?: { label: string; onClick: () => void };
}

let toastCounter = 0;

type ToastHandler = (toast: Omit<Toast, "id">) => void;

const listeners: ToastHandler[] = [];

export function toast(data: Omit<Toast, "id">) {
  listeners.forEach((fn) => fn(data));
}

toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: "success" });

toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: "error" });

toast.warning = (title: string, description?: string) =>
  toast({ title, description, variant: "warning" });

export function useToastState() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addListener = useCallback((handler: ToastHandler) => {
    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((data: Omit<Toast, "id">) => {
    const id = String(++toastCounter);
    setToasts((prev) => [...prev, { ...data, id }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return { toasts, add, dismiss, addListener };
}
