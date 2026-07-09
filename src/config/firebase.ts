// Firebase Configuration
// REPLACE these values with your own from the Firebase Console:
// Project Settings -> General -> Your apps -> SDK setup and configuration -> Config

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// On the deployed site the OAuth handler is proxied through our own domain
// (see the /__/auth rewrite in vercel.json) so the redirect sign-in flow stays
// same-origin — browsers with partitioned third-party storage break it
// otherwise. Localhost has no such proxy, so it keeps the firebaseapp.com
// handler (popup flow only).
const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Your web app's Firebase configuration
const firebaseConfig = {

    apiKey: "AIzaSyDyTqIw-OZCKFA8Rgf-SDhRkSvtuzw0mvA",

    authDomain: isLocalhost ? "lost-n-found-midi.firebaseapp.com" : window.location.hostname,

    projectId: "lost-n-found-midi",

    storageBucket: "lost-n-found-midi.firebasestorage.app",

    messagingSenderId: "715439358054",

    appId: "1:715439358054:web:df5492852061beb58aada7"

};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);
