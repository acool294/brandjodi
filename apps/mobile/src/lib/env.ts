/** Expo inlines EXPO_PUBLIC_* at build time; each must be referenced literally. */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy apps/mobile/.env.example to apps/mobile/.env`);
  return value;
}

export const env = {
  supabaseUrl: required("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseKey: required(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  /** Email + password sign-in and sign-up; on unless set to "false". */
  enablePasswordLogin: process.env.EXPO_PUBLIC_ENABLE_PASSWORD_LOGIN !== "false",
  /** Off until Google is enabled in Supabase -> Authentication -> Providers. */
  enableGoogleLogin: process.env.EXPO_PUBLIC_ENABLE_GOOGLE_LOGIN === "true",
};
