import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
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
import { db } from '../firebaseConfig';

export default function HomeScreen() {
  const router = useRouter();
  
  // Modals
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [friendId, setFriendId] = useState('');
  const [showPostModal, setShowPostModal] = useState(false);
  const [postText, setPostText] = useState('');
  const [showInboxModal, setShowInboxModal] = useState(false);
  
  // Profile & Feed State
  const [myUserId, setMyUserId] = useState('Loading...');
  const [myName, setMyName] = useState('Loading...');
  const [myProfilePic, setMyProfilePic] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);

  // NEW: State for the Local Join (Friends List)
  const [allUsers, setAllUsers] = useState<Record<string, any>>({});
  const [requestsToMe, setRequestsToMe] = useState<any[]>([]);
  const [requestsFromMe, setRequestsFromMe] = useState<any[]>([]);

  useEffect(() => {
    let userUnsub: any;
    let postsUnsub: any;
    let allUsersUnsub: any;
    let reqToMeUnsub: any;
    let reqFromMeUnsub: any;

    const loadSession = async () => {
      const storedId = await AsyncStorage.getItem('currentUserId');
      if (storedId) {
        setMyUserId(storedId);
        
        // 1. Listen to My Profile
        userUnsub = onSnapshot(doc(db, 'users', storedId), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.name) setMyName(data.name);
            if (data.photoBase64) setMyProfilePic(data.photoBase64);
          }
        });

        // 2. Listen to Live Feed
        postsUnsub = onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc')), (snapshot) => {
          setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // 3. NEW: Listen to All Users (To get real-time names & photos for friends)
        allUsersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
          const usersMap: Record<string, any> = {};
          snapshot.docs.forEach(doc => { usersMap[doc.id] = doc.data(); });
          setAllUsers(usersMap);
        });

        // 4. NEW: Listen to requests sent TO me (Inbox + Accepted Friends)
        reqToMeUnsub = onSnapshot(query(collection(db, 'friendRequests'), where('toId', '==', storedId)), (snapshot) => {
          setRequestsToMe(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // 5. NEW: Listen to requests sent FROM me (Accepted Friends)
        reqFromMeUnsub = onSnapshot(query(collection(db, 'friendRequests'), where('fromId', '==', storedId)), (snapshot) => {
          setRequestsFromMe(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

      } else {
        router.replace('/login');
      }
    };
    
    loadSession();

    return () => {
      if (userUnsub) userUnsub();
      if (postsUnsub) postsUnsub();
      if (allUsersUnsub) allUsersUnsub();
      if (reqToMeUnsub) reqToMeUnsub();
      if (reqFromMeUnsub) reqFromMeUnsub();
    };
  }, []);

  // --- THE LOCAL JOIN ENGINE ---
  // Filters pending requests for the Notification Bell
  const pendingRequests = requestsToMe.filter(req => req.status === 'pending');

  // Merges all accepted IDs (whether you sent it or they sent it)
  const acceptedToMe = requestsToMe.filter(req => req.status === 'accepted').map(req => req.fromId);
  const acceptedFromMe = requestsFromMe.filter(req => req.status === 'accepted').map(req => req.toId);
  const friendIds = Array.from(new Set([...acceptedToMe, ...acceptedFromMe]));

  // Builds the final real-time Chat List
  const friendsList = friendIds.map(id => {
    const user = allUsers[id] || {};
    return {
      friendId: id,
      name: user.name || 'Unknown User',
      photoBase64: user.photoBase64 || null,
      preview: 'Tap to open secure chat'
    };
  });
  // -----------------------------

  const handleOpenChat = (friendId: string, friendName: string) => {
    router.push({ pathname: '/chat', params: { friendId, friendName } });
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('currentUserId');
    router.replace('/login');
  };

  const handleSendFriendRequest = async () => {
    if (friendId.length !== 10) { alert('ID must be exactly 10 digits'); return; }
    if (friendId === myUserId) { alert('You cannot send a friend request to yourself!'); return; }
    try {
      await addDoc(collection(db, 'friendRequests'), { fromId: myUserId, fromName: myName, toId: friendId, status: 'pending', createdAt: serverTimestamp() });
      alert(`✅ Secure friend request sent to ${friendId}!`);
      setShowAddFriendModal(false);
      setFriendId('');
    } catch (error) { console.error(error); alert('❌ Error sending request.'); }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try { await updateDoc(doc(db, 'friendRequests', requestId), { status: 'accepted' }); } catch (error) { console.error(error); }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try { await updateDoc(doc(db, 'friendRequests', requestId), { status: 'declined' }); } catch (error) { console.error(error); }
  };

  const handleCreatePost = async () => {
    if (!postText.trim()) return;
    try {
      await addDoc(collection(db, 'posts'), { authorId: myUserId, authorName: myName, authorPic: myProfilePic || '', content: postText, createdAt: serverTimestamp() });
      setShowPostModal(false);
      setPostText('');
    } catch (error) { console.error(error); alert('❌ Error creating post.'); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>KuKa Hub</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => setShowInboxModal(true)} style={styles.iconButton}>
            <Text style={styles.iconText}>🔔 {pendingRequests.length > 0 && <Text style={styles.badge}>({pendingRequests.length})</Text>}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAddFriendModal(true)} style={styles.iconButton}>
            <Text style={styles.iconText}>➕</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
            <Text style={styles.iconText}>⋮</Text> 
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView>
        <View style={styles.profileSection}>
          <View style={styles.profileAvatar}>
            {myProfilePic ? (
              <Image source={{ uri: `data:image/jpeg;base64,${myProfilePic}` }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarLetter}>{myName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{myName}</Text>
            <Text style={styles.profileId}>ID: {myUserId}</Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={() => router.push('/profile')}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Chats</Text>
        <View style={styles.chatListContainer}>
          {/* NEW: Dynamically mapping your real accepted friends! */}
          {friendsList.length === 0 ? (
            <Text style={styles.emptyFeedText}>No secure connections yet.</Text>
          ) : (
            friendsList.map((friend) => (
              <TouchableOpacity 
                key={friend.friendId} 
                style={styles.chatListItem}
                onPress={() => handleOpenChat(friend.friendId, friend.name)}
              >
                <View style={styles.chatListAvatar}>
                  {friend.photoBase64 ? (
                    <Image source={{ uri: `data:image/jpeg;base64,${friend.photoBase64}` }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.chatListAvatarText}>{friend.name.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.chatListInfo}>
                  <Text style={styles.chatListName}>{friend.name}</Text>
                  <Text style={styles.chatListPreview} numberOfLines={1}>{friend.preview}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.feedHeader}>
          <Text style={styles.sectionTitle}>Live Feed</Text>
          <TouchableOpacity style={styles.createPostButton} onPress={() => setShowPostModal(true)}>
            <Text style={styles.createPostText}>📝 New Post</Text>
          </TouchableOpacity>
        </View>

        {posts.length === 0 ? (
          <Text style={styles.emptyFeedText}>No posts yet. Be the first to share something!</Text>
        ) : (
          posts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.postHeader}>
                <View style={styles.postAvatar}>
                  {post.authorPic ? (
                    <Image source={{ uri: `data:image/jpeg;base64,${post.authorPic}` }} style={styles.avatarImage} />
                  ) : (
                    <Text style={{color: '#FFF', fontWeight: 'bold'}}>{post.authorName.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <Text style={styles.postAuthor}>{post.authorName}</Text>
                <TouchableOpacity><Text style={styles.postOptions}>⋮</Text></TouchableOpacity>
              </View>
              <View style={styles.postContentBox}>
                <Text style={styles.postText}>{post.content}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modals */}
      <Modal visible={showInboxModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Friend Requests</Text>
            {pendingRequests.length === 0 ? (
              <Text style={styles.emptyFeedText}>No pending requests right now.</Text>
            ) : (
              pendingRequests.map((req) => (
                <View key={req.id} style={styles.requestItem}>
                  <View>
                    {/* Pulling their real-time name directly from the user database mapping */}
                    <Text style={styles.requestName}>{allUsers[req.fromId]?.name || req.fromName}</Text>
                    <Text style={styles.requestId}>ID: {req.fromId}</Text>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptRequest(req.id)}><Text style={styles.actionText}>✅</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.declineBtn} onPress={() => handleDeclineRequest(req.id)}><Text style={styles.actionText}>❌</Text></TouchableOpacity>
                  </View>
                </View>
              ))
            )}
            <TouchableOpacity style={[styles.cancelButton, {marginTop: 20, alignSelf: 'flex-end'}]} onPress={() => setShowInboxModal(false)}><Text style={styles.cancelText}>Close Inbox</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddFriendModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a Friend</Text>
            <Text style={styles.modalSubtitle}>Enter their 10-digit Secure ID</Text>
            <TextInput style={styles.modalInput} placeholder="10-Digit ID" placeholderTextColor="#64748B" keyboardType="numeric" maxLength={10} value={friendId} onChangeText={setFriendId} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddFriendModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.primaryModalButton} onPress={handleSendFriendRequest}><Text style={styles.primaryModalText}>Send Request</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPostModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create New Post</Text>
            <TextInput style={[styles.modalInput, styles.postInput]} placeholder="What's on your mind?" placeholderTextColor="#64748B" multiline={true} value={postText} onChangeText={setPostText} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPostModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.primaryModalButton} onPress={handleCreatePost}><Text style={styles.primaryModalText}>Publish Post</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderColor: '#1E293B' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  headerIcons: { flexDirection: 'row', gap: 15 },
  iconButton: { padding: 5 },
  iconText: { fontSize: 20, color: '#FFF' },
  badge: { color: '#EF4444', fontSize: 14, fontWeight: 'bold' },
  
  profileSection: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#1E293B', margin: 15, borderRadius: 16 },
  profileAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 24, color: '#FFF', fontWeight: 'bold' },
  profileInfo: { flex: 1, marginLeft: 15 },
  profileName: { fontSize: 18, color: '#FFF', fontWeight: 'bold' },
  profileId: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  editButton: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  editButtonText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  
  sectionTitle: { fontSize: 16, color: '#FFF', fontWeight: 'bold', marginLeft: 20, marginTop: 10, marginBottom: 10 },
  
  chatListContainer: { marginBottom: 20 },
  chatListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#1E293B' },
  chatListAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  chatListAvatarText: { fontSize: 22, color: '#FFF', fontWeight: 'bold' },
  chatListInfo: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  chatListName: { color: '#F8FAFC', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  chatListPreview: { color: '#94A3B8', fontSize: 14 },
  
  feedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20, marginBottom: 10 },
  createPostButton: { backgroundColor: '#6366F1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  createPostText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  emptyFeedText: { color: '#94A3B8', textAlign: 'center', marginTop: 20, fontStyle: 'italic', paddingHorizontal: 20 },
  
  postCard: { backgroundColor: '#1E293B', marginHorizontal: 15, marginBottom: 15, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#334155' },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  postAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  postAuthor: { flex: 1, color: '#FFF', fontWeight: 'bold', marginLeft: 10 },
  postOptions: { color: '#94A3B8', fontSize: 18, paddingHorizontal: 5 },
  postContentBox: { backgroundColor: '#0F172A', padding: 15, borderRadius: 10 },
  postText: { color: '#E2E8F0', fontSize: 14, lineHeight: 20 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '85%', backgroundColor: '#1E293B', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 15 },
  modalSubtitle: { fontSize: 14, color: '#94A3B8', marginBottom: 20 },
  modalInput: { backgroundColor: '#0F172A', color: '#FFF', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155', fontSize: 16, marginBottom: 20 },
  postInput: { minHeight: 100, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 15 },
  cancelText: { color: '#94A3B8', fontWeight: 'bold' },
  primaryModalButton: { backgroundColor: '#6366F1', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8 },
  primaryModalText: { color: '#FFF', fontWeight: 'bold' },
  
  requestItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F172A', padding: 15, borderRadius: 10, marginBottom: 10 },
  requestName: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  requestId: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  requestActions: { flexDirection: 'row', gap: 15 },
  acceptBtn: { backgroundColor: '#22C55E', padding: 8, borderRadius: 8 },
  declineBtn: { backgroundColor: '#EF4444', padding: 8, borderRadius: 8 },
  actionText: { fontSize: 16 }
});