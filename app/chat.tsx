import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ImageBackground,
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

// Military-grade cryptography engine
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

  const handleCloudinaryUpload = async (type: 'video' | 'audio' | 'file') => {
    setShowAttachmentMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: type === 'video' ? 'video/*' : type === 'audio' ? 'audio/*' : '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      
      setIsUploading(true);
      setUploadStatus(`Encrypting ${type}...`);

      const data = new FormData();
      if (Platform.OS === 'web') {
        data.append('file', asset.file as any);
      } else {
        data.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' } as any);
      }
      data.append('upload_preset', 'kukachat');

      const response = await fetch('https://api.cloudinary.com/v1_1/ie1p5v4v/auto/upload', { method: 'POST', body: data });
      const cloudData = await response.json();

      if (cloudData.secure_url) {
        const chatRoomId = [myUserId, friendId].sort().join('_');
        await addDoc(collection(db, 'chats', chatRoomId, 'messages'), {
          senderId: myUserId,
          mediaUrl: cloudData.secure_url, 
          mediaType: type,
          mediaName: asset.name,
          replyTo: null,
          pinned: false,
          isBurner: isBurnerMode,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {} 
    finally { setIsUploading(false); setUploadStatus(''); }
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
      {/* IG Style Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.replace('/home')} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerAvatarContainer}>
            <Text style={styles.headerAvatarText}>{friendName ? friendName.charAt(0).toUpperCase() : '?'}</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>{friendName || 'Secure Chat'}</Text>
            <Text style={styles.headerSubtitle}>KuKa Hub Vault</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn}><Text style={styles.headerIconText}>📞</Text></TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}><Text style={styles.headerIconText}>📹</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setShowHeaderMenu(!showHeaderMenu)} style={styles.headerIconBtn}>
            <Text style={styles.headerIconText}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showHeaderMenu && (
        <View style={styles.headerDropdown}>
          <TouchableOpacity onPress={handleDeleteFullChat} style={styles.headerDropdownItem}>
            <Text style={styles.headerDropdownText}>🗑️ Wipe Entire Chat</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView style={styles.chatArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Placeholder for custom background image, currently a solid light grey matching the IG aesthetic */}
        <ImageBackground style={styles.scrollBackground} source={{uri: 'https://i.imgur.com/placeholder_bg.jpg'}} resizeMode="cover">
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            onScrollBeginDrag={() => { setShowHeaderMenu(false); setShowAttachmentMenu(false); }} 
          >
            {messages.length === 0 ? (
              <Text style={styles.emptyText}>This is the start of your secure conversation.</Text>
            ) : (
              messages.map((msg, index) => {
                const isMe = msg.senderId === myUserId;
                const isSelected = selectedMessageId === msg.id;
                const isHiddenBurner = msg.isBurner && !isMe && !revealedMessages[msg.id];
                
                // Determine if we should show the friend's avatar next to their message
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
                      
                      {/* Friend's Avatar (Only shows on their messages) */}
                      {!isMe && (
                        <View style={styles.chatAvatarContainer}>
                          {showAvatar && <Text style={styles.chatAvatarText}>{friendName ? friendName.charAt(0) : '?'}</Text>}
                        </View>
                      )}

                      <TouchableOpacity 
                        activeOpacity={0.8}
                        onPress={() => { setSelectedMessageId(isSelected ? null : msg.id); setShowHeaderMenu(false); setShowAttachmentMenu(false); }}
                        style={[
                          styles.messageBubble, 
                          isMe ? styles.messageBubbleMe : styles.messageBubbleThem,
                          msg.isBurner && styles.burnerBubble
                        ]}
                      >
                        {isHiddenBurner ? (
                          <TouchableOpacity onPress={() => handleRevealBurner(msg.id)} style={styles.revealButton}>
                            <Text style={styles.revealButtonText}>💣 Tap to Reveal</Text>
                          </TouchableOpacity>
                        ) : (
                          <>
                            {msg.replyTo && (
                              <View style={styles.embeddedReply}>
                                <Text style={[styles.embeddedReplyText, isMe ? {color: '#CCC'} : {color: '#666'}]} numberOfLines={1}>{msg.replyTo.text}</Text>
                              </View>
                            )}
                            {msg.imageBase64 && <Image source={{ uri: `data:image/jpeg;base64,${msg.imageBase64}` }} style={styles.chatImage} />}
                            {msg.mediaUrl && (
                              <TouchableOpacity style={[styles.mediaContainer, isMe ? {backgroundColor: 'rgba(255,255,255,0.1)'} : {backgroundColor: 'rgba(0,0,0,0.05)'}]} onPress={() => Linking.openURL(msg.mediaUrl)}>
                                <Text style={styles.mediaIcon}>{msg.mediaType === 'video' ? '🎥' : msg.mediaType === 'audio' ? '🎵' : '📄'}</Text>
                                <Text style={[styles.mediaNameText, isMe ? {color: '#FFF'} : {color: '#000'}]} numberOfLines={1}>{msg.mediaName || 'Encrypted File'}</Text>
                              </TouchableOpacity>
                            )}
                            {displayMessage ? (
                              <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>{displayMessage}</Text>
                            ) : null}
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {isSelected && !isHiddenBurner && (
                      <View style={[styles.optionsMenu, isMe ? styles.optionsMenuMe : styles.optionsMenuThem]}>
                        <TouchableOpacity style={styles.optionButton} onPress={() => { setReplyingTo({ id: msg.id, text: displayMessage || 'Attachment' }); setSelectedMessageId(null); }}><Text style={styles.optionText}>Reply</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.optionButton} onPress={() => { updateDoc(doc(db, 'chats', [myUserId, friendId].sort().join('_'), 'messages', msg.id), { pinned: !msg.pinned }); setSelectedMessageId(null); }}><Text style={styles.optionText}>{msg.pinned ? 'Unpin' : 'Pin'}</Text></TouchableOpacity>
                        {isMe && <TouchableOpacity style={styles.optionButton} onPress={() => deleteDoc(doc(db, 'chats', [myUserId, friendId].sort().join('_'), 'messages', msg.id))}><Text style={[styles.optionText, { color: '#EF4444' }]}>Unsend</Text></TouchableOpacity>}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </ImageBackground>

        {/* IG Style Bottom Input Area */}
        <View style={styles.bottomArea}>
          {isUploading && (
            <View style={styles.uploadBanner}>
              <ActivityIndicator size="small" color="#000" />
              <Text style={styles.uploadBannerText}>{uploadStatus}</Text>
            </View>
          )}

          {replyingTo && (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText} numberOfLines={1}>Replying to: {replyingTo.text}</Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}><Text style={styles.cancelReplyIcon}>❌</Text></TouchableOpacity>
            </View>
          )}

          {showAttachmentMenu && (
            <View style={styles.attachmentMenu}>
              <TouchableOpacity style={styles.attachmentMenuItem} onPress={() => handleCloudinaryUpload('video')}><Text style={styles.attachmentMenuIcon}>🎥</Text><Text style={styles.attachmentMenuText}>Video</Text></TouchableOpacity>
              <TouchableOpacity style={styles.attachmentMenuItem} onPress={() => handleCloudinaryUpload('file')}><Text style={styles.attachmentMenuIcon}>📄</Text><Text style={styles.attachmentMenuText}>Document</Text></TouchableOpacity>
            </View>
          )}

          <View style={styles.inputContainer}>
            {/* The Black Camera Icon */}
            <TouchableOpacity style={styles.cameraIconBtn} onPress={handleSendImage}>
              <Text style={styles.cameraIconText}>📷</Text>
            </TouchableOpacity>

            {/* The White Pill Input Box */}
            <View style={styles.inputPill}>
              <TextInput
                ref={textInputRef} 
                style={styles.textInput}
                placeholder="Message..."
                placeholderTextColor="#8E8E8E"
                value={inputText}
                onChangeText={setInputText}
                multiline={true}
                onFocus={() => { setShowHeaderMenu(false); setShowAttachmentMenu(false); }} 
              />
              
              {inputText.trim().length === 0 ? (
                <View style={styles.inlineActionIcons}>
                  <TouchableOpacity onPress={isRecording ? stopRecordingAndSend : startRecording} style={styles.inlineBtn}>
                    <Text style={[styles.inlineIcon, isRecording && {color: 'red'}]}>{isRecording ? '⏹️' : '🎙️'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSendImage} style={styles.inlineBtn}>
                    <Text style={styles.inlineIcon}>🖼️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setIsBurnerMode(!isBurnerMode)} style={styles.inlineBtn}>
                    <Text style={[styles.inlineIcon, isBurnerMode && {color: 'red'}]}>🔥</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowAttachmentMenu(!showAttachmentMenu)} style={styles.inlineBtn}>
                    <Text style={styles.inlineIcon}>➕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={handleSendMessage} style={styles.sendTextBtn}>
                  <Text style={styles.sendTextBtnLabel}>Send</Text>
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
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  
  // Header Styles (Light Mode)
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderColor: '#EAEAEA', zIndex: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 15 },
  backIcon: { fontSize: 24, color: '#000', fontWeight: '400' },
  headerAvatarContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DBDBDB', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerAvatarText: { fontSize: 16, fontWeight: 'bold', color: '#555' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  headerSubtitle: { fontSize: 12, color: '#8E8E8E' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { marginLeft: 18 },
  headerIconText: { fontSize: 20, color: '#000' },

  headerDropdown: { position: 'absolute', top: 60, right: 15, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA', zIndex: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 5 },
  headerDropdownItem: { paddingVertical: 15, paddingHorizontal: 20 },
  headerDropdownText: { color: '#ED4956', fontSize: 14, fontWeight: 'bold' },
  
  // Chat Area
  chatArea: { flex: 1, backgroundColor: '#EFEFEF', zIndex: 1 },
  scrollBackground: { flex: 1, backgroundColor: '#EFEFEF' }, // Swap backgroundColor for an image URL here if you want a wallpaper!
  scrollContent: { paddingHorizontal: 15, paddingVertical: 20, paddingBottom: 40 },
  emptyText: { color: '#8E8E8E', textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
  
  messageBlock: { marginBottom: 8 },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-end' },
  messageWrapperMe: { justifyContent: 'flex-end' },
  messageWrapperThem: { justifyContent: 'flex-start' },
  
  // Bubbles
  chatAvatarContainer: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#DBDBDB', justifyContent: 'center', alignItems: 'center', marginRight: 8, marginBottom: 2 },
  chatAvatarText: { fontSize: 12, fontWeight: 'bold', color: '#555' },
  
  messageBubble: { maxWidth: '75%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22 },
  messageBubbleMe: { backgroundColor: '#262626' }, // IG Dark Grey
  messageBubbleThem: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAEAEA' }, // IG White
  burnerBubble: { borderColor: '#ED4956', borderWidth: 1 },
  
  messageText: { fontSize: 15, lineHeight: 20 },
  messageTextMe: { color: '#FFFFFF' },
  messageTextThem: { color: '#000000' },

  revealButton: { backgroundColor: '#F0F0F0', padding: 10, borderRadius: 8, alignItems: 'center' },
  revealButtonText: { color: '#ED4956', fontWeight: 'bold' },
  
  chatImage: { width: 220, height: 220, borderRadius: 14, marginBottom: 5 },
  mediaContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, marginBottom: 5, width: 200 },
  mediaIcon: { fontSize: 20, marginRight: 8 },
  mediaNameText: { fontSize: 13, flex: 1, textDecorationLine: 'underline' },

  embeddedReply: { backgroundColor: 'rgba(0,0,0,0.05)', padding: 8, borderRadius: 8, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: '#DBDBDB' },
  embeddedReplyText: { fontSize: 13, fontStyle: 'italic' },

  optionsMenu: { flexDirection: 'row', marginTop: 4, gap: 10 },
  optionsMenuMe: { justifyContent: 'flex-end', paddingRight: 10 },
  optionsMenuThem: { justifyContent: 'flex-start', paddingLeft: 46 }, // Offset for avatar
  optionButton: { backgroundColor: '#FFF', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA' },
  optionText: { color: '#262626', fontSize: 12, fontWeight: '600' },
  
  // Bottom Input Area (IG Style)
  bottomArea: { backgroundColor: '#FAFAFA', paddingVertical: 10, paddingHorizontal: 15, borderTopWidth: 1, borderColor: '#EAEAEA' },
  uploadBanner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: 10 },
  uploadBannerText: { color: '#262626', fontSize: 14, marginLeft: 10, fontWeight: '600' },

  attachmentMenu: { position: 'absolute', bottom: 70, right: 20, backgroundColor: '#FFF', borderRadius: 16, padding: 5, borderWidth: 1, borderColor: '#EAEAEA', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10 },
  attachmentMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15 },
  attachmentMenuIcon: { fontSize: 20, marginRight: 12 },
  attachmentMenuText: { color: '#262626', fontSize: 16, fontWeight: '600' },

  replyBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#EFEFEF', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10, marginBottom: 10 },
  replyBannerText: { color: '#8E8E8E', fontSize: 13, fontStyle: 'italic', flex: 1, marginRight: 10 },
  cancelReplyIcon: { fontSize: 14 },
  
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end' },
  
  cameraIconBtn: { backgroundColor: '#000', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10, marginBottom: 3 },
  cameraIconText: { color: '#FFF', fontSize: 18 },
  
  inputPill: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 24, borderWidth: 1, borderColor: '#EAEAEA', minHeight: 44, maxHeight: 100, paddingHorizontal: 5 },
  textInput: { flex: 1, color: '#000', fontSize: 15, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, minHeight: 44 },
  
  inlineActionIcons: { flexDirection: 'row', alignItems: 'center', paddingRight: 5 },
  inlineBtn: { padding: 6 },
  inlineIcon: { fontSize: 20, color: '#262626' },

  sendTextBtn: { paddingHorizontal: 15, paddingVertical: 10 },
  sendTextBtnLabel: { color: '#0095F6', fontWeight: 'bold', fontSize: 16 }, // IG Blue
});