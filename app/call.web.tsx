import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CallScreenWeb() {
  const router = useRouter();
  const { friendId, friendName, callType } = useLocalSearchParams();
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('currentUserId').then((id) => {
      if (!id) router.back();
      else setMyUserId(id);
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatarCircle}>
          <Ionicons name={callType === 'video' ? "videocam" : "call"} size={48} color="#FFF" />
        </View>
        <Text style={styles.title}>Encrypted {callType === 'video' ? 'Video' : 'Audio'} Call</Text>
        <Text style={styles.subtitle}>Connecting to {friendName || friendId}...</Text>
        <Text style={styles.note}>Lock-screen wake and Bluetooth routing are only active on the native Android/iOS app.</Text>
        <TouchableOpacity style={styles.endBtn} onPress={() => router.back()}>
          <Ionicons name="call" size={24} color="#FFF" style={{ transform: [{ rotate: '135deg' }], marginRight: 8 }} />
          <Text style={styles.endBtnText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 30, maxWidth: 450 },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#111', borderWidth: 1, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 8, textShadowColor: 'rgba(255,255,255,0.8)', textShadowRadius: 8 },
  subtitle: { color: '#A0A0A0', fontSize: 16, marginBottom: 20 },
  note: { color: '#666', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 35 },
  endBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ED4956', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 30, shadowColor: '#ED4956', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8 },
  endBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});