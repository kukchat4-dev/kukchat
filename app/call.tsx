import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONE_ON_ONE_VIDEO_CALL_CONFIG, ONE_ON_ONE_VOICE_CALL_CONFIG, ZegoUIKitPrebuiltCall } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function CallScreen() {
  const router = useRouter();
  const { friendId, friendName, callType } = useLocalSearchParams();

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>('Vault User');
  const [isReady, setIsReady] = useState(false);

  // YOUR SECURE ZEGOCLOUD CREDENTIALS
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
      
      // Setting your identity for the call room
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

  // Create a unique, repeatable Room ID based on your two IDs
  const callRoomId = [myUserId, friendId].sort().join('_');

  return (
    <SafeAreaView style={styles.container}>
      <ZegoUIKitPrebuiltCall
        appID={ZegoAppID}
        appSign={ZegoAppSign}
        userID={myUserId}
        userName={myName}
        callID={callRoomId}
        
        // Dynamically switch between Audio or Video config based on the button clicked
        config={{
          ...(callType === 'video' ? ONE_ON_ONE_VIDEO_CALL_CONFIG : ONE_ON_ONE_VOICE_CALL_CONFIG),
          onCallEnd: (callID, reason, duration) => {
            // Automatically route back to the chat vault when the call ends
            router.back();
          },
          // Customizing the UI to match your Dark Vault aesthetic
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
  container: { 
    flex: 1, 
    backgroundColor: '#000000' 
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#FFF',
    marginTop: 15,
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10
  }
});