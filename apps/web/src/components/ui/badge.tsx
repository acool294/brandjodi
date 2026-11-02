import { labelFor } from "@brandjodi/shared";
import { cn } from "@/lib/utils";

const tone: Record<string, string> = {
  published: "bg-success/15 text-success",
  active: "bg-success/15 text-success",
  approved: "bg-success/15 text-success",
  auto_approved: "bg-success/15 text-success",
  paid_out: "bg-success/15 text-success",
  paid: "bg-success/15 text-success",
  hired: "bg-success/15 text-success",
  accepted: "bg-success/15 text-success",
  verified: "bg-success/15 text-success",
  awaiting_funding: "bg-warning/15 text-warning",
  in_review: "bg-warning/15 text-warning",
  submitted: "bg-warning/15 text-warning",
  sent: "bg-warning/15 text-warning",
  pending_kyc: "bg-warning/15 text-warning",
  revision_requested: "bg-warning/15 text-warning",
  changes_requested: "bg-warning/15 text-warning",
  shortlisted: "bg-primary/15 text-primary",
  offered: "bg-primary/15 text-primary",
  rejected: "bg-danger/15 text-danger",
  cancelled: "bg-danger/15 text-danger",
  declined: "bg-danger/15 text-danger",
  failed: "bg-danger/15 text-danger",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {labelFor(status)}
    </span>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}
