import { labelFor } from "@brandjodi/shared";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type TextInputProps,
  type TextProps,
  type ViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradient, radius, shadow, spacing } from "@/theme";

export function Screen({
  children,
  scroll = true,
  ...props
}: ScrollViewProps & { scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={["left", "right"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          {...props}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title(props: TextProps) {
  return <Text {...props} style={[styles.title, props.style]} />;
}

export function Body(props: TextProps & { muted?: boolean }) {
  return (
    <Text {...props} style={[styles.body, props.muted && { color: colors.muted }, props.style]} />
  );
}

export function Card(props: ViewProps) {
  return <View {...props} style={[styles.card, props.style]} />;
}

export function Button({
  title,
  variant = "primary",
  loading,
  disabled,
  ...props
}: PressableProps & {
  title: string;
  variant?: "primary" | "outline" | "ghost" | "danger";
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  const filled = variant === "primary" || variant === "danger";
  const label = loading ? (
    <ActivityIndicator color={filled ? "#fff" : colors.text} />
  ) : (
    <Text
      style={[
        styles.buttonText,
        { color: filled ? colors.primaryText : variant === "ghost" ? colors.muted : colors.text },
      ]}
    >
      {title}
    </Text>
  );
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === "danger" && { backgroundColor: colors.danger },
        variant === "outline" && {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        variant === "primary" && { overflow: "hidden", padding: 0 },
        (pressed || isDisabled) && { opacity: 0.7 },
      ]}
      {...props}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientFill}
        >
          {label}
        </LinearGradient>
      ) : (
        label
      )}
    </Pressable>
  );
}

/** Big gradient banner used at the top of main screens. */
export function Hero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      {eyebrow && <Text style={styles.heroEyebrow}>{eyebrow}</Text>}
      <Text style={styles.heroTitle}>{title}</Text>
      {subtitle && <Text style={styles.heroSubtitle}>{subtitle}</Text>}
      {children}
    </LinearGradient>
  );
}

/** Coloured circle with initials. */
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <LinearGradient
      colors={gradient}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: size / 2.6 }}>{initials}</Text>
    </LinearGradient>
  );
}

export function Input({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 96, textAlignVertical: "top" },
          props.style,
        ]}
      />
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: colors.primary, borderColor: colors.primary },
      ]}
    >
      <Text style={{ color: selected ? colors.primaryText : colors.text, fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const tone: Record<string, string> = {
  active: colors.success,
  approved: colors.success,
  auto_approved: colors.success,
  paid_out: colors.success,
  paid: colors.success,
  hired: colors.success,
  accepted: colors.success,
  awaiting_funding: colors.warning,
  in_review: colors.warning,
  submitted: colors.warning,
  sent: colors.warning,
  pending_kyc: colors.warning,
  revision_requested: colors.warning,
  changes_requested: colors.warning,
  offered: colors.primary,
  shortlisted: colors.primary,
  rejected: colors.danger,
  declined: colors.danger,
  cancelled: colors.danger,
};

export function StatusBadge({ status }: { status: string }) {
  const c = tone[status] ?? colors.muted;
  return (
    <View style={[styles.badge, { backgroundColor: `${c}1f` }]}>
      <Text style={{ color: c, fontSize: 12, fontWeight: "600" }}>{labelFor(status)}</Text>
    </View>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontWeight: "600", color: colors.text }}>{title}</Text>
      {body && <Text style={[styles.hint, { textAlign: "center" }]}>{body}</Text>}
    </View>
  );
}

export function Row(props: ViewProps) {
  return (
    <View
      {...props}
      style={[{ flexDirection: "row", alignItems: "center", gap: spacing.sm }, props.style]}
    />
  );
}

export function ErrorText({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Text style={{ color: colors.danger, fontSize: 13 }}>{message}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow,
  },
  button: {
    height: 50,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  gradientFill: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonText: { fontSize: 15, fontWeight: "700" },
  hero: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.xs },
  heroEyebrow: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "800" },
  heroSubtitle: { color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  hint: { fontSize: 12, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.xs,
  },
});
