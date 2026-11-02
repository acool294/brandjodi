import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-xl font-bold">
          Brand<span className="text-primary">Jodi</span>
        </span>
        <Link href="/login" className={buttonClasses("outline", "sm")}>
          Sign in
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-6 py-16">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          For D2C fashion and beauty brands
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          Find the perfect creator jodi for your brand.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Post a brief, get applications from vetted creators, pay safely through BrandJodi, approve
          the content, and the creator is paid. Usage rights and disclosure are built into every
          contract.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/login" className={buttonClasses("primary", "lg")}>
            Start hiring creators
          </Link>
          <Link href="#creators" className={buttonClasses("outline", "lg")}>
            I&apos;m a creator
          </Link>
        </div>
      </section>

      <section id="creators" className="grid gap-4 pb-16 sm:grid-cols-3">
        {[
          [
            "Payment secured first",
            "Brands fund the contract before work starts. Creators are paid on approval.",
          ],
          [
            "Auto-approval",
            "If a brand doesn't respond within 5 days, the work is approved automatically.",
          ],
          [
            "0% creator fee",
            "Creators keep the full agreed price. Get the BrandJodi app to apply to campaigns.",
          ],
        ].map(([title, body]) => (
          <div key={title} className="rounded-xl border bg-card p-5">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
