import { Stack } from 'expo-router';

export default function CaptureLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerTintColor: '#2d6a4f' }}>
      <Stack.Screen name="index" options={{ title: 'Capture' }} />
      <Stack.Screen name="text" options={{ title: 'Text log' }} />
      <Stack.Screen name="voice" options={{ title: 'Voice log' }} />
      <Stack.Screen name="photo" options={{ title: 'Photo log' }} />
    </Stack>
  );
}
