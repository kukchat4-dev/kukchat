import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function CallScreen() {
  const router = useRouter();
  const { friendId, friendName, callType } = useLocalSearchParams();

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>('Vault User');
  const [isReady, setIsReady] = useState(false);

  const ZegoAppID = 237453259; 
  const ZegoAppSign = '8ba15d8772a464ecfab7a773419d442760a98b36ddbf86986f2ff0a431c51825'; 

  useEffect(() => {
    const initializeCall = async () => {
      const storedId = await AsyncStorage.getItem('currentUserId');
      if (!storedId) {
        router.back();
        return;
      }
      setMyUserId(storedId);
      setMyName('Vault ID: ' + storedId);
      setIsReady(true);
    };

    initializeCall();
  }, []);

  if (!isReady || !myUserId) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0095F6" />
        <Text style={styles.loadingText}>Securing Connection...</Text>
      </View>
    );
  }

  // Web Browser Fallback (Native Calling runs on Android/iOS APK builds)
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.webFallbackContainer}>
          <Text style={styles.webTitle}>🔐 Encrypted Call Vault</Text>
          <Text style={styles.webSubtitle}>
            Native background audio & video calling with lock-screen wake is active for Android/iOS builds.
          </Text>
          <Text style={styles.callDetails}>
            Connecting to: {friendName || friendId} ({callType === 'video' ? 'Video Call' : 'Voice Call'})
          </Text>
          <View style={styles.btnRow}>
            <Text style={styles.hangupBtn} onPress={() => router.back()}>
              End Session
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Native Mobile Engine
  const { ZegoUIKitPrebuiltCall, ONE_ON_ONE_VIDEO_CALL_CONFIG, ONE_ON_ONE_VOICE_CALL_CONFIG } = require('@zegocloud/zego-uikit-prebuilt-call-rn');
  const callRoomId = [myUserId, friendId].sort().join('_');

  return (
    <SafeAreaView style={styles.container}>
      <ZegoUIKitPrebuiltCall
        appID={ZegoAppID}
        appSign={ZegoAppSign}
        userID={myUserId}
        userName={myName}
        callID={callRoomId}
        config={{
          ...(callType === 'video' ? ONE_ON_ONE_VIDEO_CALL_CONFIG : ONE_ON_ONE_VOICE_CALL_CONFIG),
          onCallEnd: () => {
            router.back();
          },
          layout: {
            mode: 'pictureInPicture',
          },
          bottomMenuBarConfig: {
            maxCount: 5,
            buttons: ['toggleCameraButton', 'toggleMicrophoneButton', 'switchCameraButton', 'hangUpButton', 'switchAudioOutputButton'],
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loadingContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFF', marginTop: 15, fontSize: 16, fontWeight: 'bold' },
  webFallbackContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  webTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginBottom: 10, textShadowColor: 'rgba(255,255,255,0.8)', textShadowRadius: 10 },
  webSubtitle: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: 14, lineHeight: 22, marginBottom: 25 },
  callDetails: { color: '#0095F6', fontSize: 16, fontWeight: '600', marginBottom: 30 },
  btnRow: { marginTop: 20 },
  hangupBtn: { backgroundColor: '#ED4956', color: '#FFF', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 25, fontWeight: 'bold', overflow: 'hidden', cursor: 'pointer' }
});