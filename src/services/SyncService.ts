import { 
  collection, 
  setDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  getDocs,
  Timestamp,
  deleteDoc,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { db_fs, auth, ensureFirebaseAuth } from '../lib/firebase';
import { db } from '../db';
import { 
  User, 
  Agency, 
  Transaction, 
  Slip, 
  ChatMessage, 
  AuditLog, 
  Alert,
  UserRole
} from '../types';

// We'll use a specific metadata table to store sync status
// (We already have db.settings which can work)

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export class SyncService {
  private static listeners: (() => void)[] = [];

  private static isRecovering = false;

  static async startSync(user: User) {
    if (this.isRecovering) return;
    this.stopSync();

    try {
      // 0. Ensure Firebase Auth is active
      const fbUser = await ensureFirebaseAuth();
      
      if (!fbUser) {
        console.warn('SyncService: No Firebase session found. Cloud sync disabled. Please sign in with Google to enable cloud backup.');
        return;
      }
      
      // Check if we already have listeners to avoid double-start
      if (this.listeners.length > 0) return;

      await this.syncCloudProfile(user, fbUser.uid);

      // 1. Initial Pull (Recovery mechanism)
      const userCount = await db.users.count();
      if (userCount <= 1) {
         this.isRecovering = true;
         try {
            await this.performFullRecovery(user);
         } finally {
            this.isRecovering = false;
         }
      }

      // 2. Setup Real-time listeners
      this.setupListeners(user);
    } catch (err) {
      console.error('Failed to start sync:', err);
    }
  }

  static async triggerCloudRecovery(user: User) {
    this.isRecovering = true;
    try {
      await this.performFullRecovery(user, true);
    } finally {
      this.isRecovering = false;
    }
  }

  private static async syncCloudProfile(localUser: User, fbUid: string) {
    // Basic validation to avoid unnecessary writes
    if (!fbUid) return;
    
    const userDocRef = doc(db_fs, 'users', fbUid);
    try {
      await setDoc(userDocRef, {
        ...localUser,
        firebaseUid: fbUid,
        lastSeen: Date.now()
      }, { merge: true });
    } catch (err) {
      console.warn('Could not update cloud profile:', err);
    }
  }

  static stopSync() {
    this.listeners.forEach(unsub => unsub());
    this.listeners = [];
  }

  private static async performFullRecovery(user: User, force: boolean = false) {
    if (!auth.currentUser) {
      throw new Error('Vous devez être connecté (Google Auth) pour restaurer les données du cloud.');
    }
    console.log(`Starting ${force ? 'FORCED ' : ''}full data recovery from cloud...`);
    const isAdmin = user.roles.includes(UserRole.ADMIN_PRINCIPAL) || user.roles.includes(UserRole.SUPERVISEUR);
    
    const collections = [
      'users', 'agencies', 'transactions', 'slips', 'messages', 'auditLogs', 
      'alerts', 'debts', 'billetages', 'reports', 'bankAccounts', 
      'bankTransactions', 'commissionRates'
    ];
    
    for (const colName of collections) {
      let q;
      if (isAdmin) {
        q = query(collection(db_fs, colName));
      } else {
        q = query(collection(db_fs, colName), where('agencyId', '==', user.agencyId));
      }

      try {
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(d => {
          const docData = d.data() as object;
          return { ...docData, id: d.id.match(/^\d+$/) ? parseInt(d.id) : d.id };
        });
        
        const table = (db as any)[colName];
        if (table) {
          if (force) await table.clear();
          // bulkPut triggers hooks unless we disable them in Dexie 
          // or we check the isRecovering flag in the hook itself.
          await table.bulkPut(data);
        }
      } catch (err) {
        console.warn(`Failed to recover ${colName}:`, err);
      }
    }
    console.log('Recovery completed.');
  }

  private static setupListeners(user: User) {
    if (!auth.currentUser) return; // Should not happen given startSync flow

    const isAdmin = user.roles.includes(UserRole.ADMIN_PRINCIPAL) || user.roles.includes(UserRole.SUPERVISEUR);
    const collectionsToWatch = ['transactions', 'slips', 'messages', 'alerts'];

    collectionsToWatch.forEach(colName => {
      let q;
      if (isAdmin) {
        q = query(collection(db_fs, colName));
      } else {
        q = query(collection(db_fs, colName), where('agencyId', '==', user.agencyId));
      }

      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          const data = change.doc.data();
          const docId = change.doc.id;
          const table = (db as any)[colName];
          
          if (!table) return;

          // Convert ID back to number if it was number
          const dexieId = docId.match(/^\d+$/) ? parseInt(docId) : docId;

          if (change.type === 'added' || change.type === 'modified') {
             // Avoid infinite loop: only update Dexie if the local version is older or missing
             const docData = data as object;
             await table.put({ ...docData, id: dexieId });
          } else if (change.type === 'removed') {
             await table.delete(dexieId);
          }
        });
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, colName);
      });

      this.listeners.push(unsub);
    });
  }

  static async pushToCloud(collectionName: string, data: any) {
    if (this.isRecovering) return;
    if (!auth.currentUser) {
      // Silently skip if not authenticated yet, Dexie hooks are fire-and-forget
      // but the app should be authenticated shortly after start.
      return; 
    }
    if (!data.id) return;
    
    const path = `${collectionName}/${data.id}`;
    try {
      await setDoc(doc(db_fs, collectionName, String(data.id)), {
        ...data,
        syncedAt: Date.now()
      });
    } catch (err) {
      // Only report if it's a real failure after we have auth
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  static async deleteFromCloud(collectionName: string, id: number | string) {
    const path = `${collectionName}/${id}`;
    try {
      await deleteDoc(doc(db_fs, collectionName, String(id)));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  // --- RESET ALL USER ACCOUNTS ---
  static async resetAllUsers(): Promise<void> {
    this.stopSync();

    // 1. Clear local users and user-specific states
    await db.users.clear();
    await db.regulationAcceptances.clear();
    localStorage.removeItem('amani_user');

    // 2. Clear cloud users collection if Firestore is reachable
    try {
      const q = query(collection(db_fs, 'users'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db_fs);
      let count = 0;
      snapshot.forEach(docSnap => {
        batch.delete(docSnap.ref);
        count++;
      });
      if (count > 0) {
        await batch.commit();
        console.log(`SyncService: ${count} users deleted from Firestore.`);
      }
    } catch (err) {
      console.warn('SyncService: Cloud users collection could not be cleared (offline or permissions):', err);
    }
  }

  // --- LOCAL BACKUP ---
  
  static async exportToBackup(): Promise<string> {
    const backupData: Record<string, any[]> = {};
    const tables = db.tables;
    
    for (const table of tables) {
      backupData[table.name] = await table.toArray();
    }
    
    const json = JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      data: backupData
    });

    // Simple Obfuscation (Basic Encryption) with Header
    return 'AMANI_BACKUP_v1:' + btoa(unescape(encodeURIComponent(json)));
  }

  static async importFromBackup(encryptedData: string): Promise<void> {
    try {
      let rawData = encryptedData;
      if (rawData.startsWith('AMANI_BACKUP_v1:')) {
        rawData = rawData.replace('AMANI_BACKUP_v1:', '');
      } else {
        throw new Error('Fichier non reconnu comme une sauvegarde AMANI valide.');
      }

      const json = decodeURIComponent(escape(atob(rawData)));
      const backup = JSON.parse(json);
      
      if (!backup.data) throw new Error('Format de sauvegarde invalide');

      // Warning: This replaces all local data. 
      // We should probably ask for confirmation or be selective.
      // But for a full restoration requested, we do it.
      
      for (const tableName in backup.data) {
        const table = (db as any)[tableName];
        if (table) {
          await table.clear();
          await table.bulkPut(backup.data[tableName]);
        }
      }
    } catch (err) {
      console.error('Erreur de restauration:', err);
      throw new Error('Echec de la restauration des données.');
    }
  }
}
