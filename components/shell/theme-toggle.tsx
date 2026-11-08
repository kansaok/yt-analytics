"use client";
import { useEffect, useState } from "react";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";

type Mode = "system" | "light" | "dark";
const next: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };
const label: Record<Mode, string> = { system: "Tema: ikut sistem", light: "Tema: terang", dark: "Tema: gelap" };

/** Ikut sistem kecuali pengguna memilih (DESIGN.md Theme behavior). Siklus: sistem, terang, gelap. */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem("theme");
      if (t === "light" || t === "dark") setMode(t);
    } catch {
      /* tanpa storage: ikut sistem */
    }
  }, []);
  const apply = (m: Mode) => {
    setMode(m);
    const root = document.documentElement;
    if (m === "system") delete root.dataset.theme;
    else root.dataset.theme = m;
    try {
      if (m === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", m);
    } catch {
      /* noop */
    }
  };
  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Desktop;
  return (
    <button
      type="button"
      onClick={() => apply(next[mode])}
      aria-label={`${label[mode]}. Klik untuk ganti.`}
      title={label[mode]}
      className="inline-flex h-11 w-11 items-center justify-center rounded-control text-sea-text hover:bg-sea-tint active:bg-sea-line/40"
      data-testid="theme-toggle"
      data-mode={mode}
    >
      <Icon size={22} aria-hidden="true" />
    </button>
  );
}
