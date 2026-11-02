import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { colors } from "@/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Campaigns", tabBarIcon: icon("sparkles-outline") }}
      />
      <Tabs.Screen
        name="work"
        options={{ title: "My work", tabBarIcon: icon("briefcase-outline") }}
      />
      <Tabs.Screen
        name="inbox"
        options={{ title: "Inbox", tabBarIcon: icon("notifications-outline") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: icon("person-circle-outline") }}
      />
    </Tabs>
  );
}
