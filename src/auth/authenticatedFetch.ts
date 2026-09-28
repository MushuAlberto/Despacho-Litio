import { auth } from '../services/firebase';

/**
 * Returns a fetch wrapper that automatically injects the Firebase ID Token
 * into the `Authorization: Bearer <token>` header for protected backend API requests.
 */
export async function getAuthenticatedFetch() {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const user = auth.currentUser;
    let token: string | null = null;

    if (user) {
      try {
        token = await user.getIdToken();
      } catch (err) {
        console.warn('Could not retrieve Firebase ID token:', err);
      }
    }

    const headers = new Headers(init?.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(input, {
      ...init,
      headers
    });
  };
}

/**
 * Helper to make an authenticated fetch call directly with automatic Bearer token injection.
 */
export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const customFetch = await getAuthenticatedFetch();
  return customFetch(input, init);
}
