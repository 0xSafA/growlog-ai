import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

const LINKS = [
  { href: '/(tabs)/more/photos' as const, label: 'Photos', desc: 'Capture and upload images' },
  { href: '/(tabs)/more/sensors' as const, label: 'Sensors', desc: 'Manual sensor readings' },
  { href: '/(tabs)/more/reports' as const, label: 'Reports', desc: 'Generate and view reports' },
  { href: '/(tabs)/more/settings' as const, label: 'Settings', desc: 'Farm, scope, sync, account' },
];

export default function MoreHubScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {LINKS.map((link) => (
        <Pressable key={link.href} style={styles.row} onPress={() => router.push(link.href)}>
          <Text style={styles.label}>{link.label}</Text>
          <Text style={styles.desc}>{link.desc}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120, gap: 10 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d8ead9',
  },
  label: { fontSize: 17, fontWeight: '600', color: '#1b4332' },
  desc: { fontSize: 13, color: '#52796f', marginTop: 4 },
});
