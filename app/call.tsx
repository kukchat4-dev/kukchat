import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONE_ON_ONE_VIDEO_CALL_CONFIG, ONE_ON_ONE_VOICE_CALL_CONFIG, ZegoUIKitPrebuiltCall } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';

export default function CallScreenNative() {
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