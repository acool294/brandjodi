import Link from "next/link";
import { BadgeCheck, Clock, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { Logo } from "@/components/app-shell";
import { buttonClasses } from "@/components/ui/button";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Payment secured first",
    body: "Brands fund the contract before work starts. Creators are paid on approval.",
  },
  {
    icon: Clock,
    title: "Auto-approval",
    body: "No reply from the brand in 5 days? The work is approved and the creator is paid.",
  },
  {
    icon: Wallet,
    title: "0% creator fee",
    body: "Creators keep the full agreed price. Brands pay a simple 10% platform fee.",
  },
  {
    icon: BadgeCheck,
    title: "Rights built in",
    body: "Usage rights, exclusivity and #ad disclosure are part of every contract.",
  },
];

export default function LandingPage() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-[#ff3d8b]/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-40 top-20 size-[520px] rounded-full bg-[#7c3aed]/20 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
        <header className="flex items-center justify-between py-6">
          <Logo className="text-2xl" />
          <Link href="/login" className={buttonClasses("outline", "sm")}>
            Sign in
          </Link>
        </header>

        <section className="flex flex-1 flex-col items-start justify-center gap-6 py-16">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
            <Sparkles className="size-3.5" /> For D2C fashion and beauty brands in India
          </span>
          <h1 className="max-w-4xl text-5xl font-extrabold leading-[1.05] sm:text-6xl">
            Find the perfect <span className="text-brand-gradient">creator jodi</span> for your
            brand.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Post a brief, get applications from vetted creators, pay safely through BrandJodi,
            approve the content, and the creator is paid. Simple.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className={buttonClasses("primary", "lg")}>
              Start hiring creators
            </Link>
            <Link href="#features" className={buttonClasses("outline", "lg")}>
              How it works
            </Link>
          </div>
        </section>

        <section id="features" className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border bg-card/80 p-5 shadow-soft backdrop-blur"
            >
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-brand-gradient text-white">
                <Icon className="size-5" />
              </div>
              <p className="font-bold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
