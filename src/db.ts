import Dexie, { Table } from 'dexie';
import {
  User,
  Agency,
  Transaction,
  Billetage,
  Debt,
  AuditLog,
  ChatMessage,
  ChatGroup,
  DailyReport,
  BankAccount,
  BankTransaction,
  Slip,
  CommissionRate,
  Alert,
  Regulation,
  RegulationAcceptance
} from './types';

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
      regulationAcceptances:
        '++id, userId, regulationId, [userId+regulationId], version, acceptedAt'
    });

    /*
     * IMPORTANT :
     * On ne fait plus d'import statique de SyncService ici.
     *
     * Avant :
     *
     * db.ts -> SyncService.ts -> db.ts
     *
     * Cette dépendance circulaire pouvait provoquer des problèmes
     * d'initialisation dans Android WebView.
     *
     * Maintenant, SyncService est chargé dynamiquement uniquement
     * lorsqu'une opération doit être synchronisée.
     */

    const syncableTables = [
      'transactions',
      'slips',
      'messages',
      'alerts',
      'users',
      'agencies',
      'auditLogs',
      'debts',
      'billetages',
      'reports',
      'bankAccounts',
      'bankTransactions',
      'commissionRates',
      'regulations',
      'regulationAcceptances'
    ];

    syncableTables.forEach((tableName) => {
      const table = (this as any)[tableName] as Table;

      if (!table) return;

      table.hook('creating', (primKey, obj) => {
        Dexie.currentTransaction?.on('complete', () => {
          void import('./services/SyncService')
            .then(({ SyncService }) => {
              return SyncService.pushToCloud(tableName, {
                ...obj,
                id: primKey
              });
            })
            .catch((err) => {
              console.warn(
                `SyncService creating error [${tableName}]:`,
                err
              );
            });
        });
      });

      table.hook('updating', (mods, primKey, obj) => {
        Dexie.currentTransaction?.on('complete', () => {
          void import('./services/SyncService')
            .then(({ SyncService }) => {
              return SyncService.pushToCloud(tableName, {
                ...obj,
                ...mods,
                id: primKey
              });
            })
            .catch((err) => {
              console.warn(
                `SyncService updating error [${tableName}]:`,
                err
              );
            });
        });
      });

      table.hook('deleting', (primKey) => {
        Dexie.currentTransaction?.on('complete', () => {
          void import('./services/SyncService')
            .then(({ SyncService }) => {
              return SyncService.deleteFromCloud(
                tableName,
                primKey as any
              );
            })
            .catch((err) => {
              console.warn(
                `SyncService deleting error [${tableName}]:`,
                err
              );
            });
        });
      });
    });
  }
}

export const db = new AmaniLedgerDB();

export async function initializeSystem(): Promise<void> {
  try {
    await db.open();

    console.log('Ets AMANI: base de données locale ouverte.');

    /*
     * Migration structurelle initiale.
     *
     * IMPORTANT :
     * On ne fait plus window.location.reload().
     * Un reload automatique est inutile et peut être problématique
     * dans l'environnement Capacitor/WebView.
     */
    const isWiped = localStorage.getItem('amani_wiped_v4');

    if (!isWiped) {
      await Promise.all([
        db.users.clear(),
        db.settings.clear(),
        db.auditLogs.clear(),
        db.messages.clear(),
        db.chatGroups.clear()
      ]);

      localStorage.removeItem('amani_user');
      localStorage.setItem('amani_wiped_v4', 'true');

      console.log(
        'Ets AMANI: migration structurelle initiale terminée.'
      );
    }

    /*
     * Réinitialisation des anciens comptes de démonstration.
     */
    const isUsersReset = localStorage.getItem(
      'ets_amani_users_reset_v1'
    );

    if (!isUsersReset) {
      await db.users.clear();
      await db.regulationAcceptances.clear();

      localStorage.removeItem('amani_user');
      localStorage.setItem('ets_amani_users_reset_v1', 'true');

      /*
       * Le nettoyage cloud est secondaire.
       * Il ne doit jamais empêcher l'application locale
       * de démarrer.
       */
      void import('./services/SyncService')
        .then(({ SyncService }) => {
          return SyncService.resetAllUsers();
        })
        .catch((err) => {
          console.warn(
            'SyncService.resetAllUsers error during init:',
            err
          );
        });

      console.log(
        'Ets AMANI: réinitialisation locale des utilisateurs terminée.'
      );
    }
  } catch (err) {
    console.error(
      'Ets AMANI: erreur lors de l’ouverture de la base locale:',
      err
    );

    /*
     * Ne jamais faire planter React à cause de Firebase ou
     * d'un problème réseau.
     */
    if (err instanceof Error && err.name === 'VersionError') {
      try {
        localStorage.clear();
      } catch {
        // Rien à faire si localStorage est indisponible.
      }

      console.warn(
        'Ets AMANI: conflit de version IndexedDB détecté.'
      );
    }
  }
}
