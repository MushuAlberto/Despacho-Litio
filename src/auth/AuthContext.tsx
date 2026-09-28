import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { AuthContextType, SystemUser } from './types';
import { firebaseAuthProvider, fetchUserProfile } from './firebaseAuthProvider';
import { setCurrentUserGlobal } from './authStore';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<SystemUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Synchronize official Firebase auth state changes
  useEffect(() => {
    const unsubscribe = firebaseAuthProvider.onAuthStateChanged((fbUser, userProfile) => {
      setUser(fbUser);
      setProfile(userProfile);
      setCurrentUserGlobal(userProfile);
      setLoading(false);

      if (userProfile && userProfile.active !== false) {
        // Safe visual caching ONLY for UI convenience (e.g., reports author name, AI status)
        // STRICTLY NO passwords, NO tokens, and NO credentials are stored.
        try {
          const safeDisplayCache = {
            uid: userProfile.uid,
            userId: userProfile.uid,
            name: userProfile.name,
            role: userProfile.role,
            enableAi: userProfile.enableAi !== false,
            email: userProfile.email || ''
          };
          localStorage.setItem('sqm_current_user', JSON.stringify(safeDisplayCache));
        } catch (e) {
          // Ignore storage errors
        }
      } else {
        localStorage.removeItem('sqm_current_user');
      }
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<SystemUser> => {
    setLoading(true);
    try {
      const loggedProfile = await firebaseAuthProvider.login({ email, password });
      const currentFbUser = firebaseAuthProvider.getCurrentUser();
      setUser(currentFbUser);
      setProfile(loggedProfile);
      setCurrentUserGlobal(loggedProfile);
      return loggedProfile;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await firebaseAuthProvider.logout();
      setUser(null);
      setProfile(null);
      setCurrentUserGlobal(null);
      localStorage.removeItem('sqm_current_user');
    } finally {
      setLoading(false);
    }
  }, []);

  const getIdToken = useCallback(async (forceRefresh: boolean = false): Promise<string | null> => {
    return firebaseAuthProvider.getIdToken(forceRefresh);
  }, []);

  const getAccessToken = useCallback(async (_scopes?: string[]): Promise<string | null> => {
    return firebaseAuthProvider.getIdToken(false);
  }, []);

  const refreshProfile = useCallback(async (): Promise<SystemUser | null> => {
    const currentFbUser = firebaseAuthProvider.getCurrentUser();
    if (!currentFbUser) {
      setProfile(null);
      setCurrentUserGlobal(null);
      return null;
    }
    const updated = await fetchUserProfile(currentFbUser.uid);
    if (updated) {
      setProfile(updated);
      setCurrentUserGlobal(updated);
      try {
        localStorage.setItem('sqm_current_user', JSON.stringify({
          uid: updated.uid,
          userId: updated.uid,
          name: updated.name,
          role: updated.role,
          enableAi: updated.enableAi !== false,
          email: updated.email || ''
        }));
      } catch (e) {}
    }
    return updated;
  }, []);

  const refreshUserProfile = useCallback(async (): Promise<void> => {
    await refreshProfile();
  }, [refreshProfile]);

  const value: AuthContextType = {
    isAuthenticated: !!user && !!profile && profile.active !== false,
    user,
    profile,
    currentUser: profile, // Compatibility alias
    loading,
    isLoading: loading,   // Compatibility alias
    login,
    logout,
    getIdToken,
    getAccessToken,
    refreshProfile,
    refreshUserProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
