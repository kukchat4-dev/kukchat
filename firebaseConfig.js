// 1. Import the Firebase tools needed to run the database
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// 2. Your specific KuKaChat server credentials
const firebaseConfig = {
  apiKey: "AIzaSyAsHpXVslS6KBKXNAcbPPF57XsJBygtYS0",
  authDomain: "kukachat-ed44c.firebaseapp.com",
  projectId: "kukachat-ed44c",
  storageBucket: "kukachat-ed44c.firebasestorage.app",
  messagingSenderId: "462698127585",
  appId: "1:462698127585:android:4b54fc6e4e3284f44c97a0",
  databaseURL: "https://kukachat-ed44c-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// 3. Initialize the app and EXPORT the db so the login screen can see it
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);