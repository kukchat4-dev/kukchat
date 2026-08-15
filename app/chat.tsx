 import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Linking,
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

// NEW: Importing our military-grade cryptography engine
import { decryptMessage, encryptMessage } from './cryptoEngine';

export default function ChatScreen() {
  const router = useRouter();
  const { friendId, friendName } = useLocalSearchParams(); 
  
  const [myUserId, setMyUserId] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null); 

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isBurnerMode, setIsBurnerMode] = useState(false);
  const [revealedMessages, setRevealedMessages] = useState<Record<string, boolean>>({});

  // NEW: State to hold the cryptographic keys
  const [myPrivateKey, setMyPrivateKey] = useState<string | null>(null);
  const [myPublicKey, setMyPublicKey] = useState<string | null>(null);
  const [friendPublicKey, setFriendPublicKey] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: any;

    const loadChatAndKeys = async () => {
      const storedId = await AsyncStorage.getItem('currentUserId');
      if (!storedId) {
        router.replace('/login');
        return;
      }
      setMyUserId(storedId);

      // 1. Load your Private Key from local offline storage
      const storedPrivateKey = await AsyncStorage.getItem('privateKey');
      setMyPrivateKey(storedPrivateKey);

      // 2. Fetch your Public Key from the database
      const myUserSnap = await getDoc(doc(db, 'users', storedId));
      if (myUserSnap.exists()) {
        setMyPublicKey(myUserSnap.data().publicKey);
      }

      // 3. Fetch your Friend's Public Key from the database
      const friendSnap = await getDoc(doc(db, 'users', friendId as string));
      if (friendSnap.exists()) {
        setFriendPublicKey(friendSnap.data().publicKey);
      }

      // 4. Load the chat history
      const chatRoomId = [storedId, friendId].sort().join('_');
      const messagesRef = collection(db, 'chats', chatRoomId, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'asc'));

      unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(fetchedMessages);
      });
    };

    loadChatAndKeys();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [friendId]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    if (!friendPublicKey || !myPublicKey) {
      alert("❌ Cannot establish a secure tunnel. Keys are missing.");
      return;
    }

    const rawText = inputText;
    const replyData = replyingTo ? { id: replyingTo.id, text: replyingTo.text } : null;
    const burnerFlag = isBurnerMode; 
    
    setInputText(''); 
    setReplyingTo(null);
    setShowAttachmentMenu(false);

    try {
      // NEW: The Double-Lock Protocol
      const textForFriend = encryptMessage(rawText, friendPublicKey);
      const textForMe = encryptMessage(rawText, myPublicKey);

      const chatRoomId = [myUserId, friendId].sort().join('_');
      const messagesRef = collection(db, 'chats', chatRoomId, 'messages');
      
      await addDoc(messagesRef, {
        senderId: myUserId,
        textForFriend: textForFriend, // Locked with their key
        textForMe: textForMe,         // Locked with your key
        text: null,                   // Permanently removing plain text
        imageBase64: null, 
        replyTo: replyData, 
        pinned: false,
        isBurner: burnerFlag,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
      alert("❌ Message failed to send.");
    }
  };

  const handleSendImage = async () => {
    setShowAttachmentMenu(false);
    const burnerFlag = isBurnerMode;
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.2, 
        base64: true, 
      });

      if (!result.canceled && result.assets[0].base64) {
        const chatRoomId = [myUserId, friendId].sort().join('_');
        await addDoc(collection(db, 'chats', chatRoomId, 'messages'), {
          senderId: myUserId,
          textForFriend: null,
          textForMe: null, 
          imageBase64: result.assets[0].base64,
          replyTo: null,
          pinned: false,
          isBurner: burnerFlag,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      alert("❌ Failed to send image.");
    }
  };

  const handleCloudinaryUpload = async (type: 'video' | 'audio' | 'file') => {
    setShowAttachmentMenu(false);
    const burnerFlag = isBurnerMode;
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: type === 'video' ? 'video/*' : type === 'audio' ? 'audio/*' : '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      
      setIsUploading(true);
      setUploadStatus(`Encrypting and uploading ${type}...`);

      const data = new FormData();
      if (Platform.OS === 'web') {
        data.append('file', asset.file as any);
      } else {
        data.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' } as any);
      }
      data.append('upload_preset', 'kukachat');

      const response = await fetch('https://api.cloudinary.com/v1_1/ie1p5v4v/auto/upload', {
        method: 'POST',
        body: data,
      });

      const cloudData = await response.json();

      if (cloudData.secure_url) {
        const chatRoomId = [myUserId, friendId].sort().join('_');
        await addDoc(collection(db, 'chats', chatRoomId, 'messages'), {
          senderId: myUserId,
          textForFriend: null,
          textForMe: null,
          mediaUrl: cloudData.secure_url, 
          mediaType: type,
          mediaName: asset.name,
          replyTo: null,
          pinned: false,
          isBurner: burnerFlag,
          createdAt: serverTimestamp()
        });
      } else {
        alert('❌ Cloudinary upload failed.');
      }
    } catch (error) {
      alert('❌ Error processing file.');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const handleRevealBurner = (messageId: string) => {
    setRevealedMessages(prev => ({ ...prev, [messageId]: true }));
    setTimeout(async () => {
      try {
        const chatRoomId = [myUserId, friendId].sort().join('_');
        await deleteDoc(doc(db, 'chats', chatRoomId, 'messages', messageId));
      } catch (error) {
        console.error("Failed to execute self-destruct", error);
      }
    }, 10000); 
  };

  const handleUnsend = async (messageId: string) => {
    try {
      const chatRoomId = [myUserId, friendId].sort().join('_');
      await deleteDoc(doc(db, 'chats', chatRoomId, 'messages', messageId));
      setSelectedMessageId(null);
    } catch (error) { console.error(error); }
  };

  const handlePinToggle = async (messageId: string, currentPinStatus: boolean) => {
    try {
      const chatRoomId = [myUserId, friendId].sort().join('_');
      await updateDoc(doc(db, 'chats', chatRoomId, 'messages', messageId), { pinned: !currentPinStatus });
      setSelectedMessageId(null);
    } catch (error) { console.error(error); }
  };

  const handleReplyClick = (msg: any, decryptedText: string) => {
    const replyText = decryptedText ? decryptedText : msg.mediaName ? `📁 ${msg.mediaName}` : '📷 Photo';
    setReplyingTo({ id: msg.id, text: replyText });
    setSelectedMessageId(null);
    setTimeout(() => { textInputRef.current?.focus(); }, 100);
  };

  const handleDeleteFullChat = async () => {
    setShowHeaderMenu(false);
    try {
      const chatRoomId = [myUserId, friendId].sort().join('_');
      const messagesRef = collection(db, 'chats', chatRoomId, 'messages');
      const snapshot = await getDocs(messagesRef);
      const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
      alert("💥 Chat permanently wiped from the servers.");
      router.replace('/home'); 
    } catch (error) {
      alert("❌ Failed to wipe chat.");
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Sending...';
    const date = timestamp.toDate();
    const fullDay = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${fullDay} at ${time}`; 
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/home')} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{friendName || 'Secure Chat'}</Text>
        <TouchableOpacity onPress={() => { setShowHeaderMenu(!showHeaderMenu); setShowAttachmentMenu(false); }} style={styles.headerMenuBtn}>
          <Text style={styles.headerMenuBtnText}>⋮</Text>
        </TouchableOpacity>
      </View>

      {showHeaderMenu && (
        <View style={styles.headerDropdown}>
          <TouchableOpacity onPress={handleDeleteFullChat} style={styles.headerDropdownItem}>
            <Text style={styles.headerDropdownText}>🗑️ Wipe Entire Chat</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView style={styles.chatArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          onScrollBeginDrag={() => { setShowHeaderMenu(false); setShowAttachmentMenu(false); }} 
        >
          {messages.length === 0 ? (
            <Text style={styles.emptyText}>This is the start of your secure conversation with {friendName}.</Text>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === myUserId;
              const isSelected = selectedMessageId === msg.id;
              const isHiddenBurner = msg.isBurner && !isMe && !revealedMessages[msg.id];

              // NEW: The Decryption Engine Rendering
              let displayMessage = '';
              if (msg.textForMe && msg.textForFriend && myPrivateKey) {
                // If you sent it, decrypt the 'ForMe' version. If they sent it, decrypt the 'ForFriend' version.
                const encryptedCipher = isMe ? msg.textForMe : msg.textForFriend;
                displayMessage = decryptMessage(encryptedCipher, myPrivateKey) || '🔒 [Decryption Failed]';
              } else if (msg.text) {
                // Fallback just in case you have old plain-text messages in your history
                displayMessage = msg.text;
              }

              return (
                <View key={msg.id} style={styles.messageBlock}>
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedMessageId(isSelected ? null : msg.id);
                      setShowHeaderMenu(false); 
                      setShowAttachmentMenu(false);
                    }}
                    style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperThem]}
                  >
                    <View style={[
                      styles.messageBubble, 
                      isMe ? styles.messageBubbleMe : styles.messageBubbleThem,
                      msg.isBurner && styles.burnerBubble
                    ]}>
                      
                      {isHiddenBurner ? (
                        <TouchableOpacity onPress={() => handleRevealBurner(msg.id)} style={styles.revealButton}>
                          <Text style={styles.revealButtonText}>💣 Tap to Reveal (10s)</Text>
                        </TouchableOpacity>
                      ) : (
                        <>
                          {msg.replyTo && (
                            <View style={styles.embeddedReply}>
                              <Text style={styles.embeddedReplyText} numberOfLines={1}>{msg.replyTo.text}</Text>
                            </View>
                          )}

                          {msg.imageBase64 && (
                            <Image source={{ uri: `data:image/jpeg;base64,${msg.imageBase64}` }} style={styles.chatImage} />
                          )}

                          {msg.mediaUrl && (
                            <TouchableOpacity style={styles.mediaContainer} onPress={() => Linking.openURL(msg.mediaUrl)}>
                              <Text style={styles.mediaIcon}>{msg.mediaType === 'video' ? '🎥' : msg.mediaType === 'audio' ? '🎵' : '📄'}</Text>
                              <Text style={styles.mediaNameText} numberOfLines={1}>{msg.mediaName || 'Encrypted File'}</Text>
                            </TouchableOpacity>
                          )}

                          {displayMessage ? (
                            <View style={styles.messageTextRow}>
                              <Text style={styles.messageText}>{displayMessage}</Text>
                              {msg.pinned && <Text style={styles.pinIcon}>📌</Text>}
                              {msg.isBurner && <Text style={styles.pinIcon}>🔥</Text>}
                            </View>
                          ) : (
                            <View style={{flexDirection: 'row'}}>
                              {msg.pinned && <Text style={styles.pinIcon}>📌</Text>}
                              {msg.isBurner && <Text style={styles.pinIcon}>🔥</Text>}
                            </View>
                          )}
                          
                          <Text style={[styles.timestampText, isMe ? styles.timestampTextMe : styles.timestampTextThem]}>
                            {formatTimestamp(msg.createdAt)}
                          </Text>
                        </>
                      )}

                    </View>
                  </TouchableOpacity>

                  {isSelected && !isHiddenBurner && (
                    <View style={[styles.optionsMenu, isMe ? styles.optionsMenuMe : styles.optionsMenuThem]}>
                      <TouchableOpacity style={styles.optionButton} onPress={() => handleReplyClick(msg, displayMessage)}>
                        <Text style={styles.optionText}>Reply</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.optionButton} onPress={() => handlePinToggle(msg.id, msg.pinned)}>
                        <Text style={styles.optionText}>{msg.pinned ? 'Unpin' : 'Pin'}</Text>
                      </TouchableOpacity>
                      {isMe && (
                        <TouchableOpacity style={styles.optionButton} onPress={() => handleUnsend(msg.id)}>
                          <Text style={[styles.optionText, { color: '#EF4444' }]}>Unsend</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.bottomArea}>
          
          {isUploading && (
            <View style={styles.uploadBanner}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={styles.uploadBannerText}>{uploadStatus}</Text>
            </View>
          )}

          {showAttachmentMenu && (
            <View style={styles.attachmentMenu}>
              <TouchableOpacity style={styles.attachmentMenuItem} onPress={handleSendImage}>
                <Text style={styles.attachmentMenuIcon}>🖼️</Text>
                <Text style={styles.attachmentMenuText}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentMenuItem} onPress={() => handleCloudinaryUpload('video')}>
                <Text style={styles.attachmentMenuIcon}>🎥</Text>
                <Text style={styles.attachmentMenuText}>Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentMenuItem} onPress={() => handleCloudinaryUpload('audio')}>
                <Text style={styles.attachmentMenuIcon}>🎵</Text>
                <Text style={styles.attachmentMenuText}>Audio</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentMenuItem} onPress={() => handleCloudinaryUpload('file')}>
                <Text style={styles.attachmentMenuIcon}>📄</Text>
                <Text style={styles.attachmentMenuText}>File</Text>
              </TouchableOpacity>
            </View>
          )}

          {replyingTo && (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText} numberOfLines={1}>Replying to: {replyingTo.text}</Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}><Text style={styles.cancelReplyIcon}>❌</Text></TouchableOpacity>
            </View>
          )}

          <View style={styles.inputContainer}>
            <TouchableOpacity onPress={() => { setShowAttachmentMenu(!showAttachmentMenu); setShowHeaderMenu(false); }} style={styles.attachButton}>
              <Text style={styles.attachButtonIcon}>➕</Text>
            </TouchableOpacity>

            <TextInput
              ref={textInputRef} 
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor="#64748B"
              value={inputText}
              onChangeText={setInputText}
              multiline={true}
              onFocus={() => { setShowHeaderMenu(false); setShowAttachmentMenu(false); }} 
            />
            
            <TouchableOpacity 
              style={[styles.burnerToggleBtn, isBurnerMode && styles.burnerToggleActive]} 
              onPress={() => setIsBurnerMode(!isBurnerMode)}
            >
              <Text style={styles.burnerToggleText}>🔥</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#1E293B', borderBottomWidth: 1, borderColor: '#334155', zIndex: 10 },
  backButton: { paddingVertical: 5, paddingRight: 15 },
  backButtonText: { color: '#6366F1', fontSize: 16, fontWeight: 'bold' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  headerMenuBtn: { paddingVertical: 5, paddingLeft: 20 },
  headerMenuBtnText: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  
  headerDropdown: { position: 'absolute', top: 60, right: 15, backgroundColor: '#1E293B', borderRadius: 12, borderWidth: 1, borderColor: '#334155', zIndex: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  headerDropdownItem: { paddingVertical: 15, paddingHorizontal: 20 },
  headerDropdownText: { color: '#EF4444', fontSize: 14, fontWeight: 'bold' },
  
  chatArea: { flex: 1, backgroundColor: '#0F172A', zIndex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
  
  messageBlock: { marginBottom: 15 },
  messageWrapper: { flexDirection: 'row' },
  messageWrapperMe: { justifyContent: 'flex-end' },
  messageWrapperThem: { justifyContent: 'flex-start' },
  
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16 },
  messageBubbleMe: { backgroundColor: '#6366F1', borderBottomRightRadius: 4 },
  messageBubbleThem: { backgroundColor: '#1E293B', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#334155' },
  
  burnerBubble: { borderColor: '#EF4444', borderWidth: 1 },
  revealButton: { backgroundColor: '#334155', padding: 15, borderRadius: 8, alignItems: 'center' },
  revealButtonText: { color: '#EF4444', fontWeight: 'bold' },

  messageTextRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' },
  messageText: { color: '#FFF', fontSize: 15, lineHeight: 22 },
  pinIcon: { fontSize: 12, marginLeft: 6, marginBottom: 2 },
  chatImage: { width: 220, height: 220, borderRadius: 10, marginBottom: 5 },
  
  mediaContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)', padding: 10, borderRadius: 10, marginBottom: 5, width: 200, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  mediaIcon: { fontSize: 24, marginRight: 10 },
  mediaNameText: { color: '#FFF', fontSize: 13, flex: 1, textDecorationLine: 'underline' },

  timestampText: { fontSize: 10, marginTop: 5, fontStyle: 'italic' },
  timestampTextMe: { color: '#C7D2FE', textAlign: 'right' },
  timestampTextThem: { color: '#94A3B8', textAlign: 'left' },

  embeddedReply: { backgroundColor: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 8, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: '#F8FAFC' },
  embeddedReplyText: { color: '#CBD5E1', fontSize: 13, fontStyle: 'italic' },

  optionsMenu: { flexDirection: 'row', marginTop: 4, gap: 10 },
  optionsMenuMe: { justifyContent: 'flex-end', paddingRight: 10 },
  optionsMenuThem: { justifyContent: 'flex-start', paddingLeft: 10 },
  optionButton: { backgroundColor: '#1E293B', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  optionText: { color: '#94A3B8', fontSize: 12, fontWeight: 'bold' },
  
  bottomArea: { backgroundColor: '#1E293B', borderTopWidth: 1, borderColor: '#334155' },
  
  uploadBanner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#334155', paddingVertical: 10 },
  uploadBannerText: { color: '#FFF', fontSize: 14, marginLeft: 10, fontWeight: 'bold' },

  attachmentMenu: { position: 'absolute', bottom: 85, left: 15, backgroundColor: '#1E293B', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#334155', width: 200, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 10 },
  attachmentMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  attachmentMenuIcon: { fontSize: 20, marginRight: 15 },
  attachmentMenuText: { color: '#F8FAFC', fontSize: 16, fontWeight: 'bold' },

  replyBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#334155', paddingHorizontal: 15, paddingVertical: 10 },
  replyBannerText: { color: '#CBD5E1', fontSize: 13, fontStyle: 'italic', flex: 1, marginRight: 10 },
  cancelReplyIcon: { fontSize: 14 },
  
  inputContainer: { flexDirection: 'row', padding: 15, alignItems: 'center' },
  attachButton: { paddingRight: 12, paddingBottom: 5, justifyContent: 'center', alignItems: 'center' },
  attachButtonIcon: { fontSize: 24, color: '#94A3B8' },
  input: { flex: 1, backgroundColor: '#0F172A', color: '#FFF', borderRadius: 20, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 12, minHeight: 45, maxHeight: 100, borderWidth: 1, borderColor: '#334155', fontSize: 16 },
  
  burnerToggleBtn: { marginLeft: 10, backgroundColor: '#334155', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#475569' },
  burnerToggleActive: { backgroundColor: '#EF4444', borderColor: '#DC2626' },
  burnerToggleText: { fontSize: 18 },

  sendButton: { marginLeft: 10, backgroundColor: '#6366F1', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 12, justifyContent: 'center', alignItems: 'center', height: 45 },
  sendButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});