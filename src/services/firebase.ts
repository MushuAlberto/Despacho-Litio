import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
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
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'anonymous',
      email: null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Verify connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export interface SystemUser {
  userId: string;
  username: string;
  password?: string;
  name: string;
  role: 'admin' | 'jefe_turno' | 'supervision';
  lastLogin?: string;
  enableAi?: boolean;
}

export const INITIAL_PREDEFINED_USERS: SystemUser[] = [
  { userId: 'ctapia', username: 'ctapia', password: 'ctapia', name: 'Cristian Tapia', role: 'admin', enableAi: true },
  { userId: 'mtoledo', username: 'mtoledo', password: 'mtoledo', name: 'Mauricio Toledo', role: 'jefe_turno', enableAi: true },
  { userId: 'rbarraza', username: 'rbarraza', password: 'rbarraza', name: 'Raul Barraza', role: 'jefe_turno', enableAi: true },
  { userId: 'marevalo', username: 'marevalo', password: 'marevalo', name: 'Marcelo Arevalo', role: 'supervision', enableAi: true },
  { userId: 'rogalde', username: 'rogalde', password: 'rogalde', name: 'Roberto Ogalde', role: 'supervision', enableAi: true },
  { userId: 'wcastillo', username: 'wcastillo', password: 'wcastillo', name: 'Walter Castillo', role: 'supervision', enableAi: true },
];

export async function bootstrapPredefinedUsers() {
  const pathForGet = 'users';
  try {
    const q = query(collection(db, 'users'));
    const snap = await getDocs(q);
    
    // Store existing user IDs currently in Firestore
    const existingUserIds = new Set<string>();
    snap.forEach((docSnap) => {
      existingUserIds.add(docSnap.id);
    });

    // We clean up legacy temporary test users (jefe1, super1, etc.) to keep the roster clean
    const { deleteDoc } = await import('firebase/firestore');
    const legacyIds = ['jefe1', 'jefe2', 'super1', 'super2', 'super3'];
    for (const legacyId of legacyIds) {
      if (existingUserIds.has(legacyId)) {
        try {
          await deleteDoc(doc(db, 'users', legacyId));
          existingUserIds.delete(legacyId);
        } catch (e) {
          // Ignore
        }
      }
    }

    // Now, we bootstrap only predefined SQM users that DO NOT exist in the database yet.
    // If a user document already exists in Firestore, we DO NOT write to it at all.
    // This perfectly preserves user-changed passwords and prevents them from ever being overwritten
    // when new software modules, updates, or code versions are introduced.
    let countBootstrapped = 0;
    for (const user of INITIAL_PREDEFINED_USERS) {
      if (!existingUserIds.has(user.userId)) {
        console.log(`Bootstrapping missing official SQM user: ${user.userId}`);
        const userDocRef = doc(db, 'users', user.userId);
        await setDoc(userDocRef, {
          ...user,
          lastLogin: new Date().toISOString()
        });
        countBootstrapped++;
      }
    }
    
    if (countBootstrapped > 0) {
      console.log(`Successfully bootstrapped ${countBootstrapped} missing official roster accounts.`);
    }
  } catch (error) {
    console.error('Error auto-bootstrapping predefined users:', error);
  }
}

export async function logActivity(user: SystemUser | null, action: string, details: string) {
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
    console.error(`Error saving operational report for date ${date} to Firebase:`, error);
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
    return false;
  }
}

/**
 * Retrieves all operational report backups stored in Firebase Firestore.
 */
export async function getOperationalReportsFromFirebase(): Promise<OperationalReportDoc[]> {
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
    console.error('Error fetching operational reports from Firebase:', error);
    handleFirestoreError(error, OperationType.LIST, pathForGet);
    return [];
  }
}

/**
 * Deletes an operational report backup document from Firebase.
 */
export async function deleteOperationalReportFromFirebase(reportId: string, user?: SystemUser | null): Promise<boolean> {
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
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sqm_')) {
      if (key === 'sqm_gallery_images') continue;
      backup[key] = localStorage.getItem(key) || '';
    }
  }
  return backup;
}
