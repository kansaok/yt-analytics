import { Skeleton } from "@/components/ui/skeleton";
import { LoadingNote } from "@/components/ui/loading";

// Tampil saat Next menyiapkan halaman berikutnya (kompilasi, sesi, data server).
export default function Loading() {
  return (
    <div className="space-y-6">
      <LoadingNote label="Menyiapkan halaman..." />
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[150px]" />)}
      </div>
      <Skeleton className="h-[320px]" />
    </div>
  );
}
