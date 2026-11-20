import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, User } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  enableNetwork,
  setLogLevel,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Suppress noisy internal SDK console.error logs during transient ISP/VPN/offline blips.
// Real Firestore permission and data errors are still strictly captured and logged by handleFirestoreError().
setLogLevel('silent');

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Initialize Firestore with custom firestoreDatabaseId, auto-detected long-polling
// (with a proxy-friendly 20s timeout), and persistent IndexedDB multi-tab cache so
// fluctuating ISP/mobile/VPN connections operate seamlessly offline and sync automatically.
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
      experimentalLongPollingOptions: { timeoutSeconds: 20 },
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  try {
    dbInstance = initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        experimentalLongPollingOptions: { timeoutSeconds: 20 },
        localCache: memoryLocalCache(),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = dbInstance;
export const auth = getAuth(app);

// Automatically re-enable Firestore network transport when browser connectivity recovers
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    enableNetwork(db).catch(() => {
      // Ignore transient network re-enable errors
    });
  });
}

// Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Operation types for strict Firestore error handling
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
  };
}

export function isOfflineFirestoreError(error: unknown): boolean {
  const code = (error as { code?: string })?.code || '';
  const msg = error instanceof Error ? error.message : String(error);
  return (
    code === 'unavailable' ||
    code === 'failed-precondition' ||
    msg.includes('client is offline') ||
    msg.includes('Could not reach Cloud Firestore backend') ||
    msg.includes('code=unavailable') ||
    msg.includes('network-request-failed')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot (gracefully skips when browser reports offline)
export async function testConnection() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore operating in offline cache mode until network connectivity stabilizes.');
    }
  }
}
testConnection();

// Sign in with Google Popup
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    if (
      err?.code === 'auth/popup-closed-by-user' ||
      err?.code === 'auth/cancelled-popup-request' ||
      err?.message?.includes('auth/popup-closed-by-user') ||
      err?.message?.includes('cancelled-popup-request')
    ) {
      // User simply closed the popup before completing sign-in. This is expected user action, not an error.
      console.info('Google Sign-in was dismissed by user.');
      return null;
    }
    throw err;
  }
}

// Sign out
export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}
