import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { devModeEnabled } from "@/lib/env";
import { AppShell } from "@/components/shell/app-shell";
import { Providers } from "./providers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  async function signOutAction() {
    "use server";
    // JWT sesi dihapus dari cookie; token Google tetap untuk sync kecuali channel diputus.
    await signOut({ redirectTo: "/login?out=1" });
  }
  return (
    <Providers>
      <AppShell devMode={devModeEnabled()} signOutAction={signOutAction}>
        {children}
      </AppShell>
    </Providers>
  );
}
