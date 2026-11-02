import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);
  if (loading) return null;

  const signedIn = Boolean(session);
  const onboarded = Boolean(profile);

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" options={{ title: "Your creator profile" }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="campaign/[id]" options={{ title: "Campaign" }} />
        <Stack.Screen name="application/[id]" options={{ title: "Application" }} />
        <Stack.Screen name="contract/[id]" options={{ title: "Contract" }} />
        <Stack.Screen name="payout" options={{ title: "Payout details", presentation: "modal" }} />
        <Stack.Screen name="edit-profile" options={{ title: "Edit profile" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
