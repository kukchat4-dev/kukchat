import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 🛑 THE MAGIC BRIDGE 🛑
// Vercel automatically loads ZegoEngine.web.tsx (dummy).
// Your Phone automatically loads ZegoEngine.native.tsx (real).
import { ONE_ON_ONE_VIDEO_CALL_CONFIG, ONE_ON_ONE_VOICE_CALL_CONFIG, ZegoUIKitPrebuiltCall } from '../components/ZegoEngine';

export default function CallScreen() {
  const router = useRouter();
  const { friendId, friendName, callType } = useLocalSearchParams();
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const ZegoAppID = 237453259; 
  const ZegoAppSign = '8ba15d8772a464ecfab7a773419d442760a98b36ddbf86986f2ff0a431c51825'; 

  useEffect(() => {
    AsyncStorage.getItem('currentUserId').then((id) => {
      if (!id) router.back();
      else setMyUserId(id);
    });
  }, []);

  if (!myUserId) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0095F6" />
      </View>
    );
  }

  // --- 🌐 VERCEL WEB UI ---
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.webContainer}>
        <View style={styles.webContent}>
          <View style={styles.avatarCircle}>
            <Ionicons name={callType === 'video' ? "videocam" : "call"} size={48} color="#FFF" />
          </View>
          <Text style={styles.webTitle}>Encrypted {callType === 'video' ? 'Video' : 'Audio'} Call</Text>
          <Text style={styles.webSubtitle}>Connecting to {friendName || friendId}...</Text>
          <Text style={styles.webNote}>Lock-screen wake and Bluetooth routing are only active on the native Android/iOS Vault app.</Text>
          <TouchableOpacity style={styles.endBtn} onPress={() => router.back()}>
            <Ionicons name="call" size={24} color="#FFF" style={{ transform: [{ rotate: '135deg' }], marginRight: 8 }} />
            <Text style={styles.endBtnText}>End Call</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- 📱 NATIVE MOBILE UI ---
  const callRoomId = [myUserId, friendId].sort().join('_');

  return (
    <SafeAreaView style={styles.container}>
      <ZegoUIKitPrebuiltCall
        appID={ZegoAppID}
        appSign={ZegoAppSign}
        userID={myUserId}
        userName={'Vault ID: ' + myUserId}
        callID={callRoomId}
        config={{
          ...(callType === 'video' ? ONE_ON_ONE_VIDEO_CALL_CONFIG : ONE_ON_ONE_VOICE_CALL_CONFIG),
          onCallEnd: () => router.back(),
          layout: { mode: 'pictureInPicture' },
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
  
  webContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  webContent: { alignItems: 'center', paddingHorizontal: 30, maxWidth: 450 },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#111', borderWidth: 1, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#FFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  webTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 8, textShadowColor: 'rgba(255,255,255,0.8)', textShadowRadius: 8 },
  webSubtitle: { color: '#A0A0A0', fontSize: 16, marginBottom: 20 },
  webNote: { color: '#666', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 35 },
  endBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ED4956', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 30, shadowColor: '#ED4956', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8 },
  endBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});