import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CalculatorVault() {
  const [display, setDisplay] = useState('');
  const [savedPasscode, setSavedPasscode] = useState<string | null>(null);
  const router = useRouter();

  // Check memory for a saved passcode when the app opens
  useEffect(() => {
    const checkPasscode = async () => {
      const code = await AsyncStorage.getItem('vault_passcode');
      if (code) setSavedPasscode(code);
    };
    checkPasscode();
  }, []);

  const handlePress = async (value: string) => {
    if (value === 'C') {
      setDisplay('');
      return;
    }

    if (value === '=') {
      // FIRST TIME SETUP: No passcode saved yet
      if (!savedPasscode) {
        if (display.length < 4) {
          Alert.alert('Too Short', 'Set a passcode of at least 4 digits.');
          setDisplay('');
          return;
        }
        await AsyncStorage.setItem('vault_passcode', display);
        setSavedPasscode(display);
        Alert.alert('Vault Secured', 'Your secret passcode is set. Use it to unlock the app.');
        setDisplay('');
        return;
      }

      // UNLOCK ATTEMPT
      if (display === savedPasscode) {
        setDisplay('UNLOCKED');
        // Wait half a second, then send Sourabh to the Login Screen
        setTimeout(() => {
          router.push('/login');
        }, 500);
      } else {
        // Act like a normal calculator if it's the wrong code
        try {
          // Note: using eval for a simple calculator string is fine since input is strictly controlled
          const result = eval(display);
          setDisplay(String(result));
        } catch (e) {
          setDisplay('Error');
          setTimeout(() => setDisplay(''), 1000);
        }
      }
      return;
    }

    // Add numbers/symbols to the screen
    setDisplay((prev) => prev + value);
  };

  const buttons = [
    '7', '8', '9', '/',
    '4', '5', '6', '*',
    '1', '2', '3', '-',
    'C', '0', '=', '+'
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.displayContainer}>
        {!savedPasscode && <Text style={styles.hint}>First time: Type a passcode and press =</Text>}
        <Text style={styles.displayText}>{display || '0'}</Text>
      </View>

      <View style={styles.keypad}>
        {buttons.map((btn) => (
          <TouchableOpacity 
            key={btn} 
            style={[styles.button, ['/', '*', '-', '+', '='].includes(btn) ? styles.operatorBtn : null]} 
            onPress={() => handlePress(btn)}
          >
            <Text style={[styles.buttonText, ['/', '*', '-', '+', '='].includes(btn) ? styles.operatorText : null]}>
              {btn}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  displayContainer: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 20 },
  hint: { color: '#00FF00', fontSize: 14, marginBottom: 10 },
  displayText: { color: '#FFF', fontSize: 64, fontWeight: '300' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#000', paddingBottom: 20 },
  button: { width: '25%', height: 80, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: '#333' },
  operatorBtn: { backgroundColor: '#333' },
  buttonText: { color: '#FFF', fontSize: 32 },
  operatorText: { color: '#00FF00' },
});