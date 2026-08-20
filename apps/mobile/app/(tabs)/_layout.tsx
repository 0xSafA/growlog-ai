import { CaptureFab } from '@/components/layout/CaptureFab';
import { ScopeBar } from '@/components/layout/ScopeBar';
import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#2d6a4f',
          tabBarInactiveTintColor: '#9ca3af',
          headerStyle: { backgroundColor: '#eef5ef' },
          headerTitleStyle: { fontWeight: '600' },
          tabBarStyle: {
            paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 4,
            height: 56 + (insets.bottom > 0 ? insets.bottom : 0),
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Focus',
            tabBarIcon: ({ color }) => (
              <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={24} />
            ),
            headerTitle: 'Daily Focus',
            header: () => (
              <View style={{ backgroundColor: '#eef5ef', paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 8 }}>
                <ScopeBar />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="timeline"
          options={{
            title: 'Timeline',
            tabBarIcon: ({ color }) => (
              <SymbolView name={{ ios: 'list.bullet', android: 'list', web: 'list' }} tintColor={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="assistant"
          options={{
            title: 'AI',
            tabBarIcon: ({ color }) => (
              <SymbolView name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'chat', web: 'chat' }} tintColor={color} size={24} />
            ),
            headerTitle: 'Assistant',
          }}
        />
        <Tabs.Screen
          name="sop"
          options={{
            title: 'SOP',
            tabBarIcon: ({ color }) => (
              <SymbolView name={{ ios: 'checklist', android: 'checklist', web: 'checklist' }} tintColor={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color }) => (
              <SymbolView name={{ ios: 'ellipsis.circle', android: 'more_horiz', web: 'more_horiz' }} tintColor={color} size={24} />
            ),
          }}
        />
      </Tabs>
      <CaptureFab />
    </View>
  );
}
