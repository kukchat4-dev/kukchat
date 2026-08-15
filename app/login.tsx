import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function LoginScreen() {
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  
  // NEW: State for the custom username
  const [username, setUsername] = useState('');
  
  const [statusMessage, setStatusMessage] = useState(''); 
  const [isLoginMode, setIsLoginMode] = useState(true);
  const router = useRouter(); 

  const handleAuth = async () => {
    setStatusMessage('Checking...'); 

    if (userId.length !== 10) {
      setStatusMessage('❌ Error: User ID must be exactly 10 digits.');
      return;
    }
    if (pin.length !== 4) {
      setStatusMessage('❌ Error: PIN must be exactly 4 digits.');
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (isLoginMode) {
        // --- LOGIN FLOW ---
        if (userSnap.exists()) {
          if (userSnap.data().pin === pin) {
            await AsyncStorage.setItem('currentUserId', userId);
            setStatusMessage('✅ Success! Unlocking Vault...');
            setTimeout(() => { router.push('/home'); }, 500); 
          } else {
            setStatusMessage('❌ Error: Incorrect PIN.');
          }
        } else {
          setStatusMessage('❌ Error: Account not found. Please create one.');
        }

      } else {
        // --- CREATE ACCOUNT FLOW ---
        if (!username.trim()) {
          setStatusMessage('❌ Error: Please enter a username.');
          return;
        }

        if (userSnap.exists()) {
          setStatusMessage('❌ Error: This 10-digit ID is already taken.');
        } else {
          setStatusMessage('⚙️ Creating new secure account...');
          
          // NEW: Saves the actual username they typed in!
          await setDoc(userRef, {
            pin: pin,
            name: username, 
            createdAt: new Date().toISOString(),
          });
          
          await AsyncStorage.setItem('currentUserId', userId);

          setStatusMessage('✅ Account Created! Unlocking Vault...');
          setTimeout(() => { router.push('/home'); }, 500); 
        }
      }
    } catch (error) {
      console.error(error);
      setStatusMessage('⚠️ Database Error: Check terminal or F12 console.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollCenter}>
        <View style={styles.card}>
          <Text style={styles.title}>{isLoginMode ? 'Welcome Back' : 'Create Vault'}</Text>
          <Text style={styles.subtitle}>{isLoginMode ? 'Enter your 10-digit ID and 4-digit PIN' : 'Choose a unique 10-digit ID, PIN, and Username'}</Text>

          {/* NEW: Only show Username box if they are creating an account */}
          {!isLoginMode && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput 
                style={styles.input} 
                placeholder="How should friends see you?" 
                placeholderTextColor="#64748B" 
                value={username} 
                onChangeText={setUsername} 
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>10-Digit User ID</Text>
            <TextInput style={styles.input} placeholder="Enter 10-digit number" placeholderTextColor="#64748B" keyboardType="numeric" maxLength={10} value={userId} onChangeText={setUserId} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>4-Digit PIN</Text>
            <TextInput style={styles.input} placeholder="••••" placeholderTextColor="#64748B" keyboardType="numeric" secureTextEntry={true} maxLength={4} value={pin} onChangeText={setPin} />
          </View>

          {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleAuth}>
            <Text style={styles.buttonText}>{isLoginMode ? 'Login to Vault' : 'Create Account'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toggleButton} onPress={() => { 
            setIsLoginMode(!isLoginMode); 
            setStatusMessage(''); 
            setUserId(''); 
            setPin(''); 
            setUsername(''); 
          }}>
            <Text style={styles.toggleText}>{isLoginMode ? "Don't have an account? Create one." : "Already have an account? Login here."}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  scrollCenter: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#1E293B', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#94A3B8', marginBottom: 24, textAlign: 'center' },
  inputGroup: { marginBottom: 16 },
  label: { color: '#CBD5E1', fontSize: 14, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: '#0F172A', color: '#FFF', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: '#334155' },
  statusText: { color: '#FBBF24', fontSize: 14, textAlign: 'center', marginBottom: 12, fontWeight: 'bold' },
  button: { backgroundColor: '#6366F1', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  toggleButton: { marginTop: 20, alignItems: 'center' },
  toggleText: { color: '#94A3B8', fontSize: 14, textDecorationLine: 'underline' },
});