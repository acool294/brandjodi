import { CATEGORIES, CREATOR_TYPES, creatorProfileSchema, labelFor } from "@brandjodi/shared";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Body, Button, Chip, ErrorText, Input, Row, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors, spacing } from "@/theme";

export default function OnboardingScreen() {
  const { session, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    display_name: (session?.user.user_metadata?.full_name as string | undefined) ?? "",
    username: "",
    city: "",
    bio: "",
    instagram_handle: "",
    instagram_followers: "",
    starting_price: "",
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>(["ugc"]);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (list: string[], setList: (l: string[]) => void, v: string) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function save() {
    setError(null);
    const parsed = creatorProfileSchema.safeParse({
      ...form,
      languages: [],
      categories,
      creator_types: types,
      instagram_followers: form.instagram_followers ? Number(form.instagram_followers) : undefined,
      starting_price: form.starting_price
        ? Math.round(Number(form.starting_price) * 100)
        : undefined,
      is_adult: adult,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setBusy(true);
    const { is_adult, ...profile } = parsed.data;
    const userId = session!.user.id;
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ is_adult, full_name: profile.display_name })
      .eq("id", userId);
    const { error: cErr } = pErr
      ? { error: pErr }
      : await supabase.from("creator_profiles").insert({ ...profile, user_id: userId });
    if (!cErr) {
      await supabase
        .from("consents")
        .insert({ user_id: userId, purpose: "terms_and_privacy", policy_version: "poc-2026-10" });
    }
    setBusy(false);
    if (cErr) {
      setError(cErr.code === "23505" ? "That username is taken" : cErr.message);
      return;
    }
    await refreshProfile();
  }

  return (
    <Screen>
      <Body muted>This becomes your public media kit, which brands see when you apply.</Body>
      <Input label="Name" value={form.display_name} onChangeText={set("display_name")} />
      <Input
        label="Username"
        hint={`Your link: brandjodi.com/c/${form.username || "username"}`}
        value={form.username}
        onChangeText={(v) => set("username")(v.toLowerCase())}
        autoCapitalize="none"
      />
      <Input label="City" value={form.city} onChangeText={set("city")} />
      <Input label="Short bio" value={form.bio} onChangeText={set("bio")} multiline />

      <Text style={{ fontWeight: "600" }}>Categories</Text>
      <Row style={{ flexWrap: "wrap" }}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={labelFor(c)}
            selected={categories.includes(c)}
            onPress={() => toggle(categories, setCategories, c)}
          />
        ))}
      </Row>
      <Text style={{ fontWeight: "600" }}>What you do</Text>
      <Row style={{ flexWrap: "wrap" }}>
        {CREATOR_TYPES.map((c) => (
          <Chip
            key={c}
            label={labelFor(c)}
            selected={types.includes(c)}
            onPress={() => toggle(types, setTypes, c)}
          />
        ))}
      </Row>

      <Input
        label="Instagram handle"
        value={form.instagram_handle}
        onChangeText={set("instagram_handle")}
        autoCapitalize="none"
      />
      <Input
        label="Instagram followers"
        hint="Self-reported for now. Verified stats come with Instagram login later."
        value={form.instagram_followers}
        onChangeText={set("instagram_followers")}
        keyboardType="number-pad"
      />
      <Input
        label="Starting price (₹)"
        value={form.starting_price}
        onChangeText={set("starting_price")}
        keyboardType="number-pad"
      />

      <Pressable
        onPress={() => setAdult((a) => !a)}
        style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: colors.primary,
            backgroundColor: adult ? colors.primary : "transparent",
          }}
        />
        <Body style={{ flex: 1 }}>
          I am 18 or older and agree to the BrandJodi terms and privacy policy.
        </Body>
      </Pressable>

      <ErrorText message={error} />
      <Button title="Create my profile" onPress={save} loading={busy} />
    </Screen>
  );
}
