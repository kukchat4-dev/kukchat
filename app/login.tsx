import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../firebaseConfig';

// NEW: Import our custom cryptography engine!
import { generateRSAKeys } from './cryptoEngine';

export default function LoginScreen() {
  const router = useRouter();
  
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  
  // NEW: State to handle the heavy key-generation loading time
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');

  useEffect(() => {
    // Check if we are already logged in and have our private key
    const checkExistingSession = async () => {
      const storedId = await AsyncStorage.getItem('currentUserId');
      const storedPrivateKey = await AsyncStorage.getItem('privateKey');
      
      if (storedId && storedPrivateKey) {
        router.replace('/home');
      }
    };
    checkExistingSession();
  }, []);

  const handleLogin = async () => {
    if (userId.length !== 10) {
      alert('Vault ID must be exactly 10 digits.');
      return;
    }
    if (!userName.trim()) {
      alert('Please enter your alias.');
      return;
    }

    setIsAuthenticating(true);
    setLoadingStatus('Connecting to secure servers...');

    try {
      // 1. Check if the user already exists in Firebase
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      // 2. We need to generate a NEW set of RSA keys for this device
      setLoadingStatus('Forging RSA-2048 Encryption Keys... (This may take a few seconds)');
      
      // Wait for the math engine to create the keys
      const { publicKey, privateKey } = await generateRSAKeys();

      // 3. Save the PRIVATE key locally (Never let this touch Firebase!)
      await AsyncStorage.setItem('privateKey', privateKey);
      await AsyncStorage.setItem('currentUserId', userId);

      // 4. Save the PUBLIC key to Firebase so friends can encrypt messages for you
      if (userSnap.exists()) {
        // Update existing user with their new public key
        await setDoc(userRef, { 
          name: userName,
          publicKey: publicKey, 
          lastLogin: serverTimestamp()
        }, { merge: true });
      } else {
        // Register a brand new user
        await setDoc(userRef, {
          name: userName,
          publicKey: publicKey,
          photoBase64: null,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });
      }

      setLoadingStatus('Vault unlocked.');
      router.replace('/home');

    } catch (error) {
      console.error("Login Error:", error);
      alert('❌ Failed to authenticate.');
      setIsAuthenticating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>KuKa Hub</Text>
        <Text style={styles.subtitle}>End-to-End Encrypted Vault</Text>
        
        {isAuthenticating ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>{loadingStatus}</Text>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="10-Digit Secure ID"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              maxLength={10}
              value={userId}
              onChangeText={setUserId}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Alias (e.g., Sourabh)"
              placeholderTextColor="#64748B"
              value={userName}
              onChangeText={setUserName}
            />
            
            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
              <Text style={styles.loginButtonText}>Enter Vault</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  card: { width: '85%', backgroundColor: '#1E293B', padding: 30, borderRadius: 20, borderWidth: 1, borderColor: '#334155', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 10 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FFF', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#6366F1', fontWeight: 'bold', marginBottom: 30, textTransform: 'uppercase', letterSpacing: 1 },
  
  input: { width: '100%', backgroundColor: '#0F172A', color: '#FFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#334155', fontSize: 16, marginBottom: 15, textAlign: 'center' },
  
  loginButton: { width: '100%', backgroundColor: '#6366F1', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  loginButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
  
  loadingContainer: { alignItems: 'center', marginVertical: 20 },
  loadingText: { color: '#94A3B8', marginTop: 15, textAlign: 'center', lineHeight: 22, fontSize: 14, fontStyle: 'italic' }
});