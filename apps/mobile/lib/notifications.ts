import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function permissionsGranted(
  settings: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>
): boolean {
  const s = settings as { granted?: boolean; ios?: { status: Notifications.IosAuthorizationStatus } };
  if (s.granted) return true;
  return (
    s.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    s.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let allowed = permissionsGranted(existing);
  if (!allowed) {
    const result = await Notifications.requestPermissionsAsync();
    allowed = permissionsGranted(result);
  }
  if (!allowed) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('sop', {
      name: 'SOP reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  const token = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
  return token.data;
}

export function handleNotificationDeepLink(data: Record<string, unknown> | undefined) {
  if (!data) return;
  const type = data.type;
  if (type === 'sop_due' || type === 'sop_overdue') {
    const sopRunId = data.sopRunId;
    if (typeof sopRunId === 'string') {
      router.push(`/sop/run/${sopRunId}`);
    }
    return;
  }
  if (type === 'anomaly') {
    router.push('/(tabs)');
  }
}

export function attachNotificationListeners() {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationDeepLink(
      response.notification.request.content.data as Record<string, unknown>
    );
  });
  return () => sub.remove();
}

/** Local demo notification for SOP testing without backend push infra. */
export async function scheduleLocalSopReminder(params: {
  sopRunId: string;
  title: string;
  seconds?: number;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'SOP due',
      body: params.title,
      data: { type: 'sop_due', sopRunId: params.sopRunId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: params.seconds ?? 5,
    },
  });
}
