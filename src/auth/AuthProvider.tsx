/**
 * Unified AuthProvider module
 * Ensures compatibility whether imported from './auth/AuthProvider', './auth/AuthContext', or './auth'.
 */
export * from './AuthContext';
export { AuthProvider as default } from './AuthContext';
