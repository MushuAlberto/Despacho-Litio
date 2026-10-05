import type { User as FirebaseUser } from 'firebase/auth';

/**
 * SystemUser represents the authorized user profile within the application.
 * In accordance with zero-trust architecture, authorization is keyed by Firebase UID,
 * not by email, username, or authentication method.
 */
export interface SystemUser {
  uid: string;
  userId: string; // Compatibility alias to uid for existing application modules
  entraOid?: string; // Compatibility alias
  username?: string;
  name: string;
  email?: string;
  role: 'admin' | 'jefe_turno' | 'supervision';
  enableAi?: boolean;
  active?: boolean;
  lastLogin?: string;
}

export interface IAuthProvider {
  login: (credentials?: any) => Promise<SystemUser>;
  logout: () => Promise<void>;
  getCurrentUser: () => FirebaseUser | null;
  getCurrentProfile: () => SystemUser | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  onAuthStateChanged: (
    callback: (user: FirebaseUser | null, profile: SystemUser | null) => void
  ) => () => void;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  user: FirebaseUser | null;
  profile: SystemUser | null;
  currentUser: SystemUser | null; // Compatibility alias to profile
  loading: boolean;
  isLoading: boolean; // Compatibility alias to loading
  login: (email: string, password: string) => Promise<SystemUser>;
  logout: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  getAccessToken?: (scopes?: string[]) => Promise<string | null>;
  refreshProfile: () => Promise<SystemUser | null>;
  refreshUserProfile?: () => Promise<void>;
}
