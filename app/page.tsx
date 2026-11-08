import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const s = await auth();
  redirect(s?.user ? "/dashboard" : "/login");
}
