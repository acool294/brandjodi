import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWebActor } from "@/server/auth";
import { env } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/dashboard";
  if (await getWebActor()) redirect(nextPath);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">
          Sign in to Brand<span className="text-primary">Jodi</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Brands use the web dashboard. Creators use the mobile app.
        </p>
        {error && (
          <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">
            Sign-in failed. Please try again.
          </p>
        )}
        <LoginForm nextPath={nextPath} allowPassword={env.NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN} />
      </div>
    </main>
  );
}
