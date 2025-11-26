import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

declare global {
  var __firebase_config: string | undefined;
}

// User provided configuration
const hardcodedConfig = {
  apiKey: "AIzaSyBnghesg5_foHwkKKuNKHnocZmRzdDROQs",
  authDomain: "sleek-school-portal.firebaseapp.com",
  projectId: "sleek-school-portal",
  storageBucket: "sleek-school-portal.firebasestorage.app",
  messagingSenderId: "916515411940",
  appId: "1:916515411940:web:4cd77a80a20ce2b0f359f1",
  measurementId: "G-GMNZMXR715"
};

let firebaseConfig = hardcodedConfig;

try {
  // Attempt to parse the global config if it exists (injected by environment)
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    const parsed = JSON.parse(__firebase_config);
    if (parsed && typeof parsed === 'object' && parsed.apiKey) {
      firebaseConfig = parsed;
    } else {
      console.warn("Injected __firebase_config is missing apiKey. Using hardcoded config.");
    }
  }
} catch (e) {
  console.warn('Could not parse __firebase_config, falling back to hardcoded config.');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with experimentalForceLongPolling to prevent "Backend didn't respond within 10 seconds" errors
// This forces the client to use HTTP long-polling instead of WebSockets, which is more stable in restricted networks.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});