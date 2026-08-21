import { Stack } from 'expo-router';

export default function ReportsLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: '#2d6a4f' }}>
      <Stack.Screen name="index" options={{ title: 'Reports' }} />
      <Stack.Screen name="[id]" options={{ title: 'Report' }} />
    </Stack>
  );
}
