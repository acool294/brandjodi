import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for permission and stores the Expo push token. The database sends a push for every row
 * inserted into `notifications` (see the cron_and_push migration). Needs a physical device and an
 * EAS project id; silently does nothing otherwise.
 */
export async function registerForPush(userId: string) {
  try {
    if (!Device.isDevice || Platform.OS === "web") return;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    const status =
      existing === "granted" ? existing : (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase
      .from("push_tokens")
      .upsert({ token, user_id: userId, platform: Platform.OS === "ios" ? "ios" : "android" });
  } catch (e) {
    console.warn("Push registration skipped:", e);
  }
}
