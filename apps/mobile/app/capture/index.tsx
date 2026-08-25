import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const INTENTS = [
  { href: '/capture/voice' as const, label: 'Voice log', icon: '🎤' },
  { href: '/capture/text' as const, label: 'Text log', icon: '✏️' },
  { href: '/capture/photo' as const, label: 'Photo', icon: '📷' },
  { href: '/capture/sensor' as const, label: 'Sensor', icon: '📊' },
];

export default function CaptureIndexScreen() {
  return (
    <View style={styles.container}>
      {INTENTS.map((item) => (
        <Pressable key={item.href} style={styles.row} onPress={() => router.push(item.href)}>
          <Text style={styles.icon}>{item.icon}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.cancel} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8ead9',
  },
  icon: { fontSize: 22 },
  label: { fontSize: 17, fontWeight: '600', color: '#1b4332' },
  cancel: { marginTop: 16, alignItems: 'center', padding: 12 },
  cancelText: { color: '#6b7280', fontSize: 16 },
});
