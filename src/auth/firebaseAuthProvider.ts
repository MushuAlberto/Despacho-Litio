import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { IAuthProvider, SystemUser } from './types';

/**
 * Fetch the user's application profile from Firestore (`users/{uid}`).
 * Does not contain passwords or credentials.
 */
export async function fetchUserProfile(uid: string): Promise<SystemUser | null> {
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        uid,
        userId: uid,
        username: data.username || data.email?.split('@')[0] || uid,
        name: data.name || 'Usuario',
        email: data.email || auth.currentUser?.email || '',
        role: data.role || 'supervision',
        enableAi: data.enableAi !== false,
        active: data.active !== false,
        lastLogin: data.lastLogin || new Date().toISOString()
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching user profile from Firestore:', error);
    return null;
  }
}

/**
 * FirebaseAuthProvider implements the abstract IAuthProvider using Firebase Authentication (Email/Password)
 * for development, coupled with Firestore `users/{uid}` for profile & RBAC authorization.
 */
export class FirebaseAuthProvider implements IAuthProvider {
  private currentProfile: SystemUser | null = null;

  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  getCurrentProfile(): SystemUser | null {
    return this.currentProfile;
  }

  async getIdToken(forceRefresh: boolean = false): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken(forceRefresh);
  }

  /**
   * Authenticates against Firebase Authentication with email/password.
   * Never inspects or checks passwords manually.
   * Then loads the Firestore profile for `uid` and verifies `active !== false`.
   */
  async login(credentials: { email: string; password: string }): Promise<SystemUser> {
    const { email, password } = credentials;

    if (!email || !password) {
      throw new Error('Debe proporcionar correo y contraseña.');
    }

    // 1. Authenticate with Firebase Authentication
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const fbUser = userCredential.user;
    const uid = fbUser.uid;

    // 2. Fetch authorized profile from Firestore
    let profile = await fetchUserProfile(uid);

    // If profile does not exist yet (e.g. freshly created test account in Firebase Console),
    // provision a default development profile with role matching developer email or default
    if (!profile) {
      const isSuperAdminEmail = fbUser.email?.toLowerCase().includes('cristiantapia') || fbUser.email?.toLowerCase().includes('admin');
      const newProfile: SystemUser = {
        uid,
        userId: uid,
        username: fbUser.email?.split('@')[0] || uid,
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuario SQM',
        email: fbUser.email || '',
        role: isSuperAdminEmail ? 'admin' : 'supervision',
        enableAi: true,
        active: true,
        lastLogin: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'users', uid), {
          ...newProfile,
          lastLogin: new Date().toISOString()
        });
        profile = newProfile;
      } catch (err) {
        console.warn('Could not auto-create profile document:', err);
        profile = newProfile;
      }
    }

    // 3. Enforce active check
    if (profile.active === false) {
      await signOut(auth);
      this.currentProfile = null;
      throw new Error('Su cuenta ha sido desactivada por un administrador.');
    }

    // 4. Update last login timestamp asynchronously
    try {
      await setDoc(doc(db, 'users', uid), { lastLogin: new Date().toISOString() }, { merge: true });
    } catch (e) {
      // Non-blocking
    }

    this.currentProfile = profile;
    return profile;
  }

  /**
   * Logs out from Firebase Authentication and clears profile state.
   */
  async logout(): Promise<void> {
    this.currentProfile = null;
    await signOut(auth);
  }

  /**
   * Listens to Firebase Auth state changes.
   * Rehydrates the Firestore profile for the authenticated UID.
   */
  onAuthStateChanged(
    callback: (user: FirebaseUser | null, profile: SystemUser | null) => void
  ): () => void {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const profile = await fetchUserProfile(fbUser.uid);

        if (profile && profile.active === false) {
          console.warn('Usuario desactivado detectado en onAuthStateChanged. Cerrando sesión...');
          await signOut(auth);
          this.currentProfile = null;
          callback(null, null);
          return;
        }

        if (profile) {
          this.currentProfile = profile;
          callback(fbUser, profile);
        } else {
          // Fallback profile if Firestore doc hasn't been created yet
          const fallbackProfile: SystemUser = {
            uid: fbUser.uid,
            userId: fbUser.uid,
            username: fbUser.email?.split('@')[0] || fbUser.uid,
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuario SQM',
            email: fbUser.email || '',
            role: (fbUser.email?.toLowerCase().includes('cristiantapia') || fbUser.email?.toLowerCase().includes('admin')) ? 'admin' : 'supervision',
            enableAi: true,
            active: true
          };
          this.currentProfile = fallbackProfile;
          callback(fbUser, fallbackProfile);
        }
      } else {
        this.currentProfile = null;
        callback(null, null);
      }
    });
  }
}

export const firebaseAuthProvider = new FirebaseAuthProvider();
