/**
 * entraAuthProvider.ts
 *
 * PLAN DE MIGRACIÓN CORPORATIVA / ARQUITECTURA FUTURA: MICROSOFT ENTRA ID
 * =========================================================================
 *
 * Cuando la organización incorpore la aplicación al tenant de Microsoft Entra,
 * este proveedor se activará como reemplazo del proveedor directo de email/password.
 *
 * FLUJO DE ARQUITECTURA:
 * ---------------------
 * 1. El frontend (React) inicializará `@azure/msal-browser` con las credenciales
 *    corporativas (Client ID, Tenant ID) provistas por el departamento de TI.
 * 2. El usuario inicia sesión en Microsoft (SSO / Authenticator / MFA institucional).
 * 3. MSAL entrega un idToken / accessToken de Microsoft al frontend.
 * 4. El frontend envía el token a la ruta backend segura:
 *      POST /api/auth/entra
 *      Headers: { Authorization: `Bearer ${microsoftToken}` }
 * 5. El backend valida el token de Microsoft (usando jwks de Microsoft / Azure AD).
 * 6. El backend extrae el Object ID (OID) o correo institucional y utiliza el
 *    Firebase Admin SDK:
 *      const customToken = await admin.auth().createCustomToken(entraOid, {
 *        email: entraEmail,
 *        entraTenant: tenantId
 *      });
 * 7. El backend devuelve `{ customToken }` al frontend.
 * 8. El frontend llama a Firebase Authentication:
 *      const credential = await signInWithCustomToken(auth, customToken);
 * 9. Firebase Authentication emite el Firebase ID Token estándar.
 * 10. Se recupera el perfil Firestore `users/{credential.user.uid}`.
 * 11. El resto de la aplicación (SlitDashboard, CambioDeTurno, Reportes, Stokes,
 *     Galería, logs, etc.) funciona SIN MODIFICAR UNA SOLA LÍNEA DE CÓDIGO,
 *     porque toda la autorización continúa dependiendo de `uid` y el perfil Firestore.
 */

import { User as FirebaseUser, signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { IAuthProvider, SystemUser } from './types';
import { fetchUserProfile } from './firebaseAuthProvider';

export class EntraAuthProvider implements IAuthProvider {
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
   * Future implementation when Microsoft Entra tenant is configured.
   */
  async login(_credentials?: any): Promise<SystemUser> {
    throw new Error(
      'Microsoft Entra ID no está configurado en este entorno de desarrollo. ' +
      'Utilice el proveedor de desarrollo Firebase Authentication (Email/Password).'
    );
  }

  /**
   * Completes the Entra token exchange with the backend and signs in to Firebase.
   * This method will be used once MSAL is connected.
   */
  async loginWithMicrosoftToken(msalAccessToken: string): Promise<SystemUser> {
    // 1. Exchange MSAL token for Firebase Custom Token on the backend
    const response = await fetch('/api/auth/entra', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${msalAccessToken}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Error al validar credenciales corporativas en el backend.');
    }

    const { customToken } = await response.json();

    // 2. Authenticate with Firebase using the custom token
    const userCredential = await signInWithCustomToken(auth, customToken);
    const fbUser = userCredential.user;

    // 3. Load user profile from Firestore `users/{uid}`
    const profile = await fetchUserProfile(fbUser.uid);

    if (!profile) {
      throw new Error('Perfil no encontrado en el sistema. Contacte al administrador.');
    }

    if (profile.active === false) {
      await signOut(auth);
      this.currentProfile = null;
      throw new Error('Su cuenta ha sido desactivada por un administrador.');
    }

    this.currentProfile = profile;
    return profile;
  }

  async logout(): Promise<void> {
    this.currentProfile = null;
    await signOut(auth);
  }

  onAuthStateChanged(
    callback: (user: FirebaseUser | null, profile: SystemUser | null) => void
  ): () => void {
    // The underlying Firebase onAuthStateChanged handles session lifecycle identically
    // once signInWithCustomToken is called.
    return auth.onAuthStateChanged(async (fbUser) => {
      if (fbUser) {
        const profile = await fetchUserProfile(fbUser.uid);
        if (profile && profile.active === false) {
          await signOut(auth);
          this.currentProfile = null;
          callback(null, null);
          return;
        }
        this.currentProfile = profile;
        callback(fbUser, profile);
      } else {
        this.currentProfile = null;
        callback(null, null);
      }
    });
  }
}

export const entraAuthProvider = new EntraAuthProvider();
