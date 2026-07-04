/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// This matches the provisioned STUMEDIAKL Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAyYtF8LhY-tGrNVLMbmnUmp5-DIaFXuqU",
  authDomain: "symbolic-campaign-73bk6.firebaseapp.com",
  projectId: "symbolic-campaign-73bk6",
  storageBucket: "symbolic-campaign-73bk6.firebasestorage.app",
  messagingSenderId: "62882916159",
  appId: "1:62882916159:web:9b1f9c4b0c68f3fff4958a"
};

// Initialize Firebase Application
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore with the custom database ID provided in the configuration
const db = initializeFirestore(app, {
  databaseId: "ai-studio-cdc24625-7be8-4c1a-b6d6-029115a1629f"
});

// Initialize Firebase Authentication
const auth = getAuth(app);

// Initialize Firebase Storage
const storage = getStorage(app);

// Export instances to be used in app.js
export { app, db, auth, storage, firebaseConfig };
