import type { Metadata } from "next";
import { Suspense } from "react";
import { AudienceView } from "@/components/audience/audience-view";

export const metadata: Metadata = { title: "Audiens" };
export default function AudiencePage() {
  return (
    <Suspense>
      <AudienceView />
    </Suspense>
  );
}
