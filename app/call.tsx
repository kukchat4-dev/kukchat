import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, View } from 'react-native';

export default function CallScreen() {
  const router = useRouter();
  const { friendId, callType } = useLocalSearchParams();
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

  // 🛑 NUCLEAR OPTION: If this is running on the web, stop executing this file entirely.
  // Vercel will use call.web.tsx instead.
  if (Platform.OS === 'web') {
    return <View style={styles.container} />;
  }

  // 📱 NATIVE MOBILE ENGINE: We use a dynamic require() INSIDE the component.
  // The Vercel static scanner cannot read inside this block, so it will not crash!
  const { ZegoUIKitPrebuiltCall, ONE_ON_ONE_VIDEO_CALL_CONFIG, ONE_ON_ONE_VOICE_CALL_CONFIG } = require('@zegocloud/zego-uikit-prebuilt-call-rn');

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
  loadingContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }
});