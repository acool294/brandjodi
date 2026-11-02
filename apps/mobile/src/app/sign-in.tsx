import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Body, Button, ErrorText, Input, Screen, Title } from "@/components/ui";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/theme";

WebBrowser.maybeCompleteAuthSession();

type Step = "email" | "code" | "password";

export default function SignInScreen() {
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
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setStep("code");
    });

  const verify = () =>
    run(async () => {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
    });

  const passwordSignIn = () =>
    run(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
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

        <Button title="Continue with Google" variant="outline" onPress={google} disabled={busy} />

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          editable={step !== "code"}
        />
        {step === "code" && (
          <Input
            label="6-digit code"
            hint={`We emailed a code to ${email}`}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
          />
        )}
        {step === "password" && (
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        )}
        <ErrorText message={error} />
        <Button
          title={
            step === "email"
              ? "Email me a code"
              : step === "code"
                ? "Verify and continue"
                : "Sign in"
          }
          onPress={step === "email" ? sendCode : step === "code" ? verify : passwordSignIn}
          loading={busy}
          disabled={!email}
        />
        {step !== "email" && (
          <Button title="Use a different method" variant="ghost" onPress={() => setStep("email")} />
        )}
        {env.enablePasswordLogin && step === "email" && (
          <Button
            title="Use a password (demo accounts)"
            variant="ghost"
            onPress={() => setStep("password")}
          />
        )}
        <Body muted style={{ fontSize: 12, textAlign: "center" }}>
          You must be 18 or older to use BrandJodi.
        </Body>
      </Screen>
    </KeyboardAvoidingView>
  );
}
