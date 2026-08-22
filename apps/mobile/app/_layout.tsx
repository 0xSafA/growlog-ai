import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { FarmProvider, useFarmContext } from '@/providers/FarmProvider';
import { OfflineSyncProvider } from '@/providers/OfflineSyncProvider';
import { attachNotificationListeners, registerForPushNotifications } from '@/lib/notifications';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <FarmProvider>
        <OfflineSyncProvider>
          <AuthGate />
          <NotificationBootstrap />
          <RootStack />
        </OfflineSyncProvider>
      </FarmProvider>
    </QueryClientProvider>
  );
}

function NotificationBootstrap() {
  const { userId } = useFarmContext();

  useEffect(() => {
    if (!userId) return;
    void registerForPushNotifications().catch(() => undefined);
    return attachNotificationListeners();
  }, [userId]);

  return null;
}

function AuthGate() {
  const { userId, authLoading, farmListReady, farms } = useFarmContext();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';

    if (!userId && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }

    if (userId && inAuth) {
      if (farmListReady && farms.length === 0) {
        router.replace('/(onboarding)');
      } else {
        router.replace('/(tabs)');
      }
      return;
    }

    if (userId && !inOnboarding && farmListReady && farms.length === 0) {
      router.replace('/(onboarding)');
    }
  }, [authLoading, userId, farmListReady, farms.length, segments, router]);

  return null;
}

function RootStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="capture" options={{ presentation: 'modal' }} />
      <Stack.Screen name="sop" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
