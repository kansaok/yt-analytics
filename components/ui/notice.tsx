import { Info, WarningCircle, CheckCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

// Status: teks dulu, ikon & warna sebagai pendukung. Aksen terakota = perlu perhatian, bukan error.
const map = {
  info: { Icon: Info, cls: "border-sea-line bg-sea-surface", icon: "text-sea-primary" },
  attention: { Icon: WarningCircle, cls: "border-sea-accent bg-sea-surface", icon: "text-sea-accent" },
  success: { Icon: CheckCircle, cls: "border-sea-success bg-sea-surface", icon: "text-sea-success" },
  error: { Icon: XCircle, cls: "border-sea-danger bg-sea-surface", icon: "text-sea-danger" },
};

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof map;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const { Icon, cls, icon } = map[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex flex-col gap-3 rounded-card border px-4 py-3 sm:flex-row sm:items-center", cls, className)}
    >
      <div className="flex flex-1 gap-3">
        <Icon size={22} className={cn("mt-0.5 shrink-0", icon)} aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          {children ? <div className="text-sm text-sea-muted">{children}</div> : null}
        </div>
      </div>
      {action ? <div className="shrink-0 pl-9 sm:pl-0">{action}</div> : null}
    </div>
  );
}
