"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "code" | "code-verify";

export function LoginForm({
  nextPath,
  allowPassword,
  allowGoogle,
}: {
  nextPath: string;
  allowPassword: boolean;
  allowGoogle: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>(allowPassword ? "signin" : "code");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const done = () => {
    router.replace(nextPath);
    router.refresh();
  };

  const submit = () =>
    run(async () => {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        done();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          },
        });
        if (error) throw error;
        // With "Confirm email" off in Supabase, signUp returns a session straight away.
        if (data.session) done();
        else setNotice("Account created. Check your email to confirm it, then sign in.");
      } else if (mode === "code") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        setMode("code-verify");
      } else {
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
        if (error) throw error;
        done();
      }
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

  const label = {
    signin: "Sign in",
    signup: "Create account",
    code: "Email me a code",
    "code-verify": "Verify and sign in",
  }[mode];

  return (
    <div className="mt-6 space-y-4">
      {allowPassword && (
        <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md py-1.5 ${mode === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      )}

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Email">
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={mode === "code-verify"}
          />
        </Field>

        {(mode === "signin" || mode === "signup") && (
          <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
            <Input
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}

        {mode === "code-verify" && (
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

        {error && <p className="text-sm text-danger">{error}</p>}
        {notice && <p className="text-sm text-success">{notice}</p>}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : label}
        </Button>
      </form>

      {allowGoogle && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={signInWithGoogle} disabled={busy}>
            Continue with Google
          </Button>
        </>
      )}
      {mode === "code" || mode === "code-verify" ? (
        allowPassword && (
          <button
            className="w-full text-sm text-muted-foreground hover:underline"
            onClick={() => setMode("signin")}
          >
            Use email and password instead
          </button>
        )
      ) : (
        <button
          className="w-full text-sm text-muted-foreground hover:underline"
          onClick={() => setMode("code")}
        >
          Email me a sign-in code instead
        </button>
      )}
    </div>
  );
}
