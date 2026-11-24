import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import {
  auth,
  db,
  signInWithGoogle,
  signInWithGoogleCredential,
  signOutUser,
  handleFirestoreError,
  isOfflineFirestoreError,
  OperationType,
} from '../services/firebase';
import {
  VpnProfile,
  VpnProtocol,
  UserLicense,
  AdminUserRecord,
  SavedTerminalSession,
  SavedCommandNote,
  TerminalVendor,
  CloudVmNode,
  CloudVmOsType,
  CloudVmStreamProtocol,
} from '../types/vpn';
import {
  DEFAULT_COMMAND_NOTES,
  clearLegacySharedStorage,
} from '../services/storage';
import { disconnectRealVpnTunnel } from '../services/api';

export const ADMIN_EMAILS = [
  'rafikul18285@gmail.com',
  'merafikulus@gmail.com',
  'rafikulislam18285@gmail.com',
];

export interface AdminLicenseItem {
  id: string;
  licenseKey: string;
  assignedEmail: string;
  tier: 'free_trial' | 'pro_engineer' | 'enterprise';
  durationDays: number;
  status: 'active' | 'revoked' | 'expired';
  maxDevices: number;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  license: UserLicense | null;
  profiles: VpnProfile[];
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  addProfile: (profile: Omit<VpnProfile, 'id'>) => Promise<VpnProfile>;
  updateProfile: (profile: VpnProfile) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  terminalSessions: SavedTerminalSession[];
  saveTerminalSession: (
    session: Omit<SavedTerminalSession, 'id'> & { id?: string }
  ) => Promise<SavedTerminalSession>;
  deleteTerminalSession: (id: string) => Promise<void>;
  commandNotes: SavedCommandNote[];
  saveCommandNote: (
    note: Omit<SavedCommandNote, 'id'> & { id?: string }
  ) => Promise<SavedCommandNote>;
  deleteCommandNote: (id: string) => Promise<void>;
  cloudVms: CloudVmNode[];
  saveCloudVm: (
    vm: Omit<CloudVmNode, 'id'> & { id?: string }
  ) => Promise<CloudVmNode>;
  deleteCloudVm: (id: string) => Promise<void>;
  syncStatus: 'synced' | 'syncing' | 'local' | 'error';
  errorMessage: string | null;
  clearError: () => void;
  unauthorizedDomainHost: string | null;
  dismissUnauthorizedDomain: () => void;
  // Admin Methods (Strict Main Admin Only)
  adminUsers: AdminUserRecord[];
  adminUserProfiles: Record<string, VpnProfile[]>;
  adminLicenses: AdminLicenseItem[];
  loadAdminData: () => Promise<void>;
  createLicenseKey: (data: {
    assignedEmail: string;
    tier: 'free_trial' | 'pro_engineer' | 'enterprise';
    durationDays: number;
    maxDevices: number;
  }) => Promise<string>;
  adminExtendUserTrial: (userId: string, additionalDays: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseFirestoreProfileDoc(docId: string, data: Record<string, any>): VpnProfile {
  const rawProto = data.protocol;
  const protocol: VpnProtocol =
    rawProto === 'l2tp' || rawProto === 'sstp' || rawProto === 'pptp' ? rawProto : 'pptp';
  const defaultPort = protocol === 'sstp' ? 443 : protocol === 'l2tp' ? 1701 : 1723;

  return {
    id: docId,
    name: data.ispName || data.name || 'Unnamed PPTP',
    protocol,
    server: data.host || data.server || '',
    port: typeof data.port === 'number' && data.port > 0 ? data.port : defaultPort,
    username: data.username || '',
    password: data.password || '',
    routingMode: data.routingMode === 'full' ? 'full' : 'split',
    remoteSubnets: Array.isArray(data.remoteSubnets)
      ? data.remoteSubnets
      : data.targetSubnet
      ? [data.targetSubnet]
      : ['192.168.88.0/24'],
    mtu: data.mtu || 1400,
    mru: data.mru || 1400,
    encryption: data.encryption || 'mppe-128',
    keepaliveInterval: data.keepaliveInterval || 30,
    autoReconnect: data.autoReconnect ?? true,
    dnsServers: data.dnsServers || ['1.1.1.1', '8.8.8.8'],
    tags: data.tags || ['MikroTik', 'Private'],
    lastConnected: data.lastConnected,
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [license, setLicense] = useState<UserLicense | null>(null);
  // STRICT ISOLATION: Start completely empty — NEVER hydrate shared localStorage!
  const [profiles, setProfiles] = useState<VpnProfile[]>([]);
  const [terminalSessions, setTerminalSessions] = useState<SavedTerminalSession[]>([]);
  const [commandNotes, setCommandNotes] = useState<SavedCommandNote[]>(DEFAULT_COMMAND_NOTES);
  const [cloudVms, setCloudVms] = useState<CloudVmNode[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'local' | 'error'>('local');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unauthorizedDomainHost, setUnauthorizedDomainHost] = useState<string | null>(null);

  // Admin state
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [adminUserProfiles, setAdminUserProfiles] = useState<Record<string, VpnProfile[]>>({});
  const [adminLicenses, setAdminLicenses] = useState<AdminLicenseItem[]>([]);

  const isAdmin = Boolean(
    user && user.email && ADMIN_EMAILS.some((adm) => adm.toLowerCase() === user.email?.toLowerCase())
  );

  // Helper: fetch every registered user's PPTP profiles for the Main Admin Panel
  const fetchAllUsersProfilesForAdmin = async (userIds: string[]) => {
    const map: Record<string, VpnProfile[]> = {};
    await Promise.all(
      userIds.map(async (uid) => {
        try {
          const pSnap = await getDocs(collection(db, `users/${uid}/profiles`));
          const list: VpnProfile[] = [];
          pSnap.forEach((pd) => {
            list.push(parseFirestoreProfileDoc(pd.id, pd.data()));
          });
          map[uid] = list;
        } catch {
          map[uid] = [];
        }
      })
    );
    setAdminUserProfiles(map);
    setAdminUsers((prev) =>
      prev.map((u) => ({
        ...u,
        profilesCount: map[u.userId]?.length ?? 0,
      }))
    );
    return map;
  };

  // Desktop Localhost Auth Bridge: consume Google OAuth credential returned in URL hash from authorized cloud portal
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const rawHash = window.location.hash.replace(/^#/, '');
    if (!rawHash.includes('desktop_auth_id_token=') && !rawHash.includes('desktop_auth_access_token=')) {
      return;
    }
    const params = new URLSearchParams(rawHash);
    const idToken = params.get('desktop_auth_id_token');
    const accessToken = params.get('desktop_auth_access_token');

    // Immediately scrub tokens from URL bar & browser history
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    if (idToken || accessToken) {
      setLoading(true);
      setErrorMessage(null);
      setUnauthorizedDomainHost(null);
      signInWithGoogleCredential(idToken, accessToken).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Desktop auth bridge sign-in failed:', msg);
        setErrorMessage('ডেস্কটপ Google লগইন সম্পন্ন হয়নি: ' + msg);
        setLoading(false);
      });
    }
  }, []);

