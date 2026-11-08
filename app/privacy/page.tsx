import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Kebijakan Privasi" };

// Isi menjelaskan perilaku aplikasi yang benar-benar diimplementasikan. Teks hukum final perlu ditinjau pemilik produk.
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-task px-5 py-10">
      <Link href="/login" className="text-sm font-semibold text-sea-primary underline underline-offset-4">
        Kembali
      </Link>
      <h1 className="mt-4 text-[28px]">Kebijakan Privasi</h1>
      <p className="mt-2 text-sm text-sea-muted">Draf teknis. Teks hukum final perlu ditinjau sebelum rilis publik.</p>

      <h2 className="mt-8 text-xl">Izin Google yang diminta</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li><code className="font-mono text-sm">openid email profile</code>: untuk membuat akun dan menampilkan nama Anda.</li>
        <li><code className="font-mono text-sm">youtube.readonly</code>: membaca daftar channel dan video Anda.</li>
        <li><code className="font-mono text-sm">yt-analytics.readonly</code>: membaca statistik views, subscriber, watch time, retensi, dan sumber traffic.</li>
      </ul>
      <p className="mt-3">Aplikasi tidak meminta izin unggah, ubah metadata, komentar, atau data pendapatan.</p>

      <h2 className="mt-8 text-xl">Data yang disimpan</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>Email, nama, dan foto profil Google Anda.</li>
        <li>Token akses dan refresh Google, dienkripsi AES-256-GCM.</li>
        <li>Metadata channel dan video (judul, tanggal terbit, durasi, status).</li>
        <li>Agregat harian: views, subscriber baru dan hilang, watch time, impresi, CTR, retensi rata-rata, dan views per sumber traffic.</li>
      </ul>
      <p className="mt-3">Tidak ada isi komentar atau data penonton perorangan yang disimpan.</p>

      <h2 className="mt-8 text-xl">Penghapusan</h2>
      <p className="mt-3">
        Memutus channel di halaman Channel langsung menghapus channel itu beserta semua statistik dan videonya, membatalkan
        antrean sinkronisasinya, dan menghapus serta mencabut token Google bila tidak ada channel lain yang memakainya. Anda
        juga dapat mencabut akses di{" "}
        <a href="https://myaccount.google.com/permissions" className="font-semibold text-sea-primary underline underline-offset-4" rel="noopener noreferrer" target="_blank">
          pengaturan akun Google
        </a>
        ; sinkronisasi berikutnya akan mendeteksinya, menghapus token, dan menghentikan sinkronisasi.
      </p>

      <h2 className="mt-8 text-xl">Pihak ketiga</h2>
      <p className="mt-3">
        Data diambil melalui YouTube API Services. Dengan memakai aplikasi ini Anda juga terikat pada{" "}
        <a href="https://www.youtube.com/t/terms" className="font-semibold text-sea-primary underline underline-offset-4" rel="noopener noreferrer" target="_blank">Ketentuan Layanan YouTube</a>{" "}
        dan{" "}
        <a href="https://policies.google.com/privacy" className="font-semibold text-sea-primary underline underline-offset-4" rel="noopener noreferrer" target="_blank">Kebijakan Privasi Google</a>.
      </p>
    </main>
  );
}
