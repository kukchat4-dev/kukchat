import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 🛑 Ensure this path matches your actual Firebase config file
import { db } from '../firebaseConfig';
import { registerForPushNotificationsAsync } from '../scripts/registerForPushNotifications';

export default function HomeScreen() {
  const router = useRouter();
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Placeholder data - you would normally fetch this from Firebase
  const [friendsList, setFriendsList] = useState([
    { id: '105', name: 'Viru' },
    { id: '106', name: 'Loka' }
  ]);

  useEffect(() => {
    async function initializeVaultEnvironment() {
      try {
        const storedUserId = await AsyncStorage.getItem('currentUserId');
        if (!storedUserId) {
          // If no user is logged in, send them back to the login screen
          router.replace('/login');
          return;
        }
        
        setMyUserId(storedUserId);

        // 1. Generate the Push Token in the background
        const pushToken = await registerForPushNotificationsAsync();

        // 2. Save it to your Firebase user document
        if (pushToken) {
          const userDocRef = doc(db, 'users', storedUserId);
          await updateDoc(userDocRef, {
            pushToken: pushToken,
            lastActive: new Date().toISOString()
          });
          console.log("Push token locked in for:", storedUserId);
        }
      } catch (error) {
        console.error("Error setting up Vault environment:", error);
      } finally {
        setIsLoading(false);
      }
    }

    initializeVaultEnvironment();
  }, []);

  const openChat = (friendId: string, friendName: string) => {
    router.push({
      pathname: '/chat',
      params: { friendId, friendName }
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0095F6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vault Messages</Text>
        <Text style={styles.headerSubtitle}>ID: {myUserId}</Text>
      </View>

      <FlatList
        data={friendsList}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.contactCard} 
            onPress={() => openChat(item.id, item.name)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.name}</Text>
              <Text style={styles.contactSub}>Tap to open encrypted chat</Text>
            </View>
          </TouchableOpacity>
        )}
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
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 5,
  },
  contactCard: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    alignItems: 'center'
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0095F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  avatarText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold'
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600'
  },
  contactSub: {
    color: '#555',
    fontSize: 13,
    marginTop: 4
  }
});