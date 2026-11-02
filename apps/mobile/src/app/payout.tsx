import { API_ROUTES, payoutAccountSchema } from "@brandjodi/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { Body, Button, ErrorText, Input, Screen } from "@/components/ui";
import { api } from "@/lib/api";

export default function PayoutScreen() {
  const [form, setForm] = useState({ account_holder: "", pan: "", bank_account: "", ifsc: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const parsed = payoutAccountSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const released = await api<number>(API_ROUTES.payoutAccount, parsed.data);
      Alert.alert(
        "Saved",
        released > 0 ? `${released} pending payment(s) released.` : "You're ready to get paid.",
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Body muted>
        Needed once, before your first payout. In this test version we keep only the last 4 digits;
        real bank details will be held by our payment partner (Razorpay).
      </Body>
      <Input
        label="Account holder name"
        value={form.account_holder}
        onChangeText={set("account_holder")}
      />
      <Input
        label="PAN"
        value={form.pan}
        onChangeText={(v) => set("pan")(v.toUpperCase())}
        autoCapitalize="characters"
        maxLength={10}
      />
      <Input
        label="Bank account number"
        value={form.bank_account}
        onChangeText={set("bank_account")}
        keyboardType="number-pad"
      />
      <Input
        label="IFSC"
        value={form.ifsc}
        onChangeText={(v) => set("ifsc")(v.toUpperCase())}
        autoCapitalize="characters"
        maxLength={11}
      />
      <ErrorText message={error} />
      <Button title="Save payout details" onPress={save} loading={busy} />
    </Screen>
  );
}
