import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// This tells the app how to behave if a notification arrives while you have the app open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  // 1. Emulators and web browsers cannot receive push tokens. It MUST be a physical phone.
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  // 2. Check if we already have permission, if not, ask the user
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return null;
  }

  // 3. Get the unique Expo Push Token for this specific phone
  try {
    // Note: If you eventually build with EAS, you will need to pass your project ID here.
    // For now, Expo handles it automatically in development.
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log("Your Expo Push Token: ", token);
  } catch (e) {
    console.log("Error generating token:", e);
  }

  // 4. Android strictly requires a "Notification Channel" to vibrate or make sound
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}