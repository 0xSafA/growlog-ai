import { speakVoice } from '@growlog/api-client';
import { Audio } from 'expo-av';
import { File, Paths } from 'expo-file-system';

let activeSound: Audio.Sound | null = null;

export async function speakText(token: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  if (activeSound) {
    await activeSound.unloadAsync();
    activeSound = null;
  }

  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

  const buffer = await speakVoice(token, trimmed);
  const file = new File(Paths.cache, `growlog-tts-${Date.now()}.mp3`);
  file.create();
  file.write(new Uint8Array(buffer));

  const { sound } = await Audio.Sound.createAsync({ uri: file.uri });
  activeSound = sound;
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      void sound.unloadAsync();
      if (activeSound === sound) activeSound = null;
      try {
        file.delete();
      } catch {
        // cache cleanup best-effort
      }
    }
  });
  await sound.playAsync();
}

export async function stopSpeaking(): Promise<void> {
  if (!activeSound) return;
  await activeSound.stopAsync();
  await activeSound.unloadAsync();
  activeSound = null;
}
