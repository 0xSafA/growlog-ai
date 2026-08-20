import { StyleSheet, Text, View } from 'react-native';

export default function SopScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SOP</Text>
      <Text style={styles.body}>Procedure list and execution dialog — Phase 2.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingBottom: 120 },
  title: { fontSize: 20, fontWeight: '700', color: '#1b4332', marginBottom: 8 },
  body: { fontSize: 15, color: '#52796f', lineHeight: 22 },
});
