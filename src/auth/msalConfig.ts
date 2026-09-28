import { Configuration, LogLevel, PublicClientApplication, BrowserCacheLocation } from '@azure/msal-browser';

/**
 * Microsoft Entra ID / MSAL Configuration
 * Configured for Single Page Application (SPA) using Authorization Code Flow with PKCE.
 * Does NOT use implicit grant.
 * 
 * Environment variables:
 * - VITE_ENTRA_CLIENT_ID: Application (client) ID from Microsoft Entra Admin Center
 * - VITE_ENTRA_TENANT_ID: Directory (tenant) ID or 'common' / 'organizations'
 * - VITE_ENTRA_REDIRECT_URI: Registered SPA redirect URI (e.g. http://localhost:3000 or production domain)
 */

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID || '';
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID || '';
const redirectUri = import.meta.env.VITE_ENTRA_REDIRECT_URI || (typeof window !== 'undefined' ? window.location.origin : '');

export const msalConfig: Configuration = {
  auth: {
    clientId: clientId.trim(),
    authority: tenantId.trim()
      ? `https://login.microsoftonline.com/${tenantId.trim()}`
      : 'https://login.microsoftonline.com/common',
    redirectUri: redirectUri,
    postLogoutRedirectUri: redirectUri,
  },
  cache: {
    cacheLocation: BrowserCacheLocation.SessionStorage, // Secure session storage for SPAs
  },
  system: {
    loggerOptions: {
      loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
        if (containsPii) return;
        if (level === LogLevel.Error) {
          console.error('[MSAL Error]', message);
        } else if (level === LogLevel.Warning) {
          console.warn('[MSAL Warning]', message);
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
};

/**
 * Standard Scopes requested during login.
 * - User.Read: Allows reading basic user profile information from Microsoft Graph.
 * - openid, profile, email: Standard OpenID Connect scopes for identity & token claims.
 */
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

/**
 * Helper to check if MSAL has been configured with real credentials.
 */
export const isMsalConfigured = (): boolean => {
  return Boolean(clientId && clientId.trim().length > 0 && clientId !== 'undefined');
};

/**
 * Singleton instance of PublicClientApplication
 */
export const msalInstance = new PublicClientApplication(msalConfig);
