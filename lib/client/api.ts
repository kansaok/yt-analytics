"use client";
export class ApiClientError extends Error {
  constructor(public code: string, message: string, public status: number, public retryAfterSec?: number) {
    super(message);
  }
}

let csrfReady: Promise<void> | null = null;

function csrfToken() {
  if (typeof document === "undefined") return null;
  return document.cookie.match(/(?:^|; )yta-csrf=([^;]+)/)?.[1] ?? null;
}

async function ensureCsrf() {
  if (csrfToken()) return;
  csrfReady ??= fetch("/api/csrf", { cache: "no-store", credentials: "same-origin" }).then((res) => {
    if (!res.ok) throw new Error("Tidak dapat menyiapkan token keamanan.");
  });
  try {
    await csrfReady;
  } finally {
    csrfReady = null;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) await ensureCsrf();
  const token = csrfToken();
  const res = await fetch(path, {
    ...init,
    // React Query yang mengelola cache klien; jangan pakai HTTP cache browser (max-age=300 dari server)
    // agar data baru langsung terlihat setelah sinkronisasi selesai.
    cache: "no-store",
    headers: { "content-type": "application/json", ...(token ? { "x-csrf-token": token } : {}), ...(init?.headers ?? {}) },
    credentials: "same-origin",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
    throw new ApiClientError(
      body?.error?.code ?? "NETWORK",
      body?.error?.message ?? "Tidak dapat terhubung ke server.",
      res.status,
      body?.error?.retryAfterSec,
    );
  }
  return body as T;
}
