import { CATEGORIES, labelFor } from "@brandjodi/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { Button, Chip, ErrorText, Input, Row, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function EditProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    display_name: profile?.display_name ?? "",
    bio: profile?.bio ?? "",
    city: profile?.city ?? "",
    instagram_handle: profile?.instagram_handle ?? "",
    instagram_followers: profile?.instagram_followers?.toString() ?? "",
    youtube_handle: profile?.youtube_handle ?? "",
    youtube_subscribers: profile?.youtube_subscribers?.toString() ?? "",
    starting_price: profile?.starting_price ? String(profile.starting_price / 100) : "",
  });
  const [categories, setCategories] = useState<string[]>(profile?.categories ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v: string) => (v ? Number(v) : null);

  async function save() {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase
      .from("creator_profiles")
      .update({
        display_name: form.display_name.trim(),
        bio: form.bio.trim() || null,
        city: form.city.trim() || null,
        categories,
        instagram_handle: form.instagram_handle.trim() || null,
        instagram_followers: num(form.instagram_followers),
        youtube_handle: form.youtube_handle.trim() || null,
        youtube_subscribers: num(form.youtube_subscribers),
        starting_price: form.starting_price ? Math.round(Number(form.starting_price) * 100) : null,
      })
      .eq("user_id", profile.user_id);
    setBusy(false);
    if (error) return setError(error.message);
    await refreshProfile();
    router.back();
  }

  return (
    <Screen>
      <Input label="Name" value={form.display_name} onChangeText={set("display_name")} />
      <Input label="City" value={form.city} onChangeText={set("city")} />
      <Input label="Bio" value={form.bio} onChangeText={set("bio")} multiline />
      <Text style={{ fontWeight: "600" }}>Categories</Text>
      <Row style={{ flexWrap: "wrap" }}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={labelFor(c)}
            selected={categories.includes(c)}
            onPress={() =>
              setCategories((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]))
            }
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
        value={form.instagram_followers}
        onChangeText={set("instagram_followers")}
        keyboardType="number-pad"
      />
      <Input
        label="YouTube channel"
        value={form.youtube_handle}
        onChangeText={set("youtube_handle")}
        autoCapitalize="none"
      />
      <Input
        label="YouTube subscribers"
        value={form.youtube_subscribers}
        onChangeText={set("youtube_subscribers")}
        keyboardType="number-pad"
      />
      <Input
        label="Starting price (₹)"
        value={form.starting_price}
        onChangeText={set("starting_price")}
        keyboardType="number-pad"
      />
      <ErrorText message={error} />
      <Button title="Save" onPress={save} loading={busy} />
    </Screen>
  );
}
