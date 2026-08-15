import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
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

  const [myPrivateKey, setMyPrivateKey] = useState<string | null>(null);
  const [myPublicKey, setMyPublicKey] = useState<string | null>(null);
  const [friendPublicKey, setFriendPublicKey] = useState<string | null>(null);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    let unsubscribe: any;

    const loadChatAndKeys = async () => {
      const storedId = await AsyncStorage.getItem('currentUserId');
      if (!storedId) {
        router.replace('/login');
        return;
      }
      setMyUserId(storedId);

      const storedPrivateKey = await AsyncStorage.getItem('privateKey');
      setMyPrivateKey(storedPrivateKey);

      const myUserSnap = await getDoc(doc(db, 'users', storedId));
      if (myUserSnap.exists()) setMyPublicKey(myUserSnap.data().publicKey);

      const friendSnap = await getDoc(doc(db, 'users', friendId as string));
      if (friendSnap.exists()) setFriendPublicKey(friendSnap.data().publicKey);

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
    return () => { if (unsubscribe) unsubscribe(); };
  }, [friendId]);

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (err) { alert('❌ Microphone access denied.'); }
  };

  const stopRecordingAndSend = async () => {
    if (!recording) return;
    setIsRecording(false);
    setIsUploading(true);
    setUploadStatus('Encrypting Voice Note...');

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    if (!uri) { setIsUploading(false); return; }

    try {
      const data = new FormData();
      const filename = uri.split('/').pop() || 'voicenote.m4a';
      data.append('file', { uri, name: filename, type: 'audio/m4a' } as any);
      data.append('upload_preset', 'kukachat');

      const response = await fetch('https://api.cloudinary.com/v1_1/ie1p5v4v/auto/upload', { method: 'POST', body: data });
      const cloudData = await response.json();

      if (cloudData.secure_url) {
        const chatRoomId = [myUserId, friendId].sort().join('_');
        await addDoc(collection(db, 'chats', chatRoomId, 'messages'), {
          senderId: myUserId,
          textForFriend: null,
          textForMe: null,
          mediaUrl: cloudData.secure_url, 
          mediaType: 'audio',
          mediaName: '🎙️ Voice Note',
          replyTo: null,
          pinned: false,
          isBurner: isBurnerMode,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) { alert('❌ Failed to upload voice note.'); } 
    finally { setIsUploading(false); setUploadStatus(''); }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    if (!friendPublicKey || !myPublicKey) return;

    const rawText = inputText;
    const replyData = replyingTo ? { id: replyingTo.id, text: replyingTo.text } : null;
    const burnerFlag = isBurnerMode; 
    
    setInputText(''); 
    setReplyingTo(null);
    setShowAttachmentMenu(false);

    try {
      const textForFriend = encryptMessage(rawText, friendPublicKey);
      const textForMe = encryptMessage(rawText, myPublicKey);
      const chatRoomId = [myUserId, friendId].sort().join('_');
      
      await addDoc(collection(db, 'chats', chatRoomId, 'messages'), {
        senderId: myUserId,
        textForFriend: textForFriend,
        textForMe: textForMe,
        text: null,
        imageBase64: null, 
        replyTo: replyData, 
        pinned: false,
        isBurner: burnerFlag,
        createdAt: serverTimestamp()
      });
    } catch (error) {}
  };

  const handleSendImage = async () => {
    setShowAttachmentMenu(false);
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
          imageBase64: result.assets[0].base64,
          replyTo: null,
          pinned: false,
          isBurner: isBurnerMode,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {}
  };

  const handleRevealBurner = (messageId: string) => {
    setRevealedMessages(prev => ({ ...prev, [messageId]: true }));
    setTimeout(async () => {
      try {
        const chatRoomId = [myUserId, friendId].sort().join('_');
        await deleteDoc(doc(db, 'chats', chatRoomId, 'messages', messageId));
      } catch (error) {}
    }, 10000); 
  };

  const handleDeleteFullChat = async () => {
    setShowHeaderMenu(false);
    try {
      const chatRoomId = [myUserId, friendId].sort().join('_');
      const messagesRef = collection(db, 'chats', chatRoomId, 'messages');
      const snapshot = await getDocs(messagesRef);
      const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
      router.replace('/home'); 
    } catch (error) {}
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 1. GLOWING NEON HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.replace('/home')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={26} color="#FFF" style={styles.glowIcon} />
          </TouchableOpacity>
          <View style={[styles.headerAvatarContainer, styles.glowBox]}>
            <Text style={styles.headerAvatarText}>{friendName ? friendName.charAt(0).toUpperCase() : '?'}</Text>
          </View>
          <View>
            <Text style={[styles.headerTitle, styles.glowText]}>{friendName || 'Secure Chat'}</Text>
            <Text style={[styles.headerSubtitle, styles.glowText]}>KuKa Hub Vault</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="call" size={22} color="#FFF" style={styles.glowIcon} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="videocam" size={24} color="#FFF" style={styles.glowIcon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowHeaderMenu(!showHeaderMenu)} style={styles.headerIconBtn}>
            <Ionicons name="ellipsis-vertical" size={24} color="#FFF" style={styles.glowIcon} />
          </TouchableOpacity>
        </View>
      </View>

      {showHeaderMenu && (
        <View style={[styles.headerDropdown, styles.glowBox]}>
          <TouchableOpacity onPress={handleDeleteFullChat} style={styles.headerDropdownItem}>
            <Text style={[styles.headerDropdownText, {color: '#FFF'}]}>Wipe Entire Chat</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. PURE BLACK CHAT AREA */}
      <KeyboardAvoidingView style={styles.chatArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          onScrollBeginDrag={() => { setShowHeaderMenu(false); setShowAttachmentMenu(false); }} 
        >
          {messages.length === 0 ? (
            <Text style={[styles.emptyText, styles.glowText]}>This is the start of your secure conversation.</Text>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.senderId === myUserId;
              const isSelected = selectedMessageId === msg.id;
              const isHiddenBurner = msg.isBurner && !isMe && !revealedMessages[msg.id];
              
              const showAvatar = !isMe && (index === messages.length - 1 || messages[index + 1]?.senderId === myUserId);

              let displayMessage = '';
              if (msg.textForMe && msg.textForFriend && myPrivateKey) {
                const encryptedCipher = isMe ? msg.textForMe : msg.textForFriend;
                displayMessage = decryptMessage(encryptedCipher, myPrivateKey) || '🔒 [Decryption Failed]';
              } else if (msg.text) {
                displayMessage = msg.text;
              }

              return (
                <View key={msg.id} style={styles.messageBlock}>
                  <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperThem]}>
                    
                    {!isMe && (
                      <View style={[styles.chatAvatarContainer, styles.glowBox]}>
                        {showAvatar && <Text style={styles.chatAvatarText}>{friendName ? friendName.charAt(0) : '?'}</Text>}
                      </View>
                    )}

                    <TouchableOpacity 
                      activeOpacity={0.8}
                      onPress={() => { setSelectedMessageId(isSelected ? null : msg.id); setShowHeaderMenu(false); setShowAttachmentMenu(false); }}
                      style={[
                        styles.messageBubble, 
                        styles.glowBox,
                        msg.isBurner && { borderColor: '#FF3333', shadowColor: '#FF3333' }
                      ]}
                    >
                      {isHiddenBurner ? (
                        <TouchableOpacity onPress={() => handleRevealBurner(msg.id)} style={styles.revealButton}>
                          <Text style={[styles.revealButtonText, styles.glowText]}>💣 Reveal</Text>
                        </TouchableOpacity>
                      ) : (
                        <>
                          {msg.replyTo && (
                            <View style={styles.embeddedReply}>
                              <Text style={[styles.embeddedReplyText, styles.glowText]} numberOfLines={1}>{msg.replyTo.text}</Text>
                            </View>
                          )}
                          {msg.imageBase64 && <Image source={{ uri: `data:image/jpeg;base64,${msg.imageBase64}` }} style={styles.chatImage} />}
                          {msg.mediaUrl && (
                            <TouchableOpacity style={styles.mediaContainer} onPress={() => Linking.openURL(msg.mediaUrl)}>
                              <Text style={styles.mediaIcon}>{msg.mediaType === 'video' ? '🎥' : msg.mediaType === 'audio' ? '🎵' : '📄'}</Text>
                              <Text style={[styles.mediaNameText, styles.glowText]} numberOfLines={1}>{msg.mediaName || 'Encrypted File'}</Text>
                            </TouchableOpacity>
                          )}
                          {displayMessage ? (
                            <Text style={[styles.messageText, styles.glowText]}>{displayMessage}</Text>
                          ) : null}
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {isSelected && !isHiddenBurner && (
                    <View style={[styles.optionsMenu, isMe ? styles.optionsMenuMe : styles.optionsMenuThem]}>
                      <TouchableOpacity style={[styles.optionButton, styles.glowBox]} onPress={() => { setReplyingTo({ id: msg.id, text: displayMessage || 'Attachment' }); setSelectedMessageId(null); }}>
                        <Text style={[styles.optionText, styles.glowText]}>Reply</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.optionButton, styles.glowBox]} onPress={() => { updateDoc(doc(db, 'chats', [myUserId, friendId].sort().join('_'), 'messages', msg.id), { pinned: !msg.pinned }); setSelectedMessageId(null); }}>
                        <Text style={[styles.optionText, styles.glowText]}>{msg.pinned ? 'Unpin' : 'Pin'}</Text>
                      </TouchableOpacity>
                      {isMe && (
                        <TouchableOpacity style={[styles.optionButton, styles.glowBox, { borderColor: '#FF3333', shadowColor: '#FF3333' }]} onPress={() => deleteDoc(doc(db, 'chats', [myUserId, friendId].sort().join('_'), 'messages', msg.id))}>
                          <Text style={[styles.optionText, styles.glowText, { color: '#FF3333', textShadowColor: '#FF3333' }]}>Unsend</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* 3. GLOWING BOTTOM INPUT AREA */}
        <View style={styles.bottomArea}>
          {isUploading && (
            <View style={styles.uploadBanner}>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={[styles.uploadBannerText, styles.glowText]}>{uploadStatus}</Text>
            </View>
          )}

          {replyingTo && (
            <View style={[styles.replyBanner, styles.glowBox]}>
              <Text style={[styles.replyBannerText, styles.glowText]} numberOfLines={1}>Replying to: {replyingTo.text}</Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}><Text style={styles.cancelReplyIcon}>❌</Text></TouchableOpacity>
            </View>
          )}

          <View style={styles.inputContainer}>
            <TouchableOpacity style={[styles.cameraIconBtn, styles.glowBox]} onPress={handleSendImage}>
              <Ionicons name="camera" size={24} color="#FFF" style={styles.glowIcon} />
            </TouchableOpacity>

            <View style={[styles.inputPill, styles.glowBox]}>
              <TextInput
                ref={textInputRef} 
                style={[styles.textInput, styles.glowText]}
                placeholder="Message..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={inputText}
                onChangeText={setInputText}
                multiline={true}
              />
              
              {inputText.trim().length === 0 ? (
                <View style={styles.inlineActionIcons}>
                  <TouchableOpacity onPress={isRecording ? stopRecordingAndSend : startRecording} style={styles.inlineBtn}>
                    <Ionicons name={isRecording ? "stop-circle" : "mic"} size={24} color="#FFF" style={styles.glowIcon} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSendImage} style={styles.inlineBtn}>
                    <Ionicons name="image" size={24} color="#FFF" style={styles.glowIcon} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setIsBurnerMode(!isBurnerMode)} style={styles.inlineBtn}>
                    <Ionicons name="flame" size={24} color={isBurnerMode ? "#FF3333" : "#FFF"} style={isBurnerMode ? {textShadowColor: '#FF3333', textShadowRadius: 10} : styles.glowIcon} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowAttachmentMenu(!showAttachmentMenu)} style={styles.inlineBtn}>
                    <Ionicons name="add-circle" size={24} color="#FFF" style={styles.glowIcon} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={handleSendMessage} style={styles.sendTextBtn}>
                  <Text style={[styles.sendTextBtnLabel, styles.glowText]}>Send</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // CORE: PURE BLACK EVERYWHERE
  container: { flex: 1, backgroundColor: '#000000' },
  chatArea: { flex: 1, backgroundColor: '#000000', zIndex: 1 },
  scrollContent: { paddingHorizontal: 15, paddingVertical: 20, paddingBottom: 40, backgroundColor: '#000000' },
  bottomArea: { backgroundColor: '#000000', paddingVertical: 10, paddingHorizontal: 15 },
  
  // CORE: NEON WHITE GLOW EFFECTS
  glowText: { 
    color: '#FFFFFF', 
    textShadowColor: 'rgba(255, 255, 255, 0.9)', 
    textShadowOffset: { width: 0, height: 0 }, 
    textShadowRadius: 8 
  },
  glowIcon: { 
    textShadowColor: 'rgba(255, 255, 255, 0.9)', 
    textShadowOffset: { width: 0, height: 0 }, 
    textShadowRadius: 8 
  },
  glowBox: {
    backgroundColor: '#000000',
    borderColor: '#FFFFFF',
    borderWidth: 1,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4
  },

  // UI ELEMENTS
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: '#FFF', shadowColor: '#FFF', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.4, shadowRadius: 4, elevation: 5, zIndex: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 15 },
  headerAvatarContainer: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerAvatarText: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { marginLeft: 15, padding: 5 },

  headerDropdown: { position: 'absolute', top: 60, right: 15, borderRadius: 12, zIndex: 50 },
  headerDropdownItem: { paddingVertical: 15, paddingHorizontal: 20 },
  headerDropdownText: { fontSize: 14, fontWeight: 'bold' },
  
  emptyText: { textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
  
  messageBlock: { marginBottom: 16 },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-end' },
  messageWrapperMe: { justifyContent: 'flex-end' },
  messageWrapperThem: { justifyContent: 'flex-start' },
  
  chatAvatarContainer: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10, marginBottom: 2 },
  chatAvatarText: { fontSize: 12, fontWeight: 'bold', color: '#FFF' },
  
  messageBubble: { maxWidth: '75%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22 },
  messageText: { fontSize: 15, lineHeight: 22 },

  revealButton: { backgroundColor: '#000', padding: 10, borderRadius: 8, alignItems: 'center' },
  revealButtonText: { fontWeight: 'bold' },
  
  chatImage: { width: 220, height: 220, borderRadius: 14, marginBottom: 5, borderColor: '#FFF', borderWidth: 1 },
  mediaContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, marginBottom: 5, width: 200, backgroundColor: '#000', borderColor: '#FFF', borderWidth: 1 },
  mediaIcon: { fontSize: 20, marginRight: 8 },
  mediaNameText: { fontSize: 13, flex: 1, textDecorationLine: 'underline' },

  embeddedReply: { backgroundColor: '#000', padding: 8, borderRadius: 8, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: '#FFF' },
  embeddedReplyText: { fontSize: 13, fontStyle: 'italic' },

  optionsMenu: { flexDirection: 'row', marginTop: 6, gap: 10 },
  optionsMenuMe: { justifyContent: 'flex-end', paddingRight: 10 },
  optionsMenuThem: { justifyContent: 'flex-start', paddingLeft: 46 }, 
  optionButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12 },
  optionText: { fontSize: 12, fontWeight: '600' },
  
  uploadBanner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: 10 },
  uploadBannerText: { fontSize: 14, marginLeft: 10, fontWeight: '600' },

  replyBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10, marginBottom: 10 },
  replyBannerText: { fontSize: 13, fontStyle: 'italic', flex: 1, marginRight: 10 },
  cancelReplyIcon: { fontSize: 14 },
  
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end' },
  
  cameraIconBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 10, marginBottom: 2 },
  
  inputPill: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 24, minHeight: 46, maxHeight: 100, paddingHorizontal: 5 },
  textInput: { flex: 1, fontSize: 15, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, minHeight: 46 },
  
  inlineActionIcons: { flexDirection: 'row', alignItems: 'center', paddingRight: 5 },
  inlineBtn: { padding: 6 },

  sendTextBtn: { paddingHorizontal: 15, paddingVertical: 12 },
  sendTextBtnLabel: { fontWeight: 'bold', fontSize: 16 },
});