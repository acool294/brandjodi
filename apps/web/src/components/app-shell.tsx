import Link from "next/link";
import { BadgeCheck, LogOut } from "lucide-react";
import { AppNav } from "./app-nav";
import { Avatar } from "./ui/card";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={`font-[family-name:var(--font-jakarta)] text-xl font-extrabold tracking-tight ${className ?? ""}`}
    >
      Brand<span className="text-brand-gradient">Jodi</span>
    </span>
  );
}

export function AppShell({
  orgName,
  verified,
  isAdmin,
  children,
}: {
  orgName?: string;
  verified?: boolean;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <aside className="border-b bg-card/80 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:flex-col lg:items-stretch lg:gap-6 lg:px-4 lg:py-6">
          <Link href="/dashboard" className="px-2">
            <Logo />
          </Link>
          <div className="hidden flex-1 lg:block">
            <AppNav isAdmin={isAdmin} />
          </div>
          <div className="flex items-center gap-3 lg:rounded-2xl lg:bg-brand-soft lg:p-3">
            {orgName && (
              <>
                <Avatar name={orgName} className="size-9" />
                <div className="hidden min-w-0 flex-1 lg:block">
                  <p className="flex items-center gap-1 truncate text-sm font-semibold">
                    {orgName}
                    {verified && (
                      <BadgeCheck className="size-4 text-accent" aria-label="Verified brand" />
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Brand account</p>
                </div>
              </>
            )}
            <form action="/auth/signout" method="post">
              <button
                className="rounded-lg p-2 text-muted-foreground hover:bg-card hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
        <div className="px-4 pb-3 lg:hidden">
          <AppNav isAdmin={isAdmin} />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
