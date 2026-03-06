
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey:            "AIzaSyAIneJt8n4ox_5Y-STLCDoO82aeefFJ4YU",
  authDomain:        "audit-pro-3f686.firebaseapp.com",
  projectId:         "audit-pro-3f686",
  storageBucket:     "audit-pro-3f686.firebasestorage.app",
  messagingSenderId: "943579194225",
  appId:             "1:943579194225:web:336f7239d062a5a7170cd0",
  measurementId:     "G-H8V9Z6B7NN"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const analytics   = typeof window !== 'undefined' ? getAnalytics(firebaseApp) : null;

// Supabase remains the primary data backend.
// Firebase is used only for Hosting and Analytics.
export const auth = null;
export const dbRealtime = null;
