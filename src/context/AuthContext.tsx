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
import { auth, db, signInWithGoogle, signOutUser, handleFirestoreError, OperationType } from '../services/firebase';
import { VpnProfile, UserLicense, AdminUserRecord } from '../types/vpn';
import { DEFAULT_PROFILES, getStoredProfiles, saveStoredProfiles } from '../services/storage';

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
  syncStatus: 'synced' | 'syncing' | 'local' | 'error';
  errorMessage: string | null;
  // Admin Methods
  adminUsers: AdminUserRecord[];
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [license, setLicense] = useState<UserLicense | null>(null);
  const [profiles, setProfiles] = useState<VpnProfile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'local' | 'error'>('local');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Admin state
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [adminLicenses, setAdminLicenses] = useState<AdminLicenseItem[]>([]);

  const isAdmin = Boolean(
    user && user.email && ADMIN_EMAILS.some((adm) => adm.toLowerCase() === user.email?.toLowerCase())
  );

  // REAL-TIME AUTO UPDATE: Listen to Auth & Firestore changes live
  useEffect(() => {
    let unsubUserDoc: Unsubscribe | null = null;
    let unsubProfiles: Unsubscribe | null = null;
    let unsubAdminUsers: Unsubscribe | null = null;
    let unsubAdminLicenses: Unsubscribe | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // Clean up previous listeners
      if (unsubUserDoc) unsubUserDoc();
      if (unsubProfiles) unsubProfiles();
      if (unsubAdminUsers) unsubAdminUsers();
      if (unsubAdminLicenses) unsubAdminLicenses();

      if (currentUser) {
        setLoading(true);
        setSyncStatus('syncing');

        try {
          // 1. Initial User Document Bootstrap (1-Month Free Trial auto-activation)
          await bootstrapUserDoc(currentUser);

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
              handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
            }
          );

          // 3. Real-Time Listener on PPTP Profiles (Instantly updates installed app on changes)
          const profilesPath = `users/${currentUser.uid}/profiles`;
          const profilesColRef = collection(db, profilesPath);

          unsubProfiles = onSnapshot(
            profilesColRef,
            async (snap) => {
              const list: VpnProfile[] = [];
              snap.forEach((d) => {
                const data = d.data();
                list.push({
                  id: d.id,
                  name: data.ispName || data.name || 'Unnamed ISP',
                  server: data.host || data.server || '',
                  port: data.port || 1723,
                  username: data.username || '',
                  password: data.password || '',
                  routingMode: data.routingMode || 'split',
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
                });
              });

              // Seed initial templates if completely empty
              if (list.length === 0 && snap.empty) {
                for (const def of DEFAULT_PROFILES) {
                  const pRef = doc(db, profilesPath, def.id);
                  const firstSubnet = def.remoteSubnets[0] || '192.168.88.0/24';
                  await setDoc(pRef, {
                    id: def.id,
                    userId: currentUser.uid,
                    ispName: def.name,
                    host: def.server,
                    port: def.port,
                    username: def.username,
                    password: def.password,
                    routingMode: def.routingMode || 'split',
                    targetSubnet: firstSubnet,
                    routerIp: '192.168.88.1',
                    sshPort: 22,
                    winboxPort: 8291,
                    remoteSubnets: def.remoteSubnets,
                    mtu: def.mtu,
                    mru: def.mru,
                    encryption: def.encryption,
                    keepaliveInterval: def.keepaliveInterval,
                    autoReconnect: def.autoReconnect,
                    dnsServers: def.dnsServers,
                    tags: def.tags,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                }
              } else {
                setProfiles(list);
                saveStoredProfiles(list);
                if (list.length > 0) {
                  setActiveProfileIdState((prev) => (prev ? prev : list[0].id));
                }
                setSyncStatus('synced');
                setLoading(false);
              }
            },
            (error) => {
              handleFirestoreError(error, OperationType.GET, profilesPath);
            }
          );

          // 4. If Admin, attach real-time live listeners on Users & Licenses
          const isUserAdmin = ADMIN_EMAILS.some(
            (adm) => adm.toLowerCase() === currentUser.email?.toLowerCase()
          );

          if (isUserAdmin) {
            unsubAdminUsers = onSnapshot(
              collection(db, 'users'),
              (uSnap) => {
                const uList: AdminUserRecord[] = [];
                uSnap.forEach((d) => {
                  const dData = d.data();
                  const expiresAt =
                    dData.trialExpiresAt ||
                    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                  const daysRemaining = Math.max(
                    0,
                    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  );

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
                    profilesCount: 1,
                    createdAt: dData.createdAt || dData.trialStartedAt || new Date().toISOString(),
                    updatedAt: dData.updatedAt || new Date().toISOString(),
                  });
                });
                setAdminUsers(uList);
              },
              (err) => {
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
                handleFirestoreError(err, OperationType.GET, 'licenses');
              }
            );
          }
        } catch (err: any) {
          console.error('Error starting live sync:', err);
          setSyncStatus('error');
          setLoading(false);
        }
      } else {
        // Guest mode: Fallback to local storage
        const local = getStoredProfiles();
        setProfiles(local);
        if (local.length > 0) {
          setActiveProfileIdState(local[0].id);
        }
        setLicense(null);
        setSyncStatus('local');
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUserDoc) unsubUserDoc();
      if (unsubProfiles) unsubProfiles();
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
    const trialExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 Days Free Trial

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
      await signInWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Google Sign-in failed:', msg);
      setErrorMessage('Google লগইন ব্যর্থ হয়েছে: ' + msg);
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      const local = getStoredProfiles();
      setProfiles(local);
      if (local.length > 0) setActiveProfileIdState(local[0].id);
      setLicense(null);
      setSyncStatus('local');
    } catch (err: unknown) {
      console.error('Sign-out failed:', err);
    }
  };

  const addProfile = async (newProfileData: Omit<VpnProfile, 'id'>): Promise<VpnProfile> => {
    const cleanId = 'prof_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const newProfile: VpnProfile = {
      ...newProfileData,
      id: cleanId,
    };

    if (user) {
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
        handleFirestoreError(err, OperationType.CREATE, userProfilesPath);
      }
    }

    const updated = [newProfile, ...profiles];
    setProfiles(updated);
    saveStoredProfiles(updated);
    setActiveProfileIdState(cleanId);
    return newProfile;
  };

  const updateProfile = async (updatedProfile: VpnProfile): Promise<void> => {
    if (user) {
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
        handleFirestoreError(err, OperationType.UPDATE, userProfilesPath);
      }
    }

    const next = profiles.map((p) => (p.id === updatedProfile.id ? updatedProfile : p));
    setProfiles(next);
    saveStoredProfiles(next);
  };

  const deleteProfile = async (id: string): Promise<void> => {
    if (user) {
      const userProfilesPath = `users/${user.uid}/profiles`;
      try {
        setSyncStatus('syncing');
        const docRef = doc(db, userProfilesPath, id);
        await deleteDoc(docRef);
        setSyncStatus('synced');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, userProfilesPath);
      }
    }

    const next = profiles.filter((p) => p.id !== id);
    setProfiles(next);
    saveStoredProfiles(next);
    if (activeProfileId === id && next.length > 0) {
      setActiveProfileIdState(next[0].id);
    }
  };

  const setActiveProfileId = (id: string) => {
    setActiveProfileIdState(id);
  };

  // ADMIN OPERATIONS
  const loadAdminData = async () => {
    if (!isAdmin) return;
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const uList: AdminUserRecord[] = [];

      for (const d of usersSnap.docs) {
        const dData = d.data();
        const expiresAt =
          dData.trialExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const daysRemaining = Math.max(
          0,
          Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        );

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
          profilesCount: 1,
          createdAt: dData.createdAt || dData.trialStartedAt || new Date().toISOString(),
          updatedAt: dData.updatedAt || new Date().toISOString(),
        });
      }
      setAdminUsers(uList);
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

    // If an existing registered user matches the email, upgrade them immediately!
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
        syncStatus,
        errorMessage,
        adminUsers,
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
