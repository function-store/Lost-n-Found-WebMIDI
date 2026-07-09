import { auth, db } from '../config/firebase';
import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    type User
} from 'firebase/auth';
import {
    doc,
    setDoc,
    getDoc
} from 'firebase/firestore';
import type { PresetMetadataStore } from '../types';

const provider = new GoogleAuthProvider();

export class CloudService {
    currentUser: User | null = null;
    private authListeners: ((user: User | null) => void)[] = [];

    constructor() {
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            this.notifyListeners();
        });
    }

    // Auth
    async login(): Promise<void> {
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    async logout(): Promise<void> {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout failed:', error);
            throw error;
        }
    }

    onUserChange(callback: (user: User | null) => void): void {
        this.authListeners.push(callback);
        // Immediate callback with current state
        callback(this.currentUser);
    }

    private notifyListeners(): void {
        this.authListeners.forEach(cb => cb(this.currentUser));
    }

    // Data
    async savePresets(presets: PresetMetadataStore): Promise<void> {
        if (!this.currentUser) throw new Error('User not logged in');

        try {
            const userDoc = doc(db, 'users', this.currentUser.uid, 'lostnfound', 'presets');
            // Store as a single object "data" to match structure or just the raw map
            // Let's store the map directly as the document fields
            await setDoc(userDoc, { presets }, { merge: true });
        } catch (error) {
            console.error('Save failed:', error);
            throw error;
        }
    }

    async loadPresets(): Promise<PresetMetadataStore | null> {
        if (!this.currentUser) throw new Error('User not logged in');

        try {
            const userDoc = doc(db, 'users', this.currentUser.uid, 'lostnfound', 'presets');
            const snap = await getDoc(userDoc);

            if (snap.exists()) {
                const data = snap.data();
                return (data.presets as PresetMetadataStore) || null;
            }
            return null;
        } catch (error) {
            console.error('Load failed:', error);
            throw error;
        }
    }
}

export const cloudService = new CloudService();
