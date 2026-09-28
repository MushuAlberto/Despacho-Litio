import { SystemUser } from '../services/firebase';

/**
 * In-memory global store for the authenticated SystemUser.
 * Strictly avoids saving tokens, passwords, or session objects into localStorage.
 * MSAL itself manages session tokens in secure sessionStorage.
 */

let currentAuthenticatedUser: SystemUser | null = null;
const listeners = new Set<(user: SystemUser | null) => void>();

export function getCurrentUser(): SystemUser | null {
  return currentAuthenticatedUser;
}

export function setCurrentUserGlobal(user: SystemUser | null): void {
  currentAuthenticatedUser = user;
  listeners.forEach((listener) => {
    try {
      listener(user);
    } catch (e) {
      console.error('Error in authStore listener:', e);
    }
  });
}

export function subscribeCurrentUser(listener: (user: SystemUser | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
