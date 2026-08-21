import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: '#2d6a4f' }}>
      <Stack.Screen name="index" options={{ title: 'More' }} />
      <Stack.Screen name="photos" options={{ title: 'Photos' }} />
      <Stack.Screen name="sensors" options={{ title: 'Sensors' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
    </Stack>
  );
}
