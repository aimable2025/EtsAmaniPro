import Dexie, { Table } from 'dexie';
import { User, Agency, Transaction, Billetage, Debt, AuditLog, ChatMessage, ChatGroup, DailyReport, BankAccount, BankTransaction, Slip, CommissionRate, Alert, Regulation, RegulationAcceptance } from './types';
import { SyncService } from './services/SyncService';

export class AmaniLedgerDB extends Dexie {
  users!: Table<User>;
  agencies!: Table<Agency>;
  transactions!: Table<Transaction>;
  billetages!: Table<Billetage>;
  debts!: Table<Debt>;
  auditLogs!: Table<AuditLog>;
  messages!: Table<ChatMessage>;
  chatGroups!: Table<ChatGroup>;
  reports!: Table<DailyReport>;
  bankAccounts!: Table<BankAccount>;
  bankTransactions!: Table<BankTransaction>;
  slips!: Table<Slip>;
  settings!: Table<{ key: string; value: any }>;
  commissionRates!: Table<CommissionRate>;
  alerts!: Table<Alert>;
  regulations!: Table<Regulation>;
  regulationAcceptances!: Table<RegulationAcceptance>;

  constructor() {
    super('AmaniLedgerDB');
    this.version(9).stores({
      users: '++id, username, email, phone, status, *roles, agencyId',
      agencies: '++id, name',
      transactions: '++id, agencyId, userId, type, currency, timestamp',
      billetages: '++id, agencyId, userId, timestamp, currency',
      debts: '++id, agencyId, userId, type, status',
      auditLogs: '++id, userId, timestamp, action',
      messages: '++id, localId, senderId, recipientId, recipientGroupId, timestamp, status, agencyId',
      chatGroups: 'id, type, agencyId',
      reports: '++id, agencyId, userId, date, status',
      bankAccounts: '++id, bankName, accountNumber, currency, agencyId',
      bankTransactions: '++id, type, bankId, agentId, timestamp, status, agencyId',
      slips: '++id, type, status, comptableId, caissierId, executorId, agencyId, timestamp',
      settings: 'key',
      commissionRates: '++id, [agencyId+operationType], agencyId, operationType',
      alerts: '++id, type, severity, agencyId, userId, status, timestamp, relatedId',
      regulations: '++id, version, isActive',
      regulationAcceptances: '++id, userId, regulationId, [userId+regulationId], version, acceptedAt'
    });

    // Add Hooks for Cloud Sync
    const syncableTables = [
      'transactions', 'slips', 'messages', 'alerts', 'users', 'agencies', 
      'auditLogs', 'debts', 'billetages', 'reports', 'bankAccounts', 
      'bankTransactions', 'commissionRates', 'regulations', 'regulationAcceptances'
    ];
    syncableTables.forEach(tableName => {
      const table = (this as any)[tableName] as Table;
      
      table.hook('creating', (primKey, obj) => {
        // We push to cloud after it is actually created in Dexie
        // Dexie hooks are synchronous, so we use setTimeout or transaction.on('complete')
        Dexie.currentTransaction?.on('complete', () => {
          SyncService.pushToCloud(tableName, { ...obj, id: primKey });
        });
      });

      table.hook('updating', (mods, primKey, obj) => {
        Dexie.currentTransaction?.on('complete', () => {
          SyncService.pushToCloud(tableName, { ...obj, ...mods, id: primKey });
        });
      });

      table.hook('deleting', (primKey) => {
        Dexie.currentTransaction?.on('complete', () => {
          SyncService.deleteFromCloud(tableName, primKey as any);
        });
      });
    });
  }
}

export const db = new AmaniLedgerDB();

// Initial Data Simulation / Setup Check
export async function initializeSystem() {
  try {
    await db.open();
    const isWiped = localStorage.getItem('amani_wiped_v4');
    if (!isWiped) {
      // Clear data to ensure structural compatibility with v7
      await Promise.all([
        db.users.clear(),
        db.settings.clear(),
        db.auditLogs.clear(),
        db.messages.clear(),
        db.chatGroups.clear()
      ]);
      
      localStorage.removeItem('amani_user');
      localStorage.setItem('amani_wiped_v4', 'true');
      console.log('System structural migration completed. localId chat added.');
      window.location.reload();
      return;
    }

    const isUsersReset = localStorage.getItem('ets_amani_users_reset_v1');
    if (!isUsersReset) {
      await db.users.clear();
      await db.regulationAcceptances.clear();
      localStorage.removeItem('amani_user');
      localStorage.setItem('ets_amani_users_reset_v1', 'true');
      SyncService.resetAllUsers().catch((err) => {
        console.warn('SyncService.resetAllUsers error during init:', err);
      });
      console.log('Réinitialisation de tous les comptes utilisateurs effectuée avec succès.');
    }
  } catch (err) {
    console.error('Database connection failed:', err);
    // If version error, suggest clear
    if (err instanceof Error && err.name === 'VersionError') {
      localStorage.clear();
      window.location.reload();
    }
  }
}
