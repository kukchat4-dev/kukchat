import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
// NEW: Added collection, query, where, and deleteDoc for managing your posts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function ProfileScreen() {
  const router = useRouter();
  
  const [myUserId, setMyUserId] = useState('');
  const [name, setName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  
  // NEW: State to hold your personal posts
  const [myPosts, setMyPosts] = useState<any[]>([]);

  useEffect(() => {
    let userUnsubscribe: any; 
    let postsUnsubscribe: any;

    const loadUserData = async () => {
      const storedId = await AsyncStorage.getItem('currentUserId');
      if (storedId) {
        setMyUserId(storedId);
        
        // 1. Sync Profile Info
        const userRef = doc(db, 'users', storedId);
        userUnsubscribe = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.name) setName(data.name);
            if (data.photoBase64 && !profilePic) setProfilePic(data.photoBase64);
          }
        });

        // 2. NEW: Sync Only Your Posts
        const postsQuery = query(
          collection(db, 'posts'), 
          where('authorId', '==', storedId)
        );
        postsUnsubscribe = onSnapshot(postsQuery, (snapshot) => {
          const fetchedPosts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })).sort((a: any, b: any) => {
            // Sorts newest to oldest locally to bypass Firebase Index errors
            const timeA = a.createdAt?.toMillis() || Date.now();
            const timeB = b.createdAt?.toMillis() || Date.now();
            return timeB - timeA;
          });
          
          setMyPosts(fetchedPosts);
        });

      } else {
        router.replace('/login');
      }
    };
    
    loadUserData();

    return () => {
      if (userUnsubscribe) userUnsubscribe();
      if (postsUnsubscribe) postsUnsubscribe();
    };
  }, []);

  const handleChoosePhoto = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.2, 
        base64: true, 
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64String = result.assets[0].base64;
        setProfilePic(base64String);
        setStatusMessage('⏳ Uploading in background...');

        const userRef = doc(db, 'users', myUserId);
        await updateDoc(userRef, { photoBase64: base64String });
        setStatusMessage('✅ Profile picture locked into Vault!');
      }
    } catch (error) {
      console.error(error);
      setStatusMessage('❌ Error uploading image.');
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) { setStatusMessage('❌ Error: Name cannot be blank.'); return; }
    setStatusMessage('Updating name...');
    try {
      const userRef = doc(db, 'users', myUserId);
      await updateDoc(userRef, { name: name });
      setStatusMessage('✅ Name successfully updated!');
    } catch (error) {
      console.error(error);
      setStatusMessage('⚠️ Failed to connect to Firebase.');
    }
  };

  const handleResetPin = async () => {
    if (newPin.length !== 4) { setStatusMessage('❌ Error: PIN must be exactly 4 digits.'); return; }
    setStatusMessage('Updating PIN...');
    try {
      const userRef = doc(db, 'users', myUserId);
      await updateDoc(userRef, { pin: newPin });
      setStatusMessage('✅ New 4-digit PIN locked in!');
      setNewPin('');
    } catch (error) {
      console.error(error);
      setStatusMessage('⚠️ Failed to update PIN.');
    }
  };

  // NEW: Instantly delete a post from the database
  const handleDeletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setStatusMessage('🗑️ Post permanently deleted.');
    } catch (error) {
      console.error(error);
      setStatusMessage('❌ Error deleting post.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 50 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          
          <Text style={styles.label}>Display Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter new name" placeholderTextColor="#64748B" />
          <TouchableOpacity style={styles.primaryButton} onPress={handleSaveProfile}>
            <Text style={styles.buttonText}>Save Name</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.label}>Profile Picture</Text>
          <View style={styles.photoRow}>
            <View style={styles.avatarCircle}>
              {profilePic ? (
                <Image source={{ uri: `data:image/jpeg;base64,${profilePic}` }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarLetter}>{name ? name.charAt(0).toUpperCase() : '?'}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleChoosePhoto}>
              <Text style={styles.buttonText}>Choose Photo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <Text style={styles.label}>Reset 4-Digit PIN</Text>
          <TextInput style={styles.input} value={newPin} onChangeText={setNewPin} placeholder="Enter new 4-digit PIN" placeholderTextColor="#64748B" keyboardType="numeric" maxLength={4} secureTextEntry={true} />
          <TouchableOpacity style={styles.dangerButton} onPress={handleResetPin}>
            <Text style={styles.buttonText}>Update PIN</Text>
          </TouchableOpacity>
        </View>

        {/* NEW: Dynamic Personal Posts Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Manage My Posts</Text>
          
          {myPosts.length === 0 ? (
            <Text style={styles.emptyFeedText}>You haven't made any posts yet.</Text>
          ) : (
            myPosts.map((post) => (
              <View key={post.id} style={styles.postItem}>
                <Text style={styles.postText}>{post.content}</Text>
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  onPress={() => handleDeletePost(post.id)}
                >
                  <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderColor: '#1E293B' },
  backButton: { paddingVertical: 5, paddingRight: 15 },
  backButtonText: { color: '#6366F1', fontSize: 16, fontWeight: 'bold' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  
  scrollContent: { padding: 20 },
  statusText: { color: '#22C55E', fontSize: 14, textAlign: 'center', marginBottom: 15, fontWeight: 'bold' },
  card: { backgroundColor: '#1E293B', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  sectionTitle: { fontSize: 18, color: '#F8FAFC', fontWeight: 'bold', marginBottom: 15 },
  label: { color: '#CBD5E1', fontSize: 14, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: '#0F172A', color: '#FFF', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 20 },
  
  primaryButton: { backgroundColor: '#6366F1', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  secondaryButton: { flex: 1, backgroundColor: '#6366F1', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginLeft: 15 },
  dangerButton: { backgroundColor: '#EF4444', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  
  photoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#6366F1' },
  avatarImage: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 24, color: '#FFF', fontWeight: 'bold' },

  emptyFeedText: { color: '#94A3B8', textAlign: 'center', fontStyle: 'italic', marginBottom: 10 },
  postItem: { backgroundColor: '#0F172A', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  postText: { color: '#E2E8F0', fontSize: 14, flex: 1, marginRight: 10 },
  deleteButton: { backgroundColor: '#334155', padding: 8, borderRadius: 8 },
  deleteButtonText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },
});