import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function VaultLogin() {
  const [vaultId, setVaultId] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();

  // 1. When the app opens, check if they are already logged in
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const storedId = await AsyncStorage.getItem('currentUserId');
        if (storedId) {
          // If they already unlocked it before, skip this screen instantly
          router.replace('/home'); 
        } else {
          setIsChecking(false);
        }
      } catch (error) {
        setIsChecking(false);
      }
    };
    checkLoginStatus();
  }, []);

  // 2. The function to lock in their ID and enter the app
  const handleUnlock = async () => {
    if (vaultId.trim() === '') return;

    try {
      // Save their ID to the phone's physical hard drive
      await AsyncStorage.setItem('currentUserId', vaultId.trim());
      
      // Push them through the vault door to the home screen
      router.replace('/home');
    } catch (error) {
      console.error("Failed to secure ID:", error);
    }
  };

  if (isChecking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0095F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>VAULT ACCESS</Text>
        <Text style={styles.subtitle}>Enter your secure identification</Text>

        <TextInput
          style={styles.input}
          placeholder="Vault ID (e.g., 105)"
          placeholderTextColor="#555"
          value={vaultId}
          onChangeText={setVaultId}
          keyboardType="default"
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.button} onPress={handleUnlock}>
          <Text style={styles.buttonText}>UNLOCK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    backgroundColor: '#111',
    padding: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#000',
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#0095F6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
});