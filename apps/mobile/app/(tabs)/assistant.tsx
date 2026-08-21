import { AdvisorChat } from '@/components/assistant/AdvisorChat';
import { View } from 'react-native';

export default function AssistantScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#f4faf5' }}>
      <AdvisorChat />
    </View>
  );
}
