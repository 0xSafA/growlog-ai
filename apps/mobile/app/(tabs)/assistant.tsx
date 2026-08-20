import { StyleSheet, Text, View } from 'react-native';

export default function AssistantScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Assistant</Text>
      <Text style={styles.body}>
        Grounded Q&A coming in Phase 2. Configure EXPO_PUBLIC_API_BASE_URL to reach the advisor API.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingBottom: 120 },
  title: { fontSize: 20, fontWeight: '700', color: '#1b4332', marginBottom: 8 },
  body: { fontSize: 15, color: '#52796f', lineHeight: 22 },
});