  // REAL-TIME AUTO UPDATE: Strict per-Google-account isolation on Auth & Firestore changes
  useEffect(() => {
    // Purge any legacy un-scoped localStorage data immediately on boot
    clearLegacySharedStorage();

    let unsubUserDoc: Unsubscribe | null = null;
    let unsubProfiles: Unsubscribe | null = null;
    let unsubTerminalSessions: Unsubscribe | null = null;
    let unsubCommandNotes: Unsubscribe | null = null;
    let unsubCloudVms: Unsubscribe | null = null;
    let unsubAdminUsers: Unsubscribe | null = null;
    let unsubAdminLicenses: Unsubscribe | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      // Clean up previous account's listeners immediately
      if (unsubUserDoc) unsubUserDoc();
      if (unsubProfiles) unsubProfiles();
      if (unsubTerminalSessions) unsubTerminalSessions();
      if (unsubCommandNotes) unsubCommandNotes();
      if (unsubCloudVms) unsubCloudVms();
      if (unsubAdminUsers) unsubAdminUsers();
      if (unsubAdminLicenses) unsubAdminLicenses();

      // Always clear legacy shared storage & wipe previous account's in-memory state first!
      clearLegacySharedStorage();
      setProfiles([]);
      setActiveProfileIdState('');
      setTerminalSessions([]);
      setCommandNotes(DEFAULT_COMMAND_NOTES);
      setLicense(null);
      setAdminUsers([]);
      setAdminUserProfiles({});
      setAdminLicenses([]);

      setUser(currentUser);

      if (currentUser) {
        setLoading(true);
        setSyncStatus('syncing');

        try {
          // 1. Initial User Document Bootstrap
          try {
            await bootstrapUserDoc(currentUser);
          } catch (bootErr) {
            if (isOfflineFirestoreError(bootErr)) {
              setSyncStatus('local');
            } else {
              throw bootErr;
            }
          }

          // 2. Real-Time Listener on User Profile & License
          const userDocRef = doc(db, 'users', currentUser.uid);
          unsubUserDoc = onSnapshot(
            userDocRef,
            (docSnap) => {
              if (docSnap.exists()) {
                const uData = docSnap.data();
                const expiresAt =
                  uData.trialExpiresAt ||
                  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                const daysLeft = Math.max(
                  0,
                  Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                );

                setLicense({
                  tier: uData.licenseTier || 'free_trial',
                  status: daysLeft === 0 ? 'expired' : uData.licenseStatus || 'active',
                  trialStartedAt: uData.trialStartedAt || new Date().toISOString(),
                  trialExpiresAt: expiresAt,
                  daysRemaining: daysLeft,
                  planName:
                    uData.licenseTier === 'enterprise'
                      ? 'Enterprise NOC'
                      : uData.licenseTier === 'pro_engineer'
                      ? 'Pro Engineer'
                      : '1 Month Free Trial',
                  deviceLimit:
                    uData.licenseTier === 'enterprise'
                      ? 15
                      : uData.licenseTier === 'pro_engineer'
                      ? 5
                      : 2,
                });
              }
            },
            (error) => {
              if (isOfflineFirestoreError(error)) {
                setSyncStatus('local');
                return;
              }
              handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
            }
          );

          // 3. Real-Time Listener on THIS Google Account's Isolated PPTP Profiles ONLY
          const profilesPath = `users/${currentUser.uid}/profiles`;
          const profilesColRef = collection(db, profilesPath);

          unsubProfiles = onSnapshot(
            profilesColRef,
            (snap) => {
              const list: VpnProfile[] = [];
              snap.forEach((d) => {
                list.push(parseFirestoreProfileDoc(d.id, d.data()));
              });

              // Always reflect exact Firestore state for THIS Google account (even if empty!)
              setProfiles(list);
              setActiveProfileIdState((prev) =>
                prev && list.some((p) => p.id === prev) ? prev : list[0]?.id || ''
              );
              setSyncStatus(snap.metadata.fromCache ? 'local' : 'synced');
              setLoading(false);
            },
            (error) => {
              if (isOfflineFirestoreError(error)) {
                setSyncStatus('local');
                setLoading(false);
                return;
              }
              handleFirestoreError(error, OperationType.GET, profilesPath);
            }
          );

          // 3.5 Real-Time Listener on THIS Google Account's Isolated Saved Telnet / SSH Sessions
          const terminalPath = `users/${currentUser.uid}/terminalSessions`;
          const terminalColRef = collection(db, terminalPath);
          const allowedVendors: TerminalVendor[] = [
            'MikroTik',
            'Cisco',
            'Huawei',
            'ZTE',
            'BDCOM',
            'VSOL',
            'C-Data',
            'Palo Alto',
            'Juniper',
            'Arista',
            'Ruijie',
            'TP-Link',
          ];

          unsubTerminalSessions = onSnapshot(
            terminalColRef,
            (tSnap) => {
              const tList: SavedTerminalSession[] = [];
              tSnap.forEach((d) => {
                const data = d.data();
                const vendorVal: TerminalVendor = allowedVendors.includes(data.vendor)
                  ? data.vendor
                  : 'MikroTik';
                tList.push({
                  id: d.id,
                  name: typeof data.name === 'string' ? data.name : 'Saved Device',
                  vendor: vendorVal,
                  protocol: data.protocol === 'SSH' ? 'SSH' : 'Telnet',
                  host: typeof data.host === 'string' ? data.host : '',
                  port: typeof data.port === 'number' ? data.port : 23,
                  username: typeof data.username === 'string' ? data.username : '',
                  password: typeof data.password === 'string' ? data.password : '',
                  autoLogin: data.autoLogin !== false,
                  createdAt: data.createdAt,
                  updatedAt: data.updatedAt,
                });
              });
              tList.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
              setTerminalSessions(tList);
            },
            (error) => {
              if (isOfflineFirestoreError(error)) {
                setSyncStatus('local');
                return;
              }
              handleFirestoreError(error, OperationType.GET, terminalPath);
            }
          );

          // 3.6 Real-Time Listener on THIS Google Account's Saved CLI Command Notepad
          const notesPath = `users/${currentUser.uid}/commandNotes`;
          const notesColRef = collection(db, notesPath);
          const allowedNoteVendors: (TerminalVendor | 'All')[] = ['All', ...allowedVendors];

          unsubCommandNotes = onSnapshot(
            notesColRef,
            (nSnap) => {
              const nList: SavedCommandNote[] = [];
              nSnap.forEach((d) => {
                const data = d.data();
                const vVal: TerminalVendor | 'All' = allowedNoteVendors.includes(data.vendor)
                  ? data.vendor
                  : 'All';
                nList.push({
                  id: d.id,
                  title: typeof data.title === 'string' ? data.title : 'Saved Command',
                  vendor: vVal,
                  category: typeof data.category === 'string' ? data.category : 'General',
                  commands: typeof data.commands === 'string' ? data.commands : '',
                  description: typeof data.description === 'string' ? data.description : '',
                  pinned: Boolean(data.pinned),
                  createdAt: data.createdAt,
                  updatedAt: data.updatedAt,
                });
              });
              nList.sort((a, b) => {
                if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
                return (b.updatedAt || '').localeCompare(a.updatedAt || '');
              });
              setCommandNotes(nList.length > 0 ? nList : DEFAULT_COMMAND_NOTES);
            },
            (error) => {
              if (!isOfflineFirestoreError(error)) {
                handleFirestoreError(error, OperationType.GET, notesPath);
              }
            }
          );

          // 3.7 Real-Time Listener on THIS Google Account's Isolated Cloud VM Nodes
          const cloudVmPath = `users/${currentUser.uid}/cloudVms`;
          const cloudVmColRef = collection(db, cloudVmPath);
          const allowedOsTypes: CloudVmOsType[] = [
            'ubuntu-chrome-novnc',
            'android-redroid',
            'kasm-webrtc',
            'windows-novnc',
            'custom',
          ];
          const allowedProtocols: CloudVmStreamProtocol[] = ['novnc', 'webrtc', 'ws-scrcpy'];

          unsubCloudVms = onSnapshot(
            cloudVmColRef,
            (vmSnap) => {
              const vmList: CloudVmNode[] = [];
              vmSnap.forEach((d) => {
                const data = d.data();
                const osTypeVal: CloudVmOsType = allowedOsTypes.includes(data.osType)
                  ? data.osType
                  : 'ubuntu-chrome-novnc';
                const protoVal: CloudVmStreamProtocol = allowedProtocols.includes(data.streamProtocol)
                  ? data.streamProtocol
                  : 'novnc';
                vmList.push({
                  id: d.id,
                  name: typeof data.name === 'string' ? data.name : 'Cloud VM',
                  osType: osTypeVal,
                  streamProtocol: protoVal,
                  streamUrl: typeof data.streamUrl === 'string' ? data.streamUrl : '',
                  hostIp: typeof data.hostIp === 'string' ? data.hostIp : '',
                  port: typeof data.port === 'number' ? data.port : 6080,
                  pptpProfileId: typeof data.pptpProfileId === 'string' ? data.pptpProfileId : '',
                  resolution: typeof data.resolution === 'string' ? data.resolution : '1280x720',
                  notes: typeof data.notes === 'string' ? data.notes : '',
                  createdAt: data.createdAt,
                  updatedAt: data.updatedAt,
                });
              });
              vmList.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
              setCloudVms(vmList);
            },
            (error) => {
              if (!isOfflineFirestoreError(error)) {
                handleFirestoreError(error, OperationType.GET, cloudVmPath);
              }
            }
          );

          // 4. If Main Admin, attach live listeners on ALL Users, their PPTP Profiles & Licenses
          const isUserAdmin = ADMIN_EMAILS.some(
            (adm) => adm.toLowerCase() === currentUser.email?.toLowerCase()
          );

          if (isUserAdmin) {
            unsubAdminUsers = onSnapshot(
              collection(db, 'users'),
              (uSnap) => {
                const uList: AdminUserRecord[] = [];
                const uids: string[] = [];
                uSnap.forEach((d) => {
                  const dData = d.data();
                  const expiresAt =
                    dData.trialExpiresAt ||
                    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                  const daysRemaining = Math.max(
                    0,
                    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  );
                  uids.push(d.id);
                  uList.push({
                    userId: d.id,
                    email: dData.email || 'No Email',
                    displayName: dData.displayName || 'Network Engineer',
                    photoURL: dData.photoURL,
                    role: dData.role || 'engineer',
                    licenseTier: dData.licenseTier || 'free_trial',
                    licenseStatus: dData.licenseStatus || 'active',
                    trialStartedAt: dData.trialStartedAt || new Date().toISOString(),
                    trialExpiresAt: expiresAt,
                    daysRemaining,
                    profilesCount: 0,
                    createdAt: dData.createdAt || dData.trialStartedAt || new Date().toISOString(),
                    updatedAt: dData.updatedAt || new Date().toISOString(),
                  });
                });
                setAdminUsers(uList);
                void fetchAllUsersProfilesForAdmin(uids);
              },
              (err) => {
                if (isOfflineFirestoreError(err)) {
                  setSyncStatus('local');
                  return;
                }
                handleFirestoreError(err, OperationType.GET, 'users');
              }
            );

            unsubAdminLicenses = onSnapshot(
              collection(db, 'licenses'),
              (licSnap) => {
                const lList: AdminLicenseItem[] = [];
                licSnap.forEach((ld) => {
                  const ldData = ld.data();
                  lList.push({
                    id: ld.id,
                    licenseKey: ldData.licenseKey || ld.id,
                    assignedEmail: ldData.assignedEmail || 'Public / Unassigned',
                    tier: ldData.tier || 'free_trial',
                    durationDays: ldData.durationDays || 30,
                    status: ldData.status || 'active',
                    maxDevices: ldData.maxDevices || 2,
                    createdBy: ldData.createdBy || 'Admin',
                    createdAt: ldData.createdAt || new Date().toISOString(),
                    expiresAt: ldData.expiresAt || new Date().toISOString(),
                  });
                });
                setAdminLicenses(lList);
              },
              (err) => {
                if (isOfflineFirestoreError(err)) {
                  setSyncStatus('local');
                  return;
                }
                handleFirestoreError(err, OperationType.GET, 'licenses');
              }
            );
          }
        } catch (err: any) {
          if (isOfflineFirestoreError(err)) {
            console.warn('Firestore temporarily unreachable; retrying when reconnected.');
            setSyncStatus('local');
          } else {
            console.error('Error starting live sync:', err);
            setSyncStatus('error');
          }
          setLoading(false);
        }
      } else {
        // Logged out (Guest): STRICTLY ZERO saved PPTP profiles or saved Telnet/SSH credentials visible!
        setProfiles([]);
        setActiveProfileIdState('');
        setTerminalSessions([]);
        setCommandNotes(DEFAULT_COMMAND_NOTES);
        setCloudVms([]);
        setLicense(null);
        setAdminUsers([]);
        setAdminUserProfiles({});
        setAdminLicenses([]);
        setSyncStatus('local');
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUserDoc) unsubUserDoc();
      if (unsubProfiles) unsubProfiles();
      if (unsubTerminalSessions) unsubTerminalSessions();
      if (unsubCommandNotes) unsubCommandNotes();
      if (unsubCloudVms) unsubCloudVms();
      if (unsubAdminUsers) unsubAdminUsers();
      if (unsubAdminLicenses) unsubAdminLicenses();
    };
  }, []);

  // Bootstrap user document with 1-month trial
  const bootstrapUserDoc = async (currentUser: User) => {
    const userRef = doc(db, 'users', currentUser.uid);
    const userSnap = await getDoc(userRef);

    const now = new Date();
    const trialStartedAt = now.toISOString();
    const trialExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        userId: currentUser.uid,
        email: currentUser.email || '',
        displayName: currentUser.displayName || 'Network Engineer',
        photoURL: currentUser.photoURL || '',
        role: ADMIN_EMAILS.some((a) => a.toLowerCase() === currentUser.email?.toLowerCase())
          ? 'admin'
          : 'engineer',
        licenseTier: 'free_trial',
        trialStartedAt,
        trialExpiresAt,
        licenseStatus: 'active',
        devicesUsed: 1,
        createdAt: trialStartedAt,
        updatedAt: trialStartedAt,
      });
    }
  };

  const loginWithGoogle = async () => {
    try {
      setErrorMessage(null);
      const res = await signInWithGoogle();
      if (!res) return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('auth/popup-closed-by-user') ||
        msg.includes('auth/cancelled-popup-request') ||
        msg.includes('cancelled')
      ) {
        return;
      }
      console.error('Google Sign-in failed:', msg);
      if (msg.includes('auth/unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        setUnauthorizedDomainHost(host);
        if (host !== 'localhost' && host !== '127.0.0.1') {
          setErrorMessage(
            `Google Login-এর জন্য "${host}" ডোমেইনটি Firebase Console → Authentication → Settings → Authorized domains-এ যোগ করতে হবে।`
          );
        }
      } else {
        setErrorMessage('Google লগইন ব্যর্থ হয়েছে: ' + msg);
      }
    }
  };

  const clearError = () => setErrorMessage(null);
  const dismissUnauthorizedDomain = () => setUnauthorizedDomainHost(null);

  const logout = async () => {
    try {
      // Disconnect any active VPN tunnel so logged-out state never keeps another account's tunnel active
      await disconnectRealVpnTunnel().catch(() => {});
      await signOutUser();
      clearLegacySharedStorage();
      setProfiles([]);
      setActiveProfileIdState('');
      setTerminalSessions([]);
      setCommandNotes(DEFAULT_COMMAND_NOTES);
      setLicense(null);
      setAdminUsers([]);
      setAdminUserProfiles({});
      setAdminLicenses([]);
      setSyncStatus('local');
    } catch (err: unknown) {
      console.error('Sign-out failed:', err);
    }
  };

  const addProfile = async (newProfileData: Omit<VpnProfile, 'id'>): Promise<VpnProfile> => {
    if (!user) {
      const msg = 'নতুন PPTP প্রোফাইল সেভ করতে আগে Google অ্যাকাউন্ট দিয়ে লগইন করুন। প্রতিটি প্রোফাইল শুধুমাত্র আপনার Google অ্যাকাউন্টেই সুরক্ষিত থাকবে।';
      setErrorMessage(msg);
      throw new Error(msg);
    }

    const cleanId = 'prof_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const protocol: VpnProtocol = newProfileData.protocol || 'pptp';
    const newProfile: VpnProfile = {
      ...newProfileData,
      protocol,
      id: cleanId,
    };

    const userProfilesPath = `users/${user.uid}/profiles`;
    try {
      setSyncStatus('syncing');
      const docRef = doc(db, userProfilesPath, cleanId);
      const firstSubnet =
        newProfile.remoteSubnets[0] ||
        (newProfile.routingMode === 'full' ? '0.0.0.0/0' : '192.168.88.0/24');

      await setDoc(docRef, {
        id: cleanId,
        userId: user.uid,
        ispName: newProfile.name,
        protocol,
        host: newProfile.server,
        port: newProfile.port,
        username: newProfile.username,
        password: newProfile.password,
        routingMode: newProfile.routingMode || 'split',
        targetSubnet: firstSubnet,
        routerIp: firstSubnet.includes('/') ? firstSubnet.replace(/\.0\/\d+$/, '.1') : '10.99.0.1',
        sshPort: 22,
        winboxPort: 8291,
        remoteSubnets: newProfile.remoteSubnets,
        mtu: newProfile.mtu,
        mru: newProfile.mru,
        encryption: newProfile.encryption,
        keepaliveInterval: newProfile.keepaliveInterval,
        autoReconnect: newProfile.autoReconnect,
        dnsServers: newProfile.dnsServers,
        tags: newProfile.tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setSyncStatus('synced');
    } catch (err) {
      if (isOfflineFirestoreError(err)) {
        setSyncStatus('local');
      } else {
        handleFirestoreError(err, OperationType.CREATE, userProfilesPath);
      }
    }

    setProfiles((prev) => [newProfile, ...prev.filter((p) => p.id !== cleanId)]);
    setActiveProfileIdState(cleanId);
    return newProfile;
  };

  const updateProfile = async (updatedProfile: VpnProfile): Promise<void> => {
    if (!user) {
      const msg = 'PPTP প্রোফাইল আপডেট করতে Google অ্যাকাউন্ট দিয়ে লগইন করুন।';
      setErrorMessage(msg);
      return;
    }

    const protocol: VpnProtocol = updatedProfile.protocol || 'pptp';
    const userProfilesPath = `users/${user.uid}/profiles`;
    try {
      setSyncStatus('syncing');
      const docRef = doc(db, userProfilesPath, updatedProfile.id);
      const firstSubnet =
        updatedProfile.remoteSubnets[0] ||
        (updatedProfile.routingMode === 'full' ? '0.0.0.0/0' : '192.168.88.0/24');

      await setDoc(
        docRef,
        {
          id: updatedProfile.id,
          userId: user.uid,
          ispName: updatedProfile.name,
          protocol,
          host: updatedProfile.server,
          port: updatedProfile.port,
          username: updatedProfile.username,
          password: updatedProfile.password,
          routingMode: updatedProfile.routingMode || 'split',
          targetSubnet: firstSubnet,
          routerIp: firstSubnet.includes('/')
            ? firstSubnet.replace(/\.0\/\d+$/, '.1')
            : '10.99.0.1',
          sshPort: 22,
          winboxPort: 8291,
          remoteSubnets: updatedProfile.remoteSubnets,
          mtu: updatedProfile.mtu,
          mru: updatedProfile.mru,
          encryption: updatedProfile.encryption,
          keepaliveInterval: updatedProfile.keepaliveInterval,
          autoReconnect: updatedProfile.autoReconnect,
          dnsServers: updatedProfile.dnsServers,
          tags: updatedProfile.tags,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setSyncStatus('synced');
    } catch (err) {
      if (isOfflineFirestoreError(err)) {
        setSyncStatus('local');
      } else {
        handleFirestoreError(err, OperationType.UPDATE, userProfilesPath);
      }
    }

    setProfiles((prev) => prev.map((p) => (p.id === updatedProfile.id ? { ...updatedProfile, protocol } : p)));
  };

  const deleteProfile = async (id: string): Promise<void> => {
    if (!user) {
      setErrorMessage('প্রোফাইল মুছতে Google অ্যাকাউন্ট দিয়ে লগইন করুন।');
      return;
    }

    const userProfilesPath = `users/${user.uid}/profiles`;
    try {
      setSyncStatus('syncing');
      const docRef = doc(db, userProfilesPath, id);
      await deleteDoc(docRef);
      setSyncStatus('synced');
    } catch (err) {
      if (isOfflineFirestoreError(err)) {
        setSyncStatus('local');
      } else {
        handleFirestoreError(err, OperationType.DELETE, userProfilesPath);
      }
    }

    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (activeProfileId === id) {
        setActiveProfileIdState(next[0]?.id || '');
      }
      return next;
    });
  };

  const saveTerminalSession = async (
    sessionInput: Omit<SavedTerminalSession, 'id'> & { id?: string }
  ): Promise<SavedTerminalSession> => {
    if (!user) {
      const msg = 'Telnet/SSH হোস্ট সেভ করতে আগে Google অ্যাকাউন্ট দিয়ে লগইন করুন।';
      setErrorMessage(msg);
      throw new Error(msg);
    }

    const rawId = sessionInput.id?.replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanId =
      rawId && rawId.length > 0
        ? rawId.slice(0, 128)
        : 'term_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

    const nowIso = new Date().toISOString();
    const existing = terminalSessions.find((s) => s.id === cleanId);
    const clampedPort = Math.max(1, Math.min(65535, Math.floor(Number(sessionInput.port) || 23)));

    const saved: SavedTerminalSession = {
      id: cleanId,
      name: (sessionInput.name.trim() || `${sessionInput.vendor} ${sessionInput.host}`).slice(0, 100),
      vendor: sessionInput.vendor,
      protocol: sessionInput.protocol === 'SSH' ? 'SSH' : 'Telnet',
      host: sessionInput.host.trim().slice(0, 255),
      port: clampedPort,
      username: (sessionInput.username || '').trim().slice(0, 100),
      password: (sessionInput.password || '').slice(0, 128),
      autoLogin: sessionInput.autoLogin !== false,
      createdAt: existing?.createdAt || sessionInput.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const terminalPath = `users/${user.uid}/terminalSessions`;
    try {
      setSyncStatus('syncing');
      const docRef = doc(db, terminalPath, cleanId);
      await setDoc(docRef, {
        id: saved.id,
        userId: user.uid,
        name: saved.name,
        vendor: saved.vendor,
        protocol: saved.protocol,
        host: saved.host,
        port: saved.port,
        username: saved.username,
        password: saved.password,
        autoLogin: saved.autoLogin,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      });
      setSyncStatus('synced');
    } catch (err) {
      if (isOfflineFirestoreError(err)) {
        setSyncStatus('local');
      } else {
        handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, terminalPath);
      }
    }

    setTerminalSessions((prev) =>
      existing ? prev.map((s) => (s.id === cleanId ? saved : s)) : [saved, ...prev]
    );
    return saved;
  };

  const deleteTerminalSession = async (id: string): Promise<void> => {
    if (!user) return;
    const terminalPath = `users/${user.uid}/terminalSessions`;
    try {
      setSyncStatus('syncing');
      await deleteDoc(doc(db, terminalPath, id));
      setSyncStatus('synced');
    } catch (err) {
      if (isOfflineFirestoreError(err)) {
        setSyncStatus('local');
      } else {
        handleFirestoreError(err, OperationType.DELETE, terminalPath);
      }
    }
    setTerminalSessions((prev) => prev.filter((s) => s.id !== id));
  };

  // COMMAND NOTEPAD CRUD (Account-Isolated Cloud Synced)
  const saveCommandNote = async (
    noteInput: Omit<SavedCommandNote, 'id'> & { id?: string }
  ): Promise<SavedCommandNote> => {
    if (!user) {
      const msg = 'কমান্ড নোটপ্যাড সেভ করতে আগে Google অ্যাকাউন্ট দিয়ে লগইন করুন।';
      setErrorMessage(msg);
      throw new Error(msg);
    }

    const nowIso = new Date().toISOString();
    const rawId =
      noteInput.id && /^[a-zA-Z0-9_-]+$/.test(noteInput.id)
        ? noteInput.id
        : `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cleanId = rawId.slice(0, 128);
    const existing = commandNotes.find((n) => n.id === cleanId);

    const saved: SavedCommandNote = {
      id: cleanId,
      title: (noteInput.title || 'Saved Command').trim().slice(0, 120) || 'Saved Command',
      vendor: noteInput.vendor || 'All',
      category: (noteInput.category || 'General').trim().slice(0, 60) || 'General',
      commands: (noteInput.commands || '').trim().slice(0, 8000),
      description: (noteInput.description || '').trim().slice(0, 300),
      pinned: Boolean(noteInput.pinned),
      createdAt: existing?.createdAt || noteInput.createdAt || nowIso,
      updatedAt: nowIso,
    };

    if (saved.commands.length > 0) {
      const notesPath = `users/${user.uid}/commandNotes`;
      try {
        setSyncStatus('syncing');
        const docRef = doc(db, notesPath, cleanId);
        await setDoc(docRef, {
          id: saved.id,
          userId: user.uid,
          title: saved.title,
          vendor: saved.vendor,
          category: saved.category,
          commands: saved.commands,
          description: saved.description,
          pinned: saved.pinned,
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
        });
        setSyncStatus('synced');
      } catch (err) {
        if (isOfflineFirestoreError(err)) {
          setSyncStatus('local');
        } else {
          handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, notesPath);
        }
      }
    }

    setCommandNotes((prev) =>
      (existing ? prev.map((n) => (n.id === cleanId ? saved : n)) : [saved, ...prev]).sort(
        (a, b) => {
          if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
          return (b.updatedAt || '').localeCompare(a.updatedAt || '');
        }
      )
    );
    return saved;
  };

  const deleteCommandNote = async (id: string): Promise<void> => {
    if (!user) return;
    const notesPath = `users/${user.uid}/commandNotes`;
    try {
      setSyncStatus('syncing');
      await deleteDoc(doc(db, notesPath, id));
      setSyncStatus('synced');
    } catch (err) {
      if (isOfflineFirestoreError(err)) {
        setSyncStatus('local');
      } else {
        handleFirestoreError(err, OperationType.DELETE, notesPath);
      }
    }
    setCommandNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const saveCloudVm = async (
    vmInput: Omit<CloudVmNode, 'id'> & { id?: string }
  ): Promise<CloudVmNode> => {
    if (!user) {
      throw new Error('Google লগইন ছাড়া Cloud VM সেভ করা যাবে না।');
    }

    const rawUrl = (vmInput.streamUrl || '').trim();
    if (!/^https?:\/\/.+/.test(rawUrl)) {
      throw new Error('সঠিক https:// বা http:// noVNC / WebRTC URL দিন।');
    }

    const rawId =
      vmInput.id && /^[a-zA-Z0-9_-]+$/.test(vmInput.id)
        ? vmInput.id
        : `vm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const cleanId = rawId.slice(0, 128);
    const nowIso = new Date().toISOString();
    const existing = cloudVms.find((v) => v.id === cleanId);

    const parsedPort = Math.max(1, Math.min(65535, Number(vmInput.port) || 6080));
    const saved: CloudVmNode = {
      id: cleanId,
      name: (vmInput.name || 'Cloud VirtualBox VM').trim().slice(0, 100) || 'Cloud VirtualBox VM',
      osType: vmInput.osType || 'ubuntu-chrome-novnc',
      streamProtocol: vmInput.streamProtocol || 'novnc',
      streamUrl: rawUrl.slice(0, 512),
      hostIp: (vmInput.hostIp || '').trim().slice(0, 255),
      port: parsedPort,
      pptpProfileId: (vmInput.pptpProfileId || '').trim().slice(0, 128),
      resolution: (vmInput.resolution || '1280x720').trim().slice(0, 32),
      notes: (vmInput.notes || '').trim().slice(0, 300),
      createdAt: existing?.createdAt || vmInput.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const vmPath = `users/${user.uid}/cloudVms`;
    try {
      setSyncStatus('syncing');
      const docRef = doc(db, vmPath, cleanId);
      await setDoc(docRef, {
        id: saved.id,
        userId: user.uid,
        name: saved.name,
        osType: saved.osType,
        streamProtocol: saved.streamProtocol,
        streamUrl: saved.streamUrl,
        hostIp: saved.hostIp,
        port: saved.port,
        pptpProfileId: saved.pptpProfileId || '',
        resolution: saved.resolution || '1280x720',
        notes: saved.notes || '',
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      });
      setSyncStatus('synced');
    } catch (err) {
      if (isOfflineFirestoreError(err)) {
        setSyncStatus('local');
      } else {
        handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, vmPath);
      }
    }

    setCloudVms((prev) =>
      (existing ? prev.map((v) => (v.id === cleanId ? saved : v)) : [saved, ...prev]).sort(
        (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')
      )
    );
    return saved;
  };

  const deleteCloudVm = async (id: string): Promise<void> => {
    if (!user) return;
    const vmPath = `users/${user.uid}/cloudVms`;
    try {
      setSyncStatus('syncing');
      await deleteDoc(doc(db, vmPath, id));
      setSyncStatus('synced');
    } catch (err) {
      if (isOfflineFirestoreError(err)) {
        setSyncStatus('local');
      } else {
        handleFirestoreError(err, OperationType.DELETE, vmPath);
      }
    }
    setCloudVms((prev) => prev.filter((v) => v.id !== id));
  };

  const setActiveProfileId = (id: string) => {
    setActiveProfileIdState(id);
  };

  // ADMIN OPERATIONS (Main Admin Only — fetches users + all their saved PPTP profiles)
  const loadAdminData = async () => {
    if (!isAdmin) return;
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const uList: AdminUserRecord[] = [];
      const uids: string[] = [];

      for (const d of usersSnap.docs) {
        const dData = d.data();
        const expiresAt =
          dData.trialExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const daysRemaining = Math.max(
          0,
          Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        );
        uids.push(d.id);
        uList.push({
          userId: d.id,
          email: dData.email || 'No Email',
          displayName: dData.displayName || 'Network Engineer',
          photoURL: dData.photoURL,
          role: dData.role || 'engineer',
          licenseTier: dData.licenseTier || 'free_trial',
          licenseStatus: dData.licenseStatus || 'active',
          trialStartedAt: dData.trialStartedAt || new Date().toISOString(),
          trialExpiresAt: expiresAt,
          daysRemaining,
          profilesCount: 0,
          createdAt: dData.createdAt || dData.trialStartedAt || new Date().toISOString(),
          updatedAt: dData.updatedAt || new Date().toISOString(),
        });
      }
      setAdminUsers(uList);
      await fetchAllUsersProfilesForAdmin(uids);
    } catch (err) {
      console.error('Error loading admin records:', err);
    }
  };

  // ADMIN: Generate / create new license
  const createLicenseKey = async (data: {
    assignedEmail: string;
    tier: 'free_trial' | 'pro_engineer' | 'enterprise';
    durationDays: number;
    maxDevices: number;
  }): Promise<string> => {
    if (!isAdmin || !user) throw new Error('Unauthorized');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const cleanId = `LIC_${Date.now()}_${randomSuffix}`;
    const formattedKey = `PPTP-${data.tier.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-4)}-${randomSuffix}`;
    const expires = new Date(Date.now() + data.durationDays * 24 * 60 * 60 * 1000).toISOString();

    const licenseDoc = doc(db, 'licenses', cleanId);
    await setDoc(licenseDoc, {
      id: cleanId,
      licenseKey: formattedKey,
      assignedEmail: data.assignedEmail.trim().toLowerCase(),
      tier: data.tier,
      durationDays: data.durationDays,
      status: 'active',
      maxDevices: data.maxDevices,
      createdBy: user.email || 'Admin',
      createdAt: new Date().toISOString(),
      expiresAt: expires,
    });

    const matchedUser = adminUsers.find(
      (u) => u.email.toLowerCase() === data.assignedEmail.trim().toLowerCase()
    );
    if (matchedUser) {
      await setDoc(
        doc(db, 'users', matchedUser.userId),
        {
          licenseTier: data.tier,
          licenseStatus: 'active',
          trialExpiresAt: expires,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    return formattedKey;
  };

  // ADMIN: Extend user trial / license
  const adminExtendUserTrial = async (targetUserId: string, additionalDays: number) => {
    if (!isAdmin) throw new Error('Unauthorized');
    const targetUser = adminUsers.find((u) => u.userId === targetUserId);
    const currentExpiry = targetUser ? new Date(targetUser.trialExpiresAt).getTime() : Date.now();
    const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
    const newExpiresAt = new Date(baseTime + additionalDays * 24 * 60 * 60 * 1000).toISOString();

    await setDoc(
      doc(db, 'users', targetUserId),
      {
        trialExpiresAt: newExpiresAt,
        licenseStatus: 'active',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        license,
        profiles,
        activeProfileId,
        setActiveProfileId,
        loginWithGoogle,
        logout,
        addProfile,
        updateProfile,
        deleteProfile,
        terminalSessions,
        saveTerminalSession,
        deleteTerminalSession,
        commandNotes,
        saveCommandNote,
        deleteCommandNote,
        cloudVms,
        saveCloudVm,
        deleteCloudVm,
        syncStatus,
        errorMessage,
        clearError,
        unauthorizedDomainHost,
        dismissUnauthorizedDomain,
        adminUsers,
        adminUserProfiles,
        adminLicenses,
        loadAdminData,
        createLicenseKey,
        adminExtendUserTrial,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
