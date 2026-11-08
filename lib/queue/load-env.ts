import { readFileSync } from "node:fs";
// Muat .env untuk proses worker (Next.js memuatnya sendiri untuk web).
try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
} catch {
  /* tanpa .env */
}
