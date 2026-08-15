import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../firebaseConfig';

// Importing our military-grade cryptography engine
import { generateRSAKeys, hashSecurityPIN } from './cryptoEngine';

export default function LoginScreen() {
  const router = useRouter();
  
  // UI States
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');

  // Form Data
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const checkExistingSession = async () => {
      const storedId = await AsyncStorage.getItem('currentUserId');
      const storedPrivateKey = await AsyncStorage.getItem('privateKey');
      
      if (storedId && storedPrivateKey) {
        router.replace('/home');
      }
    };
    checkExistingSession();
  }, []);

  const handleAuthentication = async () => {
    // 1. Basic Form Validation
    if (userId.length !== 10) {
      alert('Vault ID must be exactly 10 digits.');
      return;
    }
    if (pin.length !== 4) {
      alert('Security PIN must be exactly 4 digits.');
      return;
    }
    if (!isLoginMode && !userName.trim()) {
      alert('Please enter your alias.');
      return;
    }

    setIsAuthenticating(true);
    setLoadingStatus(isLoginMode ? 'Verifying Credentials...' : 'Establishing Secure Profile...');

    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      // ==========================================
      // ROUTE A: CREATING A NEW ACCOUNT
      // ==========================================
      if (!isLoginMode) {
        if (userSnap.exists()) {
          alert('❌ This 10-Digit ID is already registered. Please log in.');
          setIsAuthenticating(false);
          return;
        }

        setLoadingStatus('Forging RSA-2048 Encryption Keys...');
        const { publicKey, privateKey } = await generateRSAKeys();

        // Save local private key
        await AsyncStorage.setItem('privateKey', privateKey);
        await AsyncStorage.setItem('currentUserId', userId);

        // Save public data to Firebase with HASHED PIN
        await setDoc(userRef, {
          name: userName,
          pin: hashSecurityPIN(pin), // The PIN is securely hashed here
          publicKey: publicKey,
          photoBase64: null,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });

        setLoadingStatus('Vault Unlocked.');
        router.replace('/home');
      } 
      // ==========================================
      // ROUTE B: LOGGING IN TO EXISTING ACCOUNT
      // ==========================================
      else {
        if (!userSnap.exists()) {
          alert('❌ Vault ID not found. Please create an account.');
          setIsAuthenticating(false);
          return;
        }

        const databaseUser = userSnap.data();
        const enteredHash = hashSecurityPIN(pin);

        // Security Check: Does the entered PIN match the database?
        if (enteredHash !== databaseUser.pin) {
          alert('❌ Incorrect Security PIN.');
          setIsAuthenticating(false);
          return;
        }

        // If they logged in successfully, check if this device has the Private Key
        const storedPrivateKey = await AsyncStorage.getItem('privateKey');
        
        if (!storedPrivateKey) {
          // If they changed phones or cleared cache, they need new keys
          setLoadingStatus('New device detected. Forging new RSA Keys...');
          const { publicKey, privateKey } = await generateRSAKeys();
          
          await AsyncStorage.setItem('privateKey', privateKey);
          await AsyncStorage.setItem('currentUserId', userId);
          
          // Update the database with their new public lock
          await setDoc(userRef, { publicKey: publicKey, lastLogin: serverTimestamp() }, { merge: true });
        } else {
          await AsyncStorage.setItem('currentUserId', userId);
          await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
        }

        setLoadingStatus('Vault Unlocked.');
        router.replace('/home');
      }

    } catch (error) {
      console.error("Auth Error:", error);
      alert('❌ Failed to authenticate.');
      setIsAuthenticating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <View style={styles.card}>
          <Text style={styles.title}>KuKa Hub</Text>
          <Text style={styles.subtitle}>{isLoginMode ? 'Vault Access' : 'New Vault Registration'}</Text>
          
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
              
              {!isLoginMode && (
                <TextInput
                  style={styles.input}
                  placeholder="Alias (e.g., Sourabh)"
                  placeholderTextColor="#64748B"
                  value={userName}
                  onChangeText={setUserName}
                />
              )}

              <TextInput
                style={styles.input}
                placeholder="4-Digit PIN"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry={true}
                value={pin}
                onChangeText={setPin}
              />
              
              <TouchableOpacity style={styles.loginButton} onPress={handleAuthentication}>
                <Text style={styles.loginButtonText}>{isLoginMode ? 'Enter Vault' : 'Initialize Vault'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.switchModeBtn} onPress={() => {
                setIsLoginMode(!isLoginMode);
                setPin('');
                setUserId('');
                setUserName('');
              }}>
                <Text style={styles.switchModeText}>
                  {isLoginMode ? "Don't have an ID? Create one" : "Already have an ID? Log in"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  keyboardView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { width: '85%', backgroundColor: '#1E293B', padding: 30, borderRadius: 20, borderWidth: 1, borderColor: '#334155', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 10 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FFF', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#6366F1', fontWeight: 'bold', marginBottom: 30, textTransform: 'uppercase', letterSpacing: 1 },
  
  input: { width: '100%', backgroundColor: '#0F172A', color: '#FFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#334155', fontSize: 16, marginBottom: 15, textAlign: 'center' },
  
  loginButton: { width: '100%', backgroundColor: '#6366F1', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  loginButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
  
  switchModeBtn: { marginTop: 25, padding: 10 },
  switchModeText: { color: '#94A3B8', fontSize: 14, textDecorationLine: 'underline' },

  loadingContainer: { alignItems: 'center', marginVertical: 20 },
  loadingText: { color: '#94A3B8', marginTop: 15, textAlign: 'center', lineHeight: 22, fontSize: 14, fontStyle: 'italic' }
});