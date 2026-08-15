import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

// NEW: Imported arrayUnion to securely link two users together
import * as ImagePicker from 'expo-image-picker';
import { arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const { width } = Dimensions.get('window');

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  
  // Privacy & Relationship States
  const [isMe, setIsMe] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [isLinking, setIsLinking] = useState(false); // New loading state for the button

  // Edit Profile States
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editPhotoBase64, setEditPhotoBase64] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const fetchProfile = async () => {
    const storedId = await AsyncStorage.getItem('currentUserId');
    setMyUserId(storedId);
    
    if (storedId === id) {
      setIsMe(true);
      setIsFriend(true); 
    } 

    if (id) {
      const userRef = doc(db, 'users', id as string);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        setProfileData(data);
        
        // SECURITY CHECK: Are we actually friends in the database?
        if (storedId && data.activeChats && data.activeChats.includes(storedId)) {
          setIsFriend(true);
        }
      } else {
        setProfileData({
          name: isMe ? 'Vault Owner' : 'Unknown Vault',
          bio: "Secure Identity Established.",
        });
      }
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id]);

  // ==========================================
  // NEW: THE BI-DIRECTIONAL DATABASE LINK
  // ==========================================
  const handleEstablishLink = async () => {
    if (!myUserId || !id) return;
    setIsLinking(true);

    try {
      // 1. Add their ID to YOUR activeChats array
      const myRef = doc(db, 'users', myUserId);
      await updateDoc(myRef, {
        activeChats: arrayUnion(id)
      });

      // 2. Add your ID to THEIR activeChats array
      const friendRef = doc(db, 'users', id as string);
      await updateDoc(friendRef, {
        activeChats: arrayUnion(myUserId)
      });

      // 3. Unlock the profile UI instantly
      setIsFriend(true);
    } catch (error) {
      console.error("Error linking vaults:", error);
      alert("❌ Failed to establish secure connection.");
    } finally {
      setIsLinking(false);
    }
  };
  // ==========================================

  // --- EDIT PROFILE LOGIC ---
  const handleOpenEdit = () => {
    setEditBio(profileData.bio || '');
    setEditPhotoBase64(profileData.photoBase64 || null);
    setIsEditing(true);
  };

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], 
      quality: 0.2, 
      base64: true, 
    });

    if (!result.canceled && result.assets[0].base64) {
      setEditPhotoBase64(result.assets[0].base64);
    }
  };

  const handleSaveProfile = async () => {
    if (!myUserId) return;
    setIsSaving(true);
    
    try {
      const userRef = doc(db, 'users', myUserId);
      await updateDoc(userRef, {
        bio: editBio,
        photoBase64: editPhotoBase64
      });
      
      setIsEditing(false);
      await fetchProfile();
    } catch (error) {
      alert("❌ Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!profileData) return <View style={[styles.container, { backgroundColor: theme.bg }]} />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      
      {/* 1. HEADER */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color={theme.text} style={get3DStyle()} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="lock-closed" size={14} color={theme.text} style={{ marginRight: 6 }} />
          <Text style={[styles.headerUsername, { color: theme.text }]}>{id}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity>
            <Ionicons name="menu" size={32} color={theme.text} style={get3DStyle()} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 2. MINIMALIST AVATAR & BIO SECTION */}
        <View style={styles.profileTopSection}>
          <View style={styles.avatarWrapper}>
            {!isFriend ? (
              <View style={[styles.avatar, styles.hiddenAvatar, { borderColor: theme.border }]}>
                <Ionicons name="person" size={40} color={theme.subText} />
              </View>
            ) : (
              <View style={[styles.avatar, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
                {profileData.photoBase64 ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${profileData.photoBase64}` }} style={styles.avatarImage} />
                ) : (
                  <Text style={[styles.avatarInitials, { color: theme.text }]}>{profileData.name?.charAt(0) || '?'}</Text>
                )}
              </View>
            )}
            {isMe && <View style={styles.addStoryBadge}><Text style={styles.addStoryText}>+</Text></View>}
          </View>
          
          <View style={styles.bioSection}>
            <Text style={[styles.bioName, { color: theme.text }]}>{profileData.name}</Text>
            <Text style={[styles.bioText, { color: theme.text }]}>{profileData.bio}</Text>
          </View>
        </View>

        {/* 3. ACTION BUTTONS */}
        <View style={styles.actionRow}>
          {isMe ? (
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
              onPress={handleOpenEdit}
            >
              <Text style={[styles.actionBtnText, { color: theme.text }]}>Edit profile</Text>
            </TouchableOpacity>
          ) : isFriend ? (
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]} 
              onPress={() => router.push({ pathname: '/chat', params: { friendId: id, friendName: profileData.name } })}
            >
              <Text style={[styles.actionBtnText, { color: theme.text }]}>Message Vault</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#0095F6', borderColor: '#0095F6' }]} 
              onPress={handleEstablishLink}
              disabled={isLinking}
            >
              {isLinking ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Add Friend</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* 4. PRIVACY LOCK OR POST GRID */}
        {!isFriend ? (
          <View style={styles.privacyShield}>
            <View style={styles.privacyIconRing}>
              <Ionicons name="lock-closed-outline" size={50} color={theme.text} style={get3DStyle()} />
            </View>
            <Text style={[styles.privacyTitle, { color: theme.text }]}>Vault is Locked</Text>
            <Text style={[styles.privacySubtitle, { color: theme.subText }]}>Connect with this user to view their encrypted files and identity.</Text>
          </View>
        ) : (
          <>
            <View style={[styles.gridTabs, { borderBottomColor: theme.border }]}>
              <View style={[styles.gridTab, styles.gridTabActive]}>
                <Ionicons name="grid-outline" size={26} color={theme.text} style={get3DStyle()} />
              </View>
            </View>

            <View style={styles.postGrid}>
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <View key={item} style={[styles.gridSquare, { backgroundColor: theme.cardBg, borderColor: theme.bg }]}>
                  <Ionicons name="image-outline" size={30} color={theme.border} />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* 5. EDIT PROFILE MODAL */}
      <Modal visible={isEditing} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <Text style={[styles.modalActionText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Profile</Text>
              <TouchableOpacity onPress={handleSaveProfile} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#0095F6" />
                ) : (
                  <Text style={[styles.modalActionText, { color: '#0095F6', fontWeight: 'bold' }]}>Done</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.editAvatarSection}>
              <TouchableOpacity onPress={handlePickImage} style={[styles.editAvatarCircle, { borderColor: theme.border }]}>
                {editPhotoBase64 ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${editPhotoBase64}` }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="camera" size={40} color={theme.subText} />
                )}
              </TouchableOpacity>
              <Text style={styles.editAvatarText}>Edit picture</Text>
            </View>

            <View style={[styles.inputGroup, { borderTopColor: theme.border }]}>
              <Text style={[styles.inputLabel, { color: theme.subText }]}>Bio</Text>
              <TextInput
                style={[styles.editInput, { color: theme.text }]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Write a bio..."
                placeholderTextColor={theme.subText}
                multiline={true}
                maxLength={150}
              />
            </View>
            
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 50, borderBottomWidth: 1 },
  backBtn: { paddingRight: 15 },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  headerUsername: { fontSize: 20, fontWeight: 'bold' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  
  profileTopSection: { paddingHorizontal: 20, marginTop: 20 },
  avatarWrapper: { position: 'relative', alignSelf: 'flex-start', marginBottom: 15 },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  hiddenAvatar: { backgroundColor: '#1A1A1A' },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 36, fontWeight: 'bold' },
  addStoryBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#0095F6', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000' },
  addStoryText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginTop: -2 },
  
  bioSection: { marginTop: 5 },
  bioName: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  bioText: { fontSize: 14, lineHeight: 22 },
  
  actionRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 20, marginBottom: 25 },
  actionBtn: { flex: 1, height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  actionBtnText: { fontWeight: '600', fontSize: 14 },
  
  privacyShield: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 40 },
  privacyIconRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: '#262626', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  privacyTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  privacySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  gridTabs: { flexDirection: 'row', borderBottomWidth: 1 },
  gridTab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  gridTabActive: { borderBottomWidth: 1, borderBottomColor: '#FFF' },
  
  postGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridSquare: { width: width / 3, height: width / 3, borderWidth: 0.5, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  modalContent: { borderTopLeftRadius: 18, borderTopRightRadius: 18, minHeight: 400, borderWidth: 1, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#262626' },
  modalTitle: { fontSize: 16, fontWeight: 'bold' },
  modalActionText: { fontSize: 16 },
  
  editAvatarSection: { alignItems: 'center', paddingVertical: 30 },
  editAvatarCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 15 },
  editAvatarText: { color: '#0095F6', fontSize: 14, fontWeight: '600' },
  
  inputGroup: { paddingHorizontal: 15, paddingVertical: 15, borderTopWidth: 1 },
  inputLabel: { fontSize: 13, marginBottom: 5 },
  editInput: { fontSize: 16, minHeight: 60, textAlignVertical: 'top' },
});