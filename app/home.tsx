import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { db } from '../firebaseConfig';

export default function HomeScreen() {
  const router = useRouter();
  
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>('Vault User');
  
  const [activeTab, setActiveTab] = useState<'Chats' | 'Feed' | 'Post' | 'Search'>('Chats');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [friends, setFriends] = useState<any[]>([]);
  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);

  const [postText, setPostText] = useState('');
  const [postImageBase64, setPostImageBase64] = useState<string | null>(null);
  const [selectedViewers, setSelectedViewers] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);

  // Hardcoded Dark Theme
  const theme = {
    bg: '#000000',
    cardBg: '#121212',
    text: '#FFFFFF',
    subText: '#A0A0A0',
    border: '#262626',
    iconShadow: 'rgba(255, 255, 255, 0.25)',
    storyRing: '#444444', 
    accent: '#0095F6'
  };

  const get3DStyle = () => ({
    textShadowColor: theme.iconShadow,
    textShadowOffset: { width: 1.5, height: 1.5 },
    textShadowRadius: 1,
  });

  useEffect(() => {
    const initializeNetwork = async () => {
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
          setMyName(myUserSnap.data().name || 'Vault User');
          const activeChatIds = myUserSnap.data().activeChats || [];
          
          if (activeChatIds.length > 0) {
            const fetchedFriends = [];
            for (const fid of activeChatIds) {
              const fSnap = await getDoc(doc(db, 'users', fid));
              if (fSnap.exists()) fetchedFriends.push({ id: fSnap.id, ...fSnap.data() });
            }
            setFriends(fetchedFriends);
          }
        }
      } catch (e) {
        console.error("Error fetching network", e);
      } finally {
        setIsLoadingFriends(false);
      }

      const postsRef = collection(db, 'posts');
      const q = query(postsRef, where('allowedViewers', 'array-contains', storedId));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const posts: any[] = [];
        snapshot.forEach((doc) => posts.push({ id: doc.id, ...doc.data() }));
        
        posts.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setFeedPosts(posts);
      });

      return () => unsubscribe();
    };

    initializeNetwork();
  }, []);

  // --- POST CREATION ENGINE ---
  const handlePickPostImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.3,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setPostImageBase64(result.assets[0].base64);
    }
  };

  const toggleViewer = (friendId: string) => {
    if (selectedViewers.includes(friendId)) {
      setSelectedViewers(selectedViewers.filter(id => id !== friendId));
    } else {
      setSelectedViewers([...selectedViewers, friendId]);
    }
  };

  const handleCreatePost = async () => {
    if (!postText.trim() && !postImageBase64) return;
    if (!myUserId) return;
    
    setIsPosting(true);
    try {
      let secureImageUrl = null;

      if (postImageBase64) {
        const data = new FormData();
        data.append('file', `data:image/jpeg;base64,${postImageBase64}`);
        data.append('upload_preset', 'kukachat'); 

        const response = await fetch('https://api.cloudinary.com/v1_1/ie1p5v4v/auto/upload', {
          method: 'POST',
          body: data,
        });
        const cloudData = await response.json();
        secureImageUrl = cloudData.secure_url;
      }

      const postData = {
        authorId: myUserId,
        authorName: myName,
        text: postText.trim(),
        imageUrl: secureImageUrl, 
        allowedViewers: [myUserId, ...selectedViewers], 
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'posts'), postData);
      
      setPostText('');
      setPostImageBase64(null);
      setSelectedViewers([]);
      setActiveTab('Feed');
    } catch (error) {
      alert("❌ Failed to broadcast post to the cloud.");
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (error) {
      alert("❌ Failed to delete post.");
    }
  };

  // --- TAB RENDERERS ---
  const renderChats = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Encrypted Vaults</Text>

      {isLoadingFriends ? (
        <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 40 }} />
      ) : friends.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed-outline" size={50} color={theme.border} style={{ marginBottom: 15 }} />
          <Text style={[styles.emptyStateText, { color: theme.subText }]}>No active connections. Use the Search tab to establish a secure link.</Text>
        </View>
      ) : (
        friends.map((friend) => (
          <TouchableOpacity 
            key={friend.id} 
            activeOpacity={0.7}
            style={styles.contactRow}
            onPress={() => router.push({ pathname: '/chat', params: { friendId: friend.id, friendName: friend.name || 'Unknown Vault' } })}
          >
            <View style={[styles.avatar, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
              {friend.photoBase64 ? (
                <Image source={{ uri: `data:image/jpeg;base64,${friend.photoBase64}` }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarInitials, { color: theme.text }]}>{friend.name ? friend.name.charAt(0).toUpperCase() : '?'}</Text>
              )}
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactName, { color: theme.text }]}>{friend.name || 'Unknown Vault'}</Text>
              <Text style={[styles.contactId, { color: theme.subText }]}>Secure connection active</Text>
            </View>
            <Ionicons name="chatbubble-outline" size={24} color={theme.subText} style={get3DStyle()} />
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );

  const renderPostCreator = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Create Secure Post</Text>
        
        <View style={[styles.postInputBox, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <TextInput
            style={[styles.postTextInput, { color: theme.text }]}
            placeholder="What's happening?"
            placeholderTextColor={theme.subText}
            multiline
            value={postText}
            onChangeText={setPostText}
          />
          {postImageBase64 && (
            <View style={styles.attachedImageContainer}>
              <Image source={{ uri: `data:image/jpeg;base64,${postImageBase64}` }} style={styles.attachedImage} />
              <TouchableOpacity style={styles.removeImageBtn} onPress={() => setPostImageBase64(null)}>
                <Ionicons name="close-circle" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.postInputActions}>
            <TouchableOpacity onPress={handlePickPostImage}>
              <Ionicons name="image-outline" size={28} color={theme.text} style={get3DStyle()} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 25, fontSize: 14 }]}>Targeted Viewers (Checklist)</Text>
        <Text style={{ color: theme.subText, fontSize: 12, marginBottom: 15 }}>Select exactly who is allowed to decrypt and view this post.</Text>

        {friends.length === 0 ? (
          <Text style={{ color: theme.subText, fontStyle: 'italic' }}>You need to add friends before you can target a post.</Text>
        ) : (
          <View style={[styles.checklistContainer, { borderColor: theme.border }]}>
            {friends.map(friend => {
              const isSelected = selectedViewers.includes(friend.id);
              return (
                <TouchableOpacity 
                  key={friend.id}
                  activeOpacity={0.7} 
                  style={[styles.checklistItem, { borderBottomColor: theme.border }]}
                  onPress={() => toggleViewer(friend.id)}
                >
                  <Text style={[styles.checklistName, { color: isSelected ? theme.accent : theme.text }]}>{friend.name}</Text>
                  <Ionicons 
                    name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                    size={24} 
                    color={isSelected ? theme.accent : theme.subText} 
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TouchableOpacity 
          activeOpacity={0.8}
          style={[styles.submitPostBtn, { backgroundColor: (!postText && !postImageBase64) ? theme.border : theme.accent }]}
          onPress={handleCreatePost}
          disabled={(!postText && !postImageBase64) || isPosting}
        >
          {isPosting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitPostBtnText}>Broadcast Post</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderFeed = () => (
    <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
      <View style={[styles.storiesContainer, { borderBottomColor: theme.border, backgroundColor: theme.bg }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
          <TouchableOpacity style={styles.storyItem} activeOpacity={0.8}>
            <View style={[styles.storyRing, { borderColor: theme.storyRing }]}>
              <View style={[styles.storyAvatarContainer, { backgroundColor: theme.border }]}>
                <Text style={[styles.dummyAvatarText, { color: theme.subText }]}>{myName.charAt(0)}</Text>
              </View>
            </View>
            <View style={styles.addStoryBadge}>
              <Text style={styles.addStoryText}>+</Text>
            </View>
            <Text style={[styles.storyName, { color: theme.text }]} numberOfLines={1}>Your story</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {feedPosts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={50} color={theme.border} style={{ marginBottom: 15 }} />
          <Text style={[styles.emptyStateText, { color: theme.subText }]}>No posts yet. Head to the Post tab to create one!</Text>
        </View>
      ) : (
        feedPosts.map((post) => (
          <View key={post.id} style={[styles.postContainer, { backgroundColor: theme.bg }]}>
            
            <View style={styles.postHeader}>
              <View style={styles.postHeaderLeft}>
                <View style={[styles.postAvatar, { backgroundColor: theme.border }]}>
                  <Text style={[styles.dummyAvatarText, { color: theme.subText, fontSize: 16 }]}>{post.authorName?.charAt(0)}</Text>
                </View>
                <Text style={[styles.postAuthor, { color: theme.text }]}>{post.authorName}</Text>
              </View>
              
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="lock-closed" size={14} color={theme.subText} style={{ marginRight: 15 }} />
                {post.authorId === myUserId && (
                  <TouchableOpacity onPress={() => handleDeletePost(post.id)}>
                    <Ionicons name="trash-outline" size={20} color="#ED4956" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {(post.imageUrl || post.imageBase64) && (
              <View style={[styles.postImagePlaceholder, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
                 <Image 
                   source={{ uri: post.imageUrl || `data:image/jpeg;base64,${post.imageBase64}` }} 
                   style={{ width: '100%', height: '100%' }} 
                 />
              </View>
            )}

            <View style={styles.postActions}>
              <View style={styles.postActionsLeft}>
                <TouchableOpacity style={styles.actionBtn}>
                  <Ionicons name="heart-outline" size={26} color={theme.text} style={get3DStyle()} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                  <Ionicons name="chatbubble-outline" size={24} color={theme.text} style={get3DStyle()} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.postDetails}>
              {post.text ? (
                <Text style={[styles.captionText, { color: theme.text }]}>
                  <Text style={styles.captionAuthor}>{post.authorName} </Text>{post.text}
                </Text>
              ) : null}
              <Text style={[styles.timeText, { color: theme.subText }]}>
                {post.createdAt ? new Date(post.createdAt.toMillis()).toLocaleString() : 'Just now'}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderSearch = () => (
    <View style={[styles.searchContainer, { backgroundColor: theme.bg }]}>
      <View style={[styles.searchBarWrapper, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <Ionicons name="search" size={20} color={theme.subText} style={[styles.searchIcon, get3DStyle()]} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search Vault ID..."
          placeholderTextColor={theme.subText}
          value={searchQuery}
          onChangeText={setSearchQuery}
          keyboardType="numeric"
          onSubmitEditing={() => {
            if (searchQuery.length === 10) {
              router.push(`/user/${searchQuery}`);
              setSearchQuery('');
            } else {
              alert("Vault IDs must be exactly 10 digits.");
            }
          }}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={theme.subText} />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.searchContent}>
        <View style={styles.searchPlaceholderBox}>
          <Ionicons name="search-outline" size={54} color={theme.border} style={get3DStyle()} />
          <Text style={[styles.searchPlaceholderTitle, { color: theme.text }]}>Explore KuKa Hub</Text>
          <Text style={[styles.searchPlaceholderSubtitle, { color: theme.subText }]}>
            Search exactly 10-digit vault IDs to establish secure connections.
          </Text>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      
      <View style={[styles.topHeader, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.logoText, { color: theme.text }]}>KuKa Hub</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="notifications-outline" size={24} color={theme.text} style={get3DStyle()} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === 'Chats' && renderChats()}
        {activeTab === 'Feed' && renderFeed()}
        {activeTab === 'Post' && renderPostCreator()}
        {activeTab === 'Search' && renderSearch()}
      </View>

      <View style={[styles.bottomNav, { backgroundColor: theme.bg, borderTopColor: theme.border }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Chats')}>
          <Ionicons name={activeTab === 'Chats' ? 'chatbubbles' : 'chatbubbles-outline'} size={26} color={theme.text} style={get3DStyle()} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Feed')}>
          <Ionicons name={activeTab === 'Feed' ? 'images' : 'images-outline'} size={26} color={theme.text} style={get3DStyle()} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Post')}>
          <Ionicons name={activeTab === 'Post' ? 'add-circle' : 'add-circle-outline'} size={32} color={theme.text} style={get3DStyle()} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Search')}>
          <Ionicons name={activeTab === 'Search' ? 'search' : 'search-outline'} size={26} color={theme.text} style={get3DStyle()} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem} onPress={() => { if(myUserId) router.push(`/user/${myUserId}`); }}>
          <View style={[styles.navProfileAvatar, { borderColor: 'transparent', backgroundColor: theme.cardBg }]}>
            <Text style={[styles.navProfileText, { color: theme.text }]}>{myName.charAt(0)}</Text>
          </View>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, height: 50, borderBottomWidth: 1 },
  headerLeft: { flex: 1 },
  logoText: { fontSize: 22, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }, 
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { marginLeft: 20 },

  scrollContent: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 40 },
  mainScroll: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyStateText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  contactRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 15 },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 24, fontWeight: 'bold' },
  contactInfo: { flex: 1, justifyContent: 'center' },
  contactName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  contactId: { fontSize: 12, fontStyle: 'italic' },

  postInputBox: { borderWidth: 1, borderRadius: 12, padding: 15, minHeight: 120 },
  postTextInput: { fontSize: 16, minHeight: 60, textAlignVertical: 'top' },
  postInputActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  attachedImageContainer: { position: 'relative', width: 100, height: 100, borderRadius: 8, overflow: 'hidden', marginTop: 10 },
  attachedImage: { width: '100%', height: '100%' },
  removeImageBtn: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12 },
  
  checklistContainer: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  checklistItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
  checklistName: { fontSize: 16, fontWeight: '500' },
  submitPostBtn: { paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitPostBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  storiesContainer: { borderBottomWidth: 1, paddingBottom: 10 },
  storiesScroll: { paddingHorizontal: 10, paddingVertical: 12 },
  storyItem: { alignItems: 'center', marginRight: 15, position: 'relative' },
  storyRing: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  storyAvatarContainer: { width: 62, height: 62, borderRadius: 31, justifyContent: 'center', alignItems: 'center' },
  dummyAvatarText: { fontSize: 22, fontWeight: 'bold' },
  addStoryBadge: { position: 'absolute', bottom: 18, right: 0, backgroundColor: '#0095F6', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000' },
  addStoryText: { color: '#FFF', fontSize: 13, fontWeight: 'bold', marginTop: -2 },
  storyName: { fontSize: 11, marginTop: 5, maxWidth: 72 },

  postContainer: { marginBottom: 15, paddingTop: 10 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10 },
  postHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  postAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  postAuthor: { fontSize: 13, fontWeight: '700' },
  postImagePlaceholder: { width: '100%', height: 380, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  postActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  postActionsLeft: { flexDirection: 'row' },
  actionBtn: { marginRight: 18 },
  postDetails: { paddingHorizontal: 12 },
  captionText: { fontSize: 13, lineHeight: 18 },
  captionAuthor: { fontWeight: '700' },
  timeText: { fontSize: 11, marginTop: 6, marginBottom: 10 },

  searchContainer: { flex: 1, paddingHorizontal: 15, paddingTop: 10 },
  searchBarWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 42 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  searchContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  searchPlaceholderBox: { alignItems: 'center', paddingHorizontal: 30 },
  searchPlaceholderTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 8 },
  searchPlaceholderSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', height: 48, borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 12 : 0 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 5 },
  navProfileAvatar: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  navProfileText: { fontSize: 12, fontWeight: 'bold' },
});