import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function IndexScreen() {
  const router = useRouter();
  
  // States to control which screen is showing
  const [view, setView] = useState<'loading' | 'setupPin' | 'calculator' | 'login' | 'register'>('loading');
  
  // Secret PIN States
  const [secretPin, setSecretPin] = useState('');
  const [setupPinValue, setSetupPinValue] = useState('');

  // Calculator State
  const [calcDisplay, setCalcDisplay] = useState('');
  
  // Login & Register States
  const [userId, setUserId] = useState('');
  const [userPin, setUserPin] = useState('');
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if logged in or if secret PIN is already set
  useEffect(() => {
    const checkInitialState = async () => {
      const storedId = await AsyncStorage.getItem('currentUserId');
      if (storedId) {
        router.replace('/home');
        return;
      }

      const storedSecretPin = await AsyncStorage.getItem('secretVaultPin');
      if (storedSecretPin) {
        setSecretPin(storedSecretPin);
        setView('calculator');
      } else {
        setView('setupPin');
      }
    };
    checkInitialState();
  }, []);

  // --- SETUP SECRET PIN LOGIC ---
  const handleSaveSecretPin = async () => {
    if (setupPinValue.length < 4) {
      Alert.alert("Invalid", "Your secret PIN must be at least 4 digits long.");
      return;
    }
    await AsyncStorage.setItem('secretVaultPin', setupPinValue);
    setSecretPin(setupPinValue);
    setView('calculator');
  };

  // --- CALCULATOR LOGIC ---
  const handleCalcPress = (value: string) => {
    if (value === 'C') {
      setCalcDisplay('');
      return;
    }
    
    if (value === '=') {
      try {
        // Basic dummy calculator function
        const result = eval(calcDisplay);
        setCalcDisplay(String(result));
      } catch (error) {
        setCalcDisplay('Error');
      }
      return;
    }

    const newDisplay = calcDisplay + value;
    setCalcDisplay(newDisplay);

    // THE CUSTOM SECRET TRIGGER
    if (newDisplay === secretPin && secretPin !== '') {
      setCalcDisplay('');
      setUserId('');
      setUserPin('');
      setView('login');
    }
  };

  const renderCalcButton = (val: string, color = '#333', textColor = '#FFF') => (
    <TouchableOpacity 
      key={val} 
      style={[styles.calcButton, { backgroundColor: color }]} 
      onPress={() => handleCalcPress(val)}
    >
      <Text style={[styles.calcButtonText, { color: textColor }]}>{val}</Text>
    </TouchableOpacity>
  );

  // --- AUTH LOGIC ---
  const handleLogin = async () => {
    if (userId.length !== 10) return Alert.alert("Access Denied", "ID must be exactly 10 digits.");
    if (userPin.length !== 4) return Alert.alert("Access Denied", "PIN must be exactly 4 digits.");
    
    setIsLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('id', '==', userId), where('pin', '==', userPin));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        await AsyncStorage.setItem('currentUserId', querySnapshot.docs[0].id);
        await AsyncStorage.setItem('currentUserName', userData.name);
        router.replace('/home');
      } else {
        Alert.alert("Error", "Invalid ID or PIN.");
      }
    } catch (error) {
      Alert.alert("Network Error", "Could not connect to the Vault.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (userName.trim() === '') return Alert.alert("Required", "Please enter a display name.");
    if (userId.length !== 10) return Alert.alert("Required", "ID must be exactly 10 digits.");
    if (userPin.length !== 4) return Alert.alert("Required", "PIN must be exactly 4 digits.");

    setIsLoading(true);
    try {
      // Check if ID already exists
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('id', '==', userId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        Alert.alert("Error", "This 10-digit ID is already taken.");
        setIsLoading(false);
        return;
      }

      // Create new user
      const newUserRef = doc(collection(db, 'users'));
      await setDoc(newUserRef, {
        id: userId,
        pin: userPin,
        name: userName,
        createdAt: serverTimestamp()
      });

      await AsyncStorage.setItem('currentUserId', newUserRef.id);
      await AsyncStorage.setItem('currentUserName', userName);
      router.replace('/home');

    } catch (error) {
      Alert.alert("Registration Error", "Failed to create account.");
    } finally {
      setIsLoading(false);
    }
  };


  // --- VIEWS ---
  if (view === 'loading') {
    return <View style={styles.vaultContainer} />;
  }

  if (view === 'setupPin') {
    return (
      <SafeAreaView style={styles.vaultContainer}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.vaultKeyboardArea}>
          <View style={styles.vaultHeader}>
            <Text style={styles.vaultTitle}>INITIAL SETUP</Text>
            <Text style={styles.vaultSubtitle}>Set your Secret Calculator PIN</Text>
            <Text style={[styles.vaultSubtitle, { color: '#666', fontSize: 12, marginTop: 5, textAlign: 'center' }]}>
              You will type this number into the calculator to reveal the Vault login.
            </Text>
          </View>

          <View style={styles.vaultForm}>
            <TextInput
              style={styles.vaultInput}
              placeholder="Enter Secret PIN (e.g. 105105)"
              placeholderTextColor="#666"
              keyboardType="number-pad"
              secureTextEntry
              value={setupPinValue}
              onChangeText={setSetupPinValue}
            />
            <TouchableOpacity style={styles.vaultButton} onPress={handleSaveSecretPin}>
              <Text style={styles.vaultButtonText}>SAVE SECRET PIN</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (view === 'calculator') {
    return (
      <SafeAreaView style={styles.calcContainer}>
        <View style={styles.calcDisplayContainer}>
          <Text style={styles.calcDisplayText} numberOfLines={1} adjustsFontSizeToFit>
            {calcDisplay || '0'}
          </Text>
        </View>
        <View style={styles.calcPad}>
          <View style={styles.calcRow}>
            {renderCalcButton('C', '#A5A5A5', '#000')}
            {renderCalcButton('(', '#A5A5A5', '#000')}
            {renderCalcButton(')', '#A5A5A5', '#000')}
            {renderCalcButton('/', '#FF9F0A')}
          </View>
          <View style={styles.calcRow}>
            {renderCalcButton('7')}
            {renderCalcButton('8')}
            {renderCalcButton('9')}
            {renderCalcButton('*', '#FF9F0A')}
          </View>
          <View style={styles.calcRow}>
            {renderCalcButton('4')}
            {renderCalcButton('5')}
            {renderCalcButton('6')}
            {renderCalcButton('-', '#FF9F0A')}
          </View>
          <View style={styles.calcRow}>
            {renderCalcButton('1')}
            {renderCalcButton('2')}
            {renderCalcButton('3')}
            {renderCalcButton('+', '#FF9F0A')}
          </View>
          <View style={styles.calcRow}>
            {renderCalcButton('0', '#333', '#FFF')}
            {renderCalcButton('.', '#333')}
            {renderCalcButton('=', '#FF9F0A')}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.vaultContainer}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.vaultKeyboardArea}>
        
        <View style={styles.vaultHeader}>
          <Text style={styles.vaultTitle}>VAULT ACCESS</Text>
          <Text style={styles.vaultSubtitle}>
            {view === 'login' ? 'Enter Credentials' : 'Register New User'}
          </Text>
        </View>

        <View style={styles.vaultForm}>
          {view === 'register' && (
            <TextInput
              style={styles.vaultInput}
              placeholder="Display Name"
              placeholderTextColor="#666"
              value={userName}
              onChangeText={setUserName}
            />
          )}

          <TextInput
            style={styles.vaultInput}
            placeholder="10-Digit ID"
            placeholderTextColor="#666"
            keyboardType="number-pad"
            maxLength={10}
            value={userId}
            onChangeText={setUserId}
          />

          <TextInput
            style={styles.vaultInput}
            placeholder="4-Digit PIN"
            placeholderTextColor="#666"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            value={userPin}
            onChangeText={setUserPin}
          />

          <TouchableOpacity 
            style={styles.vaultButton} 
            onPress={view === 'login' ? handleLogin : handleRegister}
            disabled={isLoading}
          >
            <Text style={styles.vaultButtonText}>
              {isLoading ? 'Processing...' : (view === 'login' ? 'AUTHORIZE' : 'CREATE ACCOUNT')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setView(view === 'login' ? 'register' : 'login')} style={styles.vaultSwitchToggle}>
            <Text style={styles.vaultSwitchText}>
              {view === 'login' ? 'New user? Create Account' : 'Have an ID? Login Here'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setView('calculator')} style={styles.vaultSwitchToggle}>
            <Text style={[styles.vaultSwitchText, { color: '#666', marginTop: 20 }]}>
              ← Return to Calculator
            </Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Calculator Styles
  calcContainer: { flex: 1, backgroundColor: '#000' },
  calcDisplayContainer: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 20 },
  calcDisplayText: { color: '#FFF', fontSize: 70, fontWeight: '300' },
  calcPad: { paddingBottom: 30, paddingHorizontal: 10 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  calcButton: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  calcButtonText: { fontSize: 32, fontWeight: '500' },

  // Vault Auth Styles
  vaultContainer: { flex: 1, backgroundColor: '#000' },
  vaultKeyboardArea: { flex: 1, justifyContent: 'center', padding: 20 },
  vaultHeader: { alignItems: 'center', marginBottom: 40 },
  vaultTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFF', letterSpacing: 4 },
  vaultSubtitle: { fontSize: 14, color: '#0095F6', marginTop: 10, letterSpacing: 2 },
  vaultForm: { width: '100%' },
  vaultInput: { backgroundColor: '#111', color: '#FFF', borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 15, fontSize: 16, marginBottom: 15, textAlign: 'center', letterSpacing: 2 },
  vaultButton: { backgroundColor: '#0095F6', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  vaultButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, letterSpacing: 2 },
  vaultSwitchToggle: { alignItems: 'center', marginTop: 20 },
  vaultSwitchText: { color: '#0095F6', fontSize: 14 },
});