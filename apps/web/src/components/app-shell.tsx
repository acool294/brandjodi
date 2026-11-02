import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/creators", label: "Find creators" },
  { href: "/contracts", label: "Contracts" },
];

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
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <Link href="/dashboard" className="text-lg font-bold">
            Brand<span className="text-primary">Jodi</span>
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 hover:bg-muted">
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin" className="rounded-md px-3 py-1.5 text-primary hover:bg-muted">
                Admin
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            {orgName && (
              <span className="text-muted-foreground">
                {orgName}
                {verified && (
                  <span className="ml-1 text-success" title="Verified brand">
                    ✓
                  </span>
                )}
              </span>
            )}
            <form action="/auth/signout" method="post">
              <button className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
