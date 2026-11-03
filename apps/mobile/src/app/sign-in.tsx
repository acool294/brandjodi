import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Body, Button, Chip, ErrorText, Input, Row, Screen, Title } from "@/components/ui";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/theme";

WebBrowser.maybeCompleteAuthSession();

type Mode = "signin" | "signup" | "code" | "code-verify";

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>(env.enablePasswordLogin ? "signin" : "code");
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

  // A successful sign-in updates the session; the root layout then shows onboarding or the tabs.
  const submit = () =>
    run(async () => {
      const address = email.trim();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) throw error;
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
        const { data, error } = await supabase.auth.signUp({ email: address, password });
        if (error) throw error;
        if (!data.session)
          setNotice("Account created. Check your email to confirm it, then sign in.");
      } else if (mode === "code") {
        const { error } = await supabase.auth.signInWithOtp({
          email: address,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        setMode("code-verify");
      } else {
        const { error } = await supabase.auth.verifyOtp({
          email: address,
          token: code.trim(),
          type: "email",
        });
        if (error) throw error;
      }
    });

  // Google via Supabase OAuth (PKCE): open the browser, then exchange the returned code for a session.
  const google = () =>
    run(async () => {
      const redirectTo = Linking.createURL("auth-callback");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success") return;
      const authCode = new URL(result.url).searchParams.get("code");
      if (!authCode) throw new Error("Google sign-in was cancelled");
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(authCode);
      if (exErr) throw exErr;
    });

  const label = {
    signin: "Sign in",
    signup: "Create account",
    code: "Email me a code",
    "code-verify": "Verify and continue",
  }[mode];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: spacing.xl,
          gap: spacing.lg,
        }}
      >
        <View style={{ gap: spacing.xs }}>
          <Title style={{ fontSize: 30 }}>
            Brand<Title style={{ fontSize: 30, color: colors.primary }}>Jodi</Title>
          </Title>
          <Body muted>
            Get paid campaigns from D2C fashion and beauty brands. Payment is secured before you
            start.
          </Body>
        </View>

        {env.enablePasswordLogin && (mode === "signin" || mode === "signup") && (
          <Row>
            <Chip label="Sign in" selected={mode === "signin"} onPress={() => setMode("signin")} />
            <Chip
              label="Create account"
              selected={mode === "signup"}
              onPress={() => setMode("signup")}
            />
          </Row>
        )}

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          editable={mode !== "code-verify"}
        />
        {(mode === "signin" || mode === "signup") && (
          <Input
            label="Password"
            hint={mode === "signup" ? "At least 8 characters." : undefined}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        )}
        {mode === "code-verify" && (
          <Input
            label="6-digit code"
            hint={`We emailed a code to ${email}`}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
          />
        )}
        <ErrorText message={error} />
        {notice && <Body style={{ color: colors.success }}>{notice}</Body>}
        <Button title={label} onPress={submit} loading={busy} disabled={!email} />

        {env.enableGoogleLogin && (
          <Button title="Continue with Google" variant="outline" onPress={google} disabled={busy} />
        )}
        {mode === "code" || mode === "code-verify" ? (
          env.enablePasswordLogin && (
            <Button
              title="Use email and password instead"
              variant="ghost"
              onPress={() => setMode("signin")}
            />
          )
        ) : (
          <Button
            title="Email me a sign-in code instead"
            variant="ghost"
            onPress={() => setMode("code")}
          />
        )}
        <Body muted style={{ fontSize: 12, textAlign: "center" }}>
          You must be 18 or older to use BrandJodi.
        </Body>
      </Screen>
    </KeyboardAvoidingView>
  );
}
