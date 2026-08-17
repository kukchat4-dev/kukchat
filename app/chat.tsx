import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function ChatScreen() {
  const router = useRouter();
  const { friendId, friendName } = useLocalSearchParams();
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    AsyncStorage.getItem('currentUserId').then((id) => {
      if (id) setMyUserId(id);
      else router.replace('/');
    });
  }, []);

  useEffect(() => {
    if (!myUserId || !friendId) return;

    const chatRoomId = [myUserId, friendId].sort().join('_');
    const messagesRef = collection(db, 'chats', chatRoomId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(fetchedMessages);
    });

    return () => unsubscribe(); 
  }, [myUserId, friendId]);

  const handleSend = async () => {
    if (inputText.trim() === '' || !myUserId) return;

    const chatRoomId = [myUserId, friendId].sort().join('_');
    const messagesRef = collection(db, 'chats', chatRoomId, 'messages');

    const messageData = {
      text: inputText.trim(),
      senderId: myUserId,
      createdAt: serverTimestamp(),
    };

    setInputText(''); 

    try {
      await addDoc(messagesRef, messageData);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === myUserId;
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        <Text style={styles.messageText}>{item.text}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{friendName}</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView 
        style={styles.chatArea} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a secure message..."
            placeholderTextColor="#666"
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  backButton: { padding: 5 },
  backText: { color: '#0095F6', fontSize: 16 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  placeholder: { width: 50 },
  chatArea: { flex: 1 },
  messageList: { padding: 15, paddingBottom: 20 },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16, marginBottom: 10 },
  myMessage: { alignSelf: 'flex-end', backgroundColor: '#0095F6', borderBottomRightRadius: 4 },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: '#222', borderBottomLeftRadius: 4 },
  messageText: { color: '#FFF', fontSize: 15 },
  inputContainer: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#222', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#111', color: '#FFF', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, fontSize: 15, marginRight: 10 },
  sendButton: { backgroundColor: '#0095F6', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 20 },
  sendText: { color: '#FFF', fontWeight: 'bold' }
});