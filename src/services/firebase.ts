import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocs, 
  setDoc, 
  collection, 
  query, 
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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
}

export const INITIAL_PREDEFINED_USERS: SystemUser[] = [
  { userId: 'ctapia', username: 'ctapia', password: 'ctapia', name: 'Cristian Tapia', role: 'admin' },
  { userId: 'mtoledo', username: 'mtoledo', password: 'mtoledo', name: 'Mauricio Toledo', role: 'jefe_turno' },
  { userId: 'rbarraza', username: 'rbarraza', password: 'rbarraza', name: 'Raul Barraza', role: 'jefe_turno' },
  { userId: 'marevalo', username: 'marevalo', password: 'marevalo', name: 'Marcelo Arevalo', role: 'supervision' },
  { userId: 'rogalde', username: 'rogalde', password: 'rogalde', name: 'Roberto Ogalde', role: 'supervision' },
  { userId: 'wcastillo', username: 'wcastillo', password: 'wcastillo', name: 'Walter Castillo', role: 'supervision' },
];

export async function bootstrapPredefinedUsers() {
  const pathForGet = 'users';
  try {
    const q = query(collection(db, 'users'));
    const snap = await getDocs(q);
    
    // Check if we need to clean up legacy temporary users (e.g. admin, jefe1, super1) and bootstrap our official roster
    let hasLegacyUsers = false;
    snap.forEach((docSnap) => {
      const uId = docSnap.id;
      if (['admin', 'jefe1', 'jefe2', 'super1', 'super2', 'super3'].includes(uId)) {
        hasLegacyUsers = true;
      }
    });

    if (snap.empty || hasLegacyUsers) {
      console.log('Bootstrapping official SQM team roster into Firestore...');
      
      // Delete legacy database test users to keep the team roster absolutely clean
      const { deleteDoc } = await import('firebase/firestore');
      const legacyIds = ['admin', 'jefe1', 'jefe2', 'super1', 'super2', 'super3'];
      for (const legacyId of legacyIds) {
        try {
          await deleteDoc(doc(db, 'users', legacyId));
        } catch (e) {
          // Ignore if already deleted
        }
      }

      // Load official list
      for (const user of INITIAL_PREDEFINED_USERS) {
        const userDocRef = doc(db, 'users', user.userId);
        await setDoc(userDocRef, {
          ...user,
          lastLogin: new Date().toISOString()
        });
      }
      console.log('Official team bootstrap completed successfully.');
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
