import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/app-shell";
import { getWebActor } from "@/server/auth";
import { env } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/dashboard";
  if (await getWebActor()) redirect(nextPath);

  return (
    <main className="grid flex-1 lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-brand-gradient p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <Link href="/" className="relative">
          <span className="font-[family-name:var(--font-jakarta)] text-2xl font-extrabold">
            BrandJodi
          </span>
        </Link>
        <div className="relative space-y-4">
          <h2 className="text-4xl font-extrabold leading-tight">
            Hire creators. Pay safely. Get content that sells.
          </h2>
          <p className="max-w-md text-white/85">
            Briefs, offers, chat, payment protection and approvals in one place, built for Indian
            D2C brands.
          </p>
        </div>
        <p className="relative text-sm text-white/70">
          Payment is held until you approve the work.
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Logo className="text-2xl lg:hidden" />
          <h1 className="mt-6 text-3xl font-extrabold lg:mt-0">Welcome</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Brands use the web dashboard. Creators use the mobile app.
          </p>
          {error && (
            <p className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">
              Sign-in failed. Please try again.
            </p>
          )}
          <LoginForm
            nextPath={nextPath}
            allowPassword={env.NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN}
            allowGoogle={env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN}
          />
        </div>
      </section>
    </main>
  );
}
