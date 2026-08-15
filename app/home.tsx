import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const storedId = await AsyncStorage.getItem('currentUserId');
      if (!storedId) {
        router.replace('/login');
      } else {
        setMyUserId(storedId);
      }
    };
    checkUser();
  }, []);

  // --- MOCK DATA FOR UI DESIGN ---
  const stories = [
    { id: '1', name: 'Your story', isMe: true, image: 'https://i.imgur.com/placeholder1.jpg' },
    { id: '2', name: 'Viru', isMe: false, image: 'https://i.imgur.com/placeholder2.jpg' },
    { id: '3', name: 'Loka', isMe: false, image: 'https://i.imgur.com/placeholder3.jpg' },
    { id: '4', name: 'JAAAT', isMe: false, image: 'https://i.imgur.com/placeholder4.jpg' },
    { id: '5', name: 'Nisha', isMe: false, image: 'https://i.imgur.com/placeholder5.jpg' },
  ];

  const feedPosts = [
    {
      id: '101',
      author: 'Viru',
      authorImage: 'https://i.imgur.com/placeholder2.jpg',
      location: 'Jodhpur, Rajasthan',
      postImage: 'https://i.imgur.com/placeholder_feed1.jpg',
      likes: '1,204',
      caption: 'Exploring the blue city. The architecture here never gets old! 🏰✨',
      time: '2 hours ago'
    },
    {
      id: '102',
      author: 'Loka',
      authorImage: 'https://i.imgur.com/placeholder3.jpg',
      location: 'India',
      postImage: 'https://i.imgur.com/placeholder_feed2.jpg',
      likes: '856',
      caption: 'Late night coding sessions... KuKa Hub is going to be massive. 💻🔥',
      time: '5 hours ago'
    }
  ];

  const navigateToChat = () => {
    // For now, this acts as a quick shortcut to test your chat vault!
    // We will build a real inbox screen next.
    router.push({ pathname: '/chat', params: { friendId: '8209525890', friendName: 'JAAAT' } });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. TOP NAVIGATION BAR */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.logoText}>KuKa Hub</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Text style={styles.headerIcon}>➕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Text style={styles.headerIcon}>❤️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={navigateToChat}>
            <Text style={styles.headerIcon}>💬</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
        
        {/* 2. STORIES SECTION */}
        <View style={styles.storiesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
            {stories.map((story) => (
              <TouchableOpacity key={story.id} style={styles.storyItem}>
                <View style={[styles.storyRing, story.isMe ? styles.storyRingMe : styles.storyRingFriend]}>
                  <View style={styles.storyAvatarContainer}>
                    <Text style={styles.dummyAvatarText}>{story.name.charAt(0)}</Text>
                    {/* <Image source={{ uri: story.image }} style={styles.storyAvatar} /> */}
                  </View>
                </View>
                {story.isMe && (
                  <View style={styles.addStoryBadge}>
                    <Text style={styles.addStoryText}>+</Text>
                  </View>
                )}
                <Text style={styles.storyName} numberOfLines={1}>
                  {story.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 3. MAIN FEED SECTION */}
        {feedPosts.map((post) => (
          <View key={post.id} style={styles.postContainer}>
            {/* Post Header */}
            <View style={styles.postHeader}>
              <View style={styles.postHeaderLeft}>
                <View style={styles.postAvatar}>
                  <Text style={styles.dummyAvatarText}>{post.author.charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.postAuthor}>{post.author}</Text>
                  {post.location && <Text style={styles.postLocation}>{post.location}</Text>}
                </View>
              </View>
              <TouchableOpacity>
                <Text style={styles.postOptionsIcon}>⋮</Text>
              </TouchableOpacity>
            </View>

            {/* Post Image (Placeholder grey box for now) */}
            <View style={styles.postImagePlaceholder}>
               <Text style={styles.postImageText}>Content from {post.author}</Text>
            </View>

            {/* Post Actions */}
            <View style={styles.postActions}>
              <View style={styles.postActionsLeft}>
                <TouchableOpacity style={styles.actionBtn}><Text style={styles.actionIcon}>❤️</Text></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}><Text style={styles.actionIcon}>💬</Text></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}><Text style={styles.actionIcon}>✈️</Text></TouchableOpacity>
              </View>
              <TouchableOpacity><Text style={styles.actionIcon}>📌</Text></TouchableOpacity>
            </View>

            {/* Post Details */}
            <View style={styles.postDetails}>
              <Text style={styles.likesText}>{post.likes} likes</Text>
              <Text style={styles.captionText}>
                <Text style={styles.captionAuthor}>{post.author} </Text>
                {post.caption}
              </Text>
              <Text style={styles.timeText}>{post.time}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 4. BOTTOM NAVIGATION BAR */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}><Text style={styles.navIcon}>🏠</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem}><Text style={styles.navIcon}>🔍</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem}><Text style={styles.navIcon}>🎬</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem}><Text style={styles.navIcon}>🛍️</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <View style={styles.navProfileAvatar}>
            <Text style={styles.navProfileText}>S</Text>
          </View>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  
  // Top Header
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, height: 55, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EFEFEF' },
  headerLeft: { flex: 1 },
  logoText: { fontSize: 24, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', color: '#000' }, // Gives it that cursive/stylized feel
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { marginLeft: 20 },
  headerIcon: { fontSize: 24, color: '#000' },

  mainScroll: { flex: 1 },

  // Stories Section
  storiesContainer: { borderBottomWidth: 1, borderBottomColor: '#EFEFEF', backgroundColor: '#FFFFFF', paddingBottom: 10 },
  storiesScroll: { paddingHorizontal: 10, paddingVertical: 12 },
  storyItem: { alignItems: 'center', marginRight: 15, position: 'relative' },
  storyRing: { width: 74, height: 74, borderRadius: 37, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  storyRingFriend: { borderColor: '#D92E7F' }, // IG Pink/Red color
  storyRingMe: { borderColor: '#EFEFEF' },
  storyAvatarContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  dummyAvatarText: { fontSize: 24, color: '#999', fontWeight: 'bold' },
  addStoryBadge: { position: 'absolute', bottom: 20, right: 0, backgroundColor: '#0095F6', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  addStoryText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginTop: -2 },
  storyName: { fontSize: 11, color: '#262626', marginTop: 5, maxWidth: 74 },

  // Feed Section
  postContainer: { marginBottom: 15, backgroundColor: '#FFFFFF' },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  postHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  postAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFEFEF', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  postAuthor: { fontSize: 13, fontWeight: '700', color: '#262626' },
  postLocation: { fontSize: 11, color: '#8E8E8E' },
  postOptionsIcon: { fontSize: 18, color: '#262626', paddingHorizontal: 5 },
  
  postImagePlaceholder: { width: '100%', height: 400, backgroundColor: '#FAFAFA', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EFEFEF' },
  postImageText: { color: '#999', fontSize: 16, fontWeight: 'bold' },

  postActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  postActionsLeft: { flexDirection: 'row' },
  actionBtn: { marginRight: 15 },
  actionIcon: { fontSize: 24, color: '#262626' },

  postDetails: { paddingHorizontal: 12 },
  likesText: { fontWeight: '700', fontSize: 13, color: '#262626', marginBottom: 4 },
  captionText: { fontSize: 13, color: '#262626', lineHeight: 18 },
  captionAuthor: { fontWeight: '700' },
  timeText: { fontSize: 11, color: '#8E8E8E', marginTop: 6, marginBottom: 10 },

  // Bottom Navigation Bar
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', height: 50, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EFEFEF', paddingBottom: Platform.OS === 'ios' ? 15 : 0 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { fontSize: 24, color: '#262626' },
  navProfileAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#EFEFEF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#262626' },
  navProfileText: { fontSize: 12, fontWeight: 'bold', color: '#555' }
});