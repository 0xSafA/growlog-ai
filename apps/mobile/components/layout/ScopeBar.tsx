import { useFarmContext } from '@/providers/FarmProvider';
import { StyleSheet, Text, View } from 'react-native';

export function ScopeBar() {
  const { farms, farmId, cycle, primaryScope, loading } = useFarmContext();
  const farm = farms.find((f) => f.id === farmId);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.muted}>Loading context…</Text>
      </View>
    );
  }

  if (!farm || !cycle) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.muted}>Complete onboarding to set farm and cycle.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.text} numberOfLines={1}>
        {farm.name} › {cycle.name}
        {primaryScope ? ` › ${primaryScope.display_name}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 4,
  },
  text: {
    fontSize: 13,
    color: '#3d5c45',
  },
  muted: {
    fontSize: 13,
    color: '#6b7280',
  },
});
