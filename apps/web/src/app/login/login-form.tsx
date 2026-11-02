"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "code" | "password";

export function LoginForm({
  nextPath,
  allowPassword,
}: {
  nextPath: string;
  allowPassword: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setStep("code");
    });

  const verifyCode = () =>
    run(async () => {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw error;
      router.replace(nextPath);
      router.refresh();
    });

  const signInWithPassword = () =>
    run(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace(nextPath);
      router.refresh();
    });

  const signInWithGoogle = () =>
    run(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) throw error;
    });

  return (
    <div className="mt-6 space-y-4">
      <Button variant="outline" className="w-full" onClick={signInWithGoogle} disabled={busy}>
        Continue with Google
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === "email") sendCode();
          else if (step === "code") verifyCode();
          else signInWithPassword();
        }}
      >
        <Field label="Email">
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={step === "code"}
          />
        </Field>

        {step === "code" && (
          <Field label="6-digit code" hint={`We emailed a code to ${email}.`}>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
            />
          </Field>
        )}

        {step === "password" && (
          <Field label="Password">
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" className="w-full" disabled={busy}>
          {step === "email"
            ? "Email me a code"
            : step === "code"
              ? "Verify and sign in"
              : "Sign in"}
        </Button>
      </form>

      <div className="flex justify-between text-sm">
        {step !== "email" && (
          <button
            className="text-muted-foreground hover:underline"
            onClick={() => setStep("email")}
          >
            Use a different method
          </button>
        )}
        {allowPassword && step === "email" && (
          <button
            className="text-muted-foreground hover:underline"
            onClick={() => setStep("password")}
          >
            Use a password (demo accounts)
          </button>
        )}
      </div>
    </div>
  );
}
