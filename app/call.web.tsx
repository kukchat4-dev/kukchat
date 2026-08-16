import AsyncStorage from '@react-native-async-storage/async-storage';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function CallScreenWeb() {
  const router = useRouter();
  const { friendId, callType } = useLocalSearchParams();
  const [myUserId, setMyUserId] = useState<string | null>(null);
  
  const videoContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('currentUserId').then((id) => {
      if (!id) router.back();
      else setMyUserId(id);
    });
  }, []);

  useEffect(() => {
    if (!myUserId || !videoContainerRef.current) return;

    const initializeWebCall = async () => {
      const appID = 237453259;
      
      // Your injected ZegoCloud Server Secret
      const serverSecret = "d1863d8073abbd7120d4e50f62be17f7"; 
      
      const roomID = [myUserId, friendId].sort().join('_'); 

      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID, 
        serverSecret, 
        roomID, 
        myUserId, 
        'Vault ID: ' + myUserId
      );

      const zegoInstance = ZegoUIKitPrebuilt.create(kitToken);
      
      zegoInstance.joinRoom({
        container: videoContainerRef.current,
        scenario: {
          mode: ZegoUIKitPrebuilt.OneONoneCall,
        },
        turnOnMicrophoneWhenJoining: true,
        turnOnCameraWhenJoining: callType === 'video',
        showPreJoinView: false,
        onLeaveRoom: () => {
          router.back();
        },
      });
    };

    initializeWebCall();
  }, [myUserId]);

  if (!myUserId) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0095F6" />
        <Text style={styles.loadingText}>Securing Web Connection...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* @ts-ignore */}
      <div 
        ref={videoContainerRef} 
        style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFF', marginTop: 15, fontSize: 16, fontWeight: 'bold' }
});