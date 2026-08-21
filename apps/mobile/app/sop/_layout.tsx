import { Stack } from 'expo-router';

export default function SopStackLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: '#2d6a4f' }}>
      <Stack.Screen name="run/[id]" options={{ title: 'SOP execution' }} />
    </Stack>
  );
}
