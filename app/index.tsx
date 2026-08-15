import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

// Single dot here because this file is directly in the app/ folder
import { db } from '../firebaseConfig';

export default function InboxScreen() {
  const router = useRouter();
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hardcoded Dark Theme
  const theme = {
    bg: '#000000',
    cardBg: '#121212',
    text: '#FFFFFF',
    subText: '#A0A0A0',
    border: '#262626',
    iconShadow: 'rgba(255, 255, 255, 0.25)',
  };

  const get3DStyle = () => ({
    textShadowColor: theme.iconShadow,
    textShadowOffset: { width: 1.5, height: 1.5 },
    textShadowRadius: 1,
  });

  useEffect(() => {
    const loadSecureInbox = async () => {
      const storedId = await AsyncStorage.getItem('currentUserId');
      if (!storedId) {
        router.replace('/login');
        return;
      }
      setMyUserId(storedId);

      try {
        const myUserRef = doc(db, 'users', storedId);
        const myUserSnap = await getDoc(myUserRef);
        
        if (myUserSnap.exists()) {
          const activeChatIds = myUserSnap.data().activeChats || [];
          
          if (activeChatIds.length === 0) {
            setContacts([]);
            setIsLoading(false);
            return;
          }

          const fetchedContacts: any[] = [];
          for (const friendId of activeChatIds) {
            const friendSnap = await getDoc(doc(db, 'users', friendId));
            if (friendSnap.exists()) {
              fetchedContacts.push({ id: friendSnap.id, ...friendSnap.data() });
            }
          }
          setContacts(fetchedContacts);
        }
      } catch (error) {
        console.error("Failed to decrypt inbox directory", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSecureInbox();
  }, []);

  const openChat = (friendId: string, friendName: string) => {
    router.push({ 
      pathname: '/chat', 
      params: { friendId, friendName } 
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      
      {/* INBOX HEADER */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color={theme.text} style={get3DStyle()} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerUsername, { color: theme.text }]}>Encrypted Vaults</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity>
            <Ionicons name="shield-checkmark" size={24} color={theme.text} style={get3DStyle()} />
          </TouchableOpacity>
        </View>
      </View>

      {/* SECURE CONTACTS LIST */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={[styles.searchBar, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.subText} style={{ marginRight: 8 }} />
          <Text style={{ color: theme.subText, fontSize: 15 }}>Filter active connections...</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Active Connections</Text>

        {isLoading ? (
          <ActivityIndicator size="large" color="#0095F6" style={{ marginTop: 40 }} />
        ) : contacts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="lock-closed-outline" size={50} color={theme.border} style={{ marginBottom: 15 }} />
            <Text style={[styles.emptyStateTitle, { color: theme.text }]}>Inbox is Secure</Text>
            <Text style={[styles.emptyStateText, { color: theme.subText }]}>
              You have no active connections. Search for a 10-digit ID in the explorer to establish a secure link.
            </Text>
          </View>
        ) : (
          contacts.map((contact) => (
            <TouchableOpacity 
              key={contact.id} 
              style={styles.contactRow}
              onPress={() => openChat(contact.id, contact.name || 'Unknown Vault')}
            >
              <View style={[styles.avatar, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
                {contact.photoBase64 ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${contact.photoBase64}` }} style={styles.avatarImage} />
                ) : (
                  <Text style={[styles.avatarInitials, { color: theme.text }]}>
                    {contact.name ? contact.name.charAt(0).toUpperCase() : '?'}
                  </Text>
                )}
              </View>
              
              <View style={styles.contactInfo}>
                <Text style={[styles.contactName, { color: theme.text }]}>{contact.name || 'Unknown Vault'}</Text>
                <Text style={[styles.contactId, { color: theme.subText }]}>Encrypted Link Active</Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color={theme.subText} />
            </TouchableOpacity>
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 55, borderBottomWidth: 1 },
  backBtn: { paddingRight: 15 },
  headerTitleContainer: { flex: 1, alignItems: 'flex-start' },
  headerUsername: { fontSize: 20, fontWeight: 'bold' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  
  scrollContent: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 40 },
  
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 40, marginBottom: 20 },
  
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyStateTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  emptyStateText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  contactRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 15 },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 24, fontWeight: 'bold' },
  
  contactInfo: { flex: 1, justifyContent: 'center' },
  contactName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  contactId: { fontSize: 12, fontStyle: 'italic' },
});