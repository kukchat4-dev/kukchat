import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { db } from '../firebaseConfig';

export default function LoginScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (userId.length !== 10) {
      alert('Secure ID must be exactly 10 digits.');
      return;
    }
    if (pin.length < 4) {
      alert('PIN must be at least 4 digits.');
      return;
    }

    setLoading(true);
    Keyboard.dismiss(); // Instantly hides the keyboard when processing starts

    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.pin === pin) {
          await AsyncStorage.setItem('currentUserId', userId);
          router.replace('/home');
        } else {
          alert('❌ Incorrect PIN.');
        }
      } else {
        // Automatically registers a new vault agent if the ID doesn't exist yet
        await setDoc(userRef, {
          id: userId,
          pin: pin,
          name: `Agent ${userId.substring(0, 4)}`, // Sets a default name
          photoBase64: null
        });
        await AsyncStorage.setItem('currentUserId', userId);
        router.replace('/home');
      }
    } catch (error) {
      console.error(error);
      alert('❌ Connection error. Check your database rules.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Allows tapping the background to close the keyboard */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        
        {/* Automatically pushes the login box up so the keyboard doesn't hide it */}
        <KeyboardAvoidingView 
          style={styles.innerContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.card}>
            <Text style={styles.title}>KuKa Hub</Text>
            <Text style={styles.subtitle}>Secure Vault Access</Text>

            <TextInput
              style={styles.input}
              placeholder="10-Digit Secure ID"
              placeholderTextColor="#64748B"
              value={userId}
              onChangeText={setUserId}
              keyboardType="numeric"
              maxLength={10}
              returnKeyType="next"
            />

            <TextInput
              style={styles.input}
              placeholder="Enter PIN"
              placeholderTextColor="#64748B"
              secureTextEntry={true}
              value={pin}
              onChangeText={setPin}
              keyboardType="numeric"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={handleLogin} // THE MAGIC FIX: Fires login when hitting Done
            />

            <TouchableOpacity 
              style={styles.loginButton} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.loginButtonText}>Enter Vault</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E293B',
    padding: 30,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 15,
  },
  loginButton: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});