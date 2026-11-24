import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  disableNetwork,
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  deleteDoc,
  collection, 
  query, 
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

let firestoreWriteBlocked = false;
let firestoreReadBlocked = false;
let firestoreQuotaExceeded = false;
let firestoreUnavailable = false;
let networkDisabled = false;

function disableFirestoreNetworkSafely() {
  if (networkDisabled) return;
  networkDisabled = true;
  void disableNetwork(db).catch(() => {
    // Ignore disableNetwork failures during teardown/startup
  });
}

export function isFirestoreWriteBlocked(): boolean {
  return firestoreWriteBlocked;
}

export function isFirestoreReadBlocked(): boolean {
  return firestoreReadBlocked;
}

export function isFirestoreQuotaExceeded(): boolean {
  return firestoreQuotaExceeded;
}

export function isFirestoreUnavailable(): boolean {
  return firestoreUnavailable;
}

export function setFirestoreWriteBlocked(blocked: boolean) {
  firestoreWriteBlocked = blocked;
}

export function setFirestoreReadBlocked(blocked: boolean) {
  firestoreReadBlocked = blocked;
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as any).code) : '';
  const isExceeded = (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Quota exceeded') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('quota metric') ||
    msg.includes('429')
  );
  if (isExceeded) {
    firestoreQuotaExceeded = true;
    firestoreWriteBlocked = true;
    firestoreReadBlocked = true;
    disableFirestoreNetworkSafely();
  }
  return isExceeded;
}

export function isConnectionUnavailableError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as any).code) : '';
  const isUnavailable = (
    code === 'unavailable' ||
    msg.includes('code=unavailable') ||
    msg.includes('the client is offline') ||
    msg.includes('Could not reach Cloud Firestore backend') ||
    msg.includes('The operation could not be completed')
  );
  if (isUnavailable) {
    firestoreUnavailable = true;
    firestoreWriteBlocked = true;
    firestoreReadBlocked = true;
    disableFirestoreNetworkSafely();
  }
  return isUnavailable;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (isQuotaExceededError(error) || isConnectionUnavailableError(error)) {
    console.warn(`[Firestore Offline/Quota] Operation ${operationType} on ${path || 'database'} skipped; operating in local mode.`);
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Verify connection on boot before attaching listeners or running queries
export async function testConnection(): Promise<boolean> {
  if (isFirestoreReadBlocked()) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.warn("Firestore daily quota limit reached on boot test; operating in local mode.");
      return false;
    }
    if (isConnectionUnavailableError(error)) {
      console.warn("Firestore backend unavailable on boot test; operating in local mode.");
      return false;
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration; operating in local mode.");
      return false;
    }
    return false;
  }
}

export const connectionCheckPromise: Promise<boolean> = testConnection();

export async function waitForFirestoreReady(): Promise<boolean> {
  try {
    const ok = await connectionCheckPromise;
    return ok && !isFirestoreReadBlocked();
  } catch {
    return false;
  }
}

export interface SystemUser {
  userId: string;
  uid?: string;
  entraOid?: string;
  username?: string;
  password?: string;
  name: string;
  role: 'admin' | 'jefe_turno' | 'supervision';
  lastLogin?: string;
  enableAi?: boolean;
  email?: string;
  active?: boolean;
}

export const INITIAL_PREDEFINED_USERS: SystemUser[] = [
  { userId: 'ctapia', username: 'ctapia', password: 'ctapia', name: 'Cristian Tapia', role: 'admin', enableAi: true },
  { userId: 'mtoledo', username: 'mtoledo', password: 'mtoledo', name: 'Mauricio Toledo', role: 'jefe_turno', enableAi: true },
  { userId: 'rbarraza', username: 'rbarraza', password: 'rbarraza', name: 'Raul Barraza', role: 'jefe_turno', enableAi: true },
  { userId: 'marevalo', username: 'marevalo', password: 'marevalo', name: 'Marcelo Arevalo', role: 'supervision', enableAi: true },
  { userId: 'rogalde', username: 'rogalde', password: 'rogalde', name: 'Roberto Ogalde', role: 'supervision', enableAi: true },
  { userId: 'wcastillo', username: 'wcastillo', password: 'wcastillo', name: 'Walter Castillo', role: 'supervision', enableAi: true },
  { userId: 'ccampos', username: 'ccampos', password: 'ccampos', name: 'Claudio Campos', role: 'supervision', enableAi: true },
  { userId: 'eoyanader', username: 'eoyanader', password: 'eoyanader', name: 'Erwin Oyanader', role: 'supervision', enableAi: true },
  { userId: 'fogalde', username: 'fogalde', password: 'fogalde', name: 'Felipe Ogalde', role: 'supervision', enableAi: true },
  { userId: 'parce', username: 'parce', password: 'parce', name: 'Patricio Arce', role: 'supervision', enableAi: true },
];

export async function bootstrapPredefinedUsers(): Promise<SystemUser[] | null> {
  const ready = await waitForFirestoreReady();
  if (!ready || isFirestoreReadBlocked()) return null;

  try {
    const q = query(collection(db, 'users'));
    const snap = await getDocs(q);
    
    // Store existing user IDs and parsed users currently in Firestore
    const existingUserIds = new Set<string>();
    const loadedUsers: SystemUser[] = [];
    snap.forEach((docSnap) => {
      existingUserIds.add(docSnap.id);
      const data = docSnap.data() as SystemUser;
      loadedUsers.push({
        ...data,
        userId: data.userId || docSnap.id,
        uid: data.uid || docSnap.id
      });
    });

    if (!isFirestoreWriteBlocked()) {
      // Clean up legacy temporary test users (jefe1, super1, etc.)
      const legacyIds = ['jefe1', 'jefe2', 'super1', 'super2', 'super3'];
      for (const legacyId of legacyIds) {
        if (existingUserIds.has(legacyId)) {
          try {
            await deleteDoc(doc(db, 'users', legacyId));
            existingUserIds.delete(legacyId);
            const idx = loadedUsers.findIndex(u => u.userId === legacyId || u.uid === legacyId);
            if (idx !== -1) loadedUsers.splice(idx, 1);
          } catch {
            // Ignore
          }
        }
      }

      // Bootstrap only predefined users that DO NOT exist in Firestore yet
      let countBootstrapped = 0;
      for (const user of INITIAL_PREDEFINED_USERS) {
        if (!existingUserIds.has(user.userId)) {
          const userDocRef = doc(db, 'users', user.userId);
          const payload = {
            ...user,
            lastLogin: new Date().toISOString()
          };
          await setDoc(userDocRef, payload);
          loadedUsers.push(payload);
          countBootstrapped++;
        }
      }
      
      if (countBootstrapped > 0) {
        console.log(`Successfully bootstrapped ${countBootstrapped} missing official roster accounts.`);
      }
    }

    return loadedUsers;
  } catch (error) {
    if (isQuotaExceededError(error) || isConnectionUnavailableError(error)) {
      console.warn('Firestore unavailable during user bootstrap; using local roster.');
      return null;
    }
    console.error('Error auto-bootstrapping predefined users:', error);
    return null;
  }
}

export async function logActivity(user: SystemUser | null, action: string, details: string) {
  const ready = await waitForFirestoreReady();
  if (!ready || isFirestoreWriteBlocked()) return;
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const pathForWrite = 'activity_logs';
  try {
    const logDocRef = doc(db, pathForWrite, logId);
    const logPayload = {
      userId: user?.userId || 'invitado',
      username: user?.username || 'invitado',
      name: user?.name || 'Invitado sin autenticar',
      role: user?.role || 'invitado',
      action: action.substring(0, 250),
      details: details.substring(0, 1000),
      timestamp: new Date().toISOString()
    };
    await setDoc(logDocRef, logPayload);
  } catch (error) {
    if (isQuotaExceededError(error) || isConnectionUnavailableError(error)) {
      console.warn('Firestore unavailable; skipping activity log entry.');
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, `${pathForWrite}/${logId}`);
  }
}

export interface OperationalReportDoc {
  id: string;
  date: string;
  backupData: string; // JSON string payload
  updatedAt: string;
  updatedBy?: string;
  summary?: string;
}

/**
 * Safely parses an operational report backup JSON string from Firebase Firestore.
 * Handles cases where the string was previously truncated or malformed,
 * recovering all intact key-value pairs without throwing SyntaxError.
 */
export function safeParseBackupJSON(rawStr: string | null | undefined): Record<string, any> {
  if (!rawStr || typeof rawStr !== 'string') return {};
  
  // 1. Direct standard parse
  try {
    const parsed = JSON.parse(rawStr);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // String was cut off or malformed, continue to recovery
  }

  // 2. Backtrack recovery for truncated JSON objects
  try {
    const s = rawStr.trim();
    // Try simple bracket closures first
    const quickSuffixes = ['"}', '"]}', '"}', '}'];
    for (const suffix of quickSuffixes) {
      try {
        const candidate = JSON.parse(s + suffix);
        if (candidate && typeof candidate === 'object') return candidate;
      } catch {
        // continue
      }
    }

    // Backtrack to the last completed key-value pair
    let lastCleanComma = s.lastIndexOf(',"sqm_');
    while (lastCleanComma > 0) {
      const candidate = s.substring(0, lastCleanComma) + '}';
      try {
        const obj = JSON.parse(candidate);
        if (obj && typeof obj === 'object') return obj;
      } catch {
        lastCleanComma = s.lastIndexOf(',"sqm_', lastCleanComma - 1);
      }
    }
  } catch (recoverErr) {
    console.warn('Could not fully recover truncated JSON backup:', recoverErr);
  }

  return {};
}

/**
 * Saves or updates an operational report backup JSON in Firebase Firestore.
 */
export async function saveOperationalReportToFirebase(
  date: string,
  backupDataObj: Record<string, any> | string,
  user?: SystemUser | null,
  summary?: string
): Promise<boolean> {
  const ready = await waitForFirestoreReady();
  if (!ready || isFirestoreWriteBlocked()) {
    console.warn(`Firestore unavailable/quota reached; operational report for ${date} preserved in local storage.`);
    return true;
  }
  const cleanDate = date.trim();
  const reportId = `report_${cleanDate.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;
  const pathForWrite = `operational_reports/${reportId}`;

  try {
    // Parse object if passed as string to ensure clean processing
    let cleanObj: Record<string, any> = typeof backupDataObj === 'string'
      ? safeParseBackupJSON(backupDataObj)
      : { ...backupDataObj };

    // Strip out heavy non-operational keys like base64 gallery images cache
    delete cleanObj.sqm_gallery_images;
    delete cleanObj.sqm_current_user;

    let backupDataString = JSON.stringify(cleanObj);

    // If still exceeds 1,000,000 characters, compress rawData to avoid exceeding Firestore 1MB doc limit
    if (backupDataString.length > 1000000 && cleanObj.sqm_raw_data) {
      try {
        const rows = typeof cleanObj.sqm_raw_data === 'string'
          ? JSON.parse(cleanObj.sqm_raw_data)
          : cleanObj.sqm_raw_data;
        if (Array.isArray(rows) && rows.length > 0) {
          // Keep rows for current date and recent dates
          const currentDayRows = rows.filter((r: any) => r.Fecha === cleanDate);
          const preservedRows = currentDayRows.length > 0 ? currentDayRows : rows.slice(-150);
          cleanObj.sqm_raw_data = JSON.stringify(preservedRows);
          backupDataString = JSON.stringify(cleanObj);
        }
      } catch (err) {
        console.warn('Error compressing rawData for cloud backup:', err);
      }
    }

    const reportDocRef = doc(db, 'operational_reports', reportId);
    const payload = {
      id: reportId,
      date: cleanDate,
      backupData: backupDataString,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.name || user?.username || 'Sistema SQM',
      summary: summary || `Informe Operativo del ${cleanDate}`
    };

    await setDoc(reportDocRef, payload, { merge: true });
    
    // Log activity
    await logActivity(
      user || null,
      'Guardó Informe en Firebase',
      `Guardó exitosamente el historial .json del informe operativo (${cleanDate}) en la nube de Firebase.`
    );

    return true;
  } catch (error) {
    if (isQuotaExceededError(error) || isConnectionUnavailableError(error)) {
      console.warn(`Firestore unavailable/quota reached when saving report for ${date}. Data remains in local storage.`);
      return false;
    }
    console.error(`Error saving operational report for date ${date} to Firebase:`, error);
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
    return false;
  }
}

/**
 * Retrieves all operational report backups stored in Firebase Firestore.
 */
export async function getOperationalReportsFromFirebase(): Promise<OperationalReportDoc[]> {
  const ready = await waitForFirestoreReady();
  if (!ready || isFirestoreReadBlocked()) {
    console.warn('Firestore unavailable/quota reached; using locally saved reports.');
    return [];
  }
  const pathForGet = 'operational_reports';
  try {
    const q = query(collection(db, pathForGet));
    const snap = await getDocs(q);
    const reports: OperationalReportDoc[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.backupData && data.date) {
        reports.push({
          id: docSnap.id,
          date: data.date,
          backupData: data.backupData,
          updatedAt: data.updatedAt || new Date().toISOString(),
          updatedBy: data.updatedBy || 'Sistema SQM',
          summary: data.summary || ''
        });
      }
    });

    // Sort descending by date
    return reports.sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    if (isQuotaExceededError(error) || isConnectionUnavailableError(error)) {
      console.warn('Firestore unavailable/quota reached; returning local cached operational reports.');
      return [];
    }
    console.error('Error fetching operational reports from Firebase:', error);
    handleFirestoreError(error, OperationType.LIST, pathForGet);
    return [];
  }
}

/**
 * Deletes an operational report backup document from Firebase.
 */
export async function deleteOperationalReportFromFirebase(reportId: string, user?: SystemUser | null): Promise<boolean> {
  const ready = await waitForFirestoreReady();
  if (!ready || isFirestoreWriteBlocked()) return false;
  const pathForDelete = `operational_reports/${reportId}`;
  try {
    await deleteDoc(doc(db, 'operational_reports', reportId));
    await logActivity(
      user || null,
      'Eliminó Informe en Firebase',
      `Eliminó el registro de informe de Firebase: ${reportId}.`
    );
    return true;
  } catch (error) {
    if (isQuotaExceededError(error) || isConnectionUnavailableError(error)) {
      return false;
    }
    console.error(`Error deleting operational report ${reportId} from Firebase:`, error);
    handleFirestoreError(error, OperationType.DELETE, pathForDelete);
    return false;
  }
}

/**
 * Helper to build current local backup JSON object from localStorage (all keys starting with sqm_)
 */
export function buildCurrentLocalBackupJSON(): Record<string, string> {
  const backup: Record<string, string> = {};
  const excludedBackupKeys = new Set(['sqm_gallery_images', 'sqm_current_user']);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sqm_')) {
      if (excludedBackupKeys.has(key)) continue;
      backup[key] = localStorage.getItem(key) || '';
    }
  }
  return backup;
}

/**
 * Updates a user's password in Firestore and returns the updated user profile.
 * Synchronizes with Firestore collection 'users' and updates local session cache.
 */
export async function updateUserPassword(
  user: SystemUser,
  newPassword: string
): Promise<SystemUser> {
  const updatedUser: SystemUser = {
    ...user,
    password: newPassword,
  };

  const userId = user.userId || user.username || user.uid;
  if (!userId) {
    throw new Error('Identificador de usuario inválido.');
  }

  try {
    const ready = await waitForFirestoreReady();
    if (ready && !isFirestoreWriteBlocked()) {
      const userDocRef = doc(db, 'users', userId);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const existingData = snap.data();
        await setDoc(
          userDocRef,
          {
            ...existingData,
            password: newPassword,
            lastPasswordUpdate: new Date().toISOString()
          },
          { merge: true }
        );
      } else {
        await setDoc(
          userDocRef,
          {
            ...updatedUser,
            lastPasswordUpdate: new Date().toISOString()
          },
          { merge: true }
        );
      }
    }
  } catch (err) {
    if (!isQuotaExceededError(err) && !isConnectionUnavailableError(err)) {
      console.warn('Error writing updated password to Firestore:', err);
    }
  }

  // Update in localStorage
  try {
    localStorage.setItem('sqm_current_user', JSON.stringify(updatedUser));
  } catch (e) {
    // Ignore storage quota
  }

  // Log activity
  try {
    await logActivity(
      updatedUser,
      'Cambio de Contraseña',
      `El usuario ${updatedUser.name} (@${updatedUser.username || updatedUser.userId}) actualizó su contraseña de acceso personal.`
    );
  } catch (e) {
    // Ignore logging error
  }

  return updatedUser;
}

/**
 * Resets a user's password back to the default initial credential (their username/userId)
 * in Firestore and localStorage. Useful when a user forgot their password or had issues logging in.
 */
export async function resetUserPasswordToDefault(
  userId: string,
  userProfile?: SystemUser
): Promise<{ success: boolean; defaultPassword: string; message: string }> {
  const cleanId = (userId || '').trim();
  if (!cleanId) {
    return { success: false, defaultPassword: '', message: 'Identificador de usuario inválido.' };
  }

  const defaultPassword = cleanId;

  try {
    const ready = await waitForFirestoreReady();
    let existingData: any = null;
    if (ready && !isFirestoreReadBlocked()) {
      const userDocRef = doc(db, 'users', cleanId);
      const snap = await getDoc(userDocRef);
      existingData = snap.exists() ? snap.data() : null;
    }

    const name = existingData?.name || userProfile?.name || cleanId;
    const role = existingData?.role || userProfile?.role || 'supervision';

    const payload = {
      ...(existingData || {}),
      userId: cleanId,
      username: existingData?.username || cleanId,
      name,
      role,
      password: defaultPassword,
      lastPasswordUpdate: new Date().toISOString()
    };

    if (ready && !isFirestoreWriteBlocked()) {
      await setDoc(doc(db, 'users', cleanId), payload, { merge: true });
    }

    // Update localStorage if currently stored
    try {
      const stored = localStorage.getItem('sqm_current_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.userId === cleanId || parsed.uid === cleanId) {
          localStorage.setItem('sqm_current_user', JSON.stringify({ ...parsed, password: defaultPassword }));
        }
      }
    } catch (e) {
      // Ignore
    }

    // Log the reset
    try {
      await logActivity(
        { userId: cleanId, username: cleanId, name, role },
        'Restablecimiento de Contraseña',
        `La contraseña del usuario ${name} (@${cleanId}) fue restablecida a su valor inicial por defecto.`
      );
    } catch (e) {
      // Ignore
    }

    return {
      success: true,
      defaultPassword,
      message: `Contraseña restablecida exitosamente para @${cleanId}. Su clave inicial es: ${defaultPassword}`
    };
  } catch (error: any) {
    console.error('Error resetting password to default:', error);
    return {
      success: false,
      defaultPassword,
      message: `No se pudo sincronizar el restablecimiento con la base de datos: ${error?.message || error}`
    };
  }
}
