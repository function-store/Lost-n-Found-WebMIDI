// Firebase Configuration
// REPLACE these values with your own from the Firebase Console:
// Project Settings -> General -> Your apps -> SDK setup and configuration -> Config

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {

    apiKey: "AIzaSyDyTqIw-OZCKFA8Rgf-SDhRkSvtuzw0mvA",

    authDomain: "lost-n-found-midi.firebaseapp.com",

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
