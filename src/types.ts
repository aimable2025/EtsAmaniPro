export interface CommissionRate {
  id?: number;
  agencyId: number;
  operationType: SlipType;
  standardRate: number; // e.g. 2.5
  updatedAt: number;
  updatedBy: number;
}

export enum UserRole {
  SUPERVISEUR = 'superviseur',
  ADMIN_PRINCIPAL = 'admin_principal',
  ADMIN_AGENCE = 'admin_agence',
  COMPTABLE = 'comptable',
  CAISSIER_PRINCIPAL = 'caissier_principal',
  GUICHETIER = 'guichetier',
  AGENT_VIRTUEL = 'agent_virtuel',
  AGENT_VODAE = 'agent_vodae',
  AGENT_CHANGE = 'agent_change',
  AGENT_CASH_EXPRESS = 'agent_cash_express',
  CLIENT = 'client',
  SUPER_CLIENT = 'super_client'
}

export enum BankName {
  EQUITY_BCDC = 'Equity BCDC',
  FBN = 'FBN (FirstBank)',
  BOA = 'Bank of Africa',
  ACCESS = 'Access Bank',
  TMB = 'TMB (Trust Merchant Bank)',
  RAWBANK = 'Rawbank',
  ECOBANK = 'Ecobank',
  SOFIBANK = 'Sofibank',
  SOFICOM = 'Soficom'
}

export enum BankTransactionType {
  DEPOT = 'depot',
  RETRAIT = 'retrait',
  TRANSFERT = 'transfert'
}

export enum BankTransactionReason {
  DEPOT = 'dépôt',
  RETRAIT = 'retrait',
  ACHAT_VIRTUEL = 'achat virtuel',
  CASH_EXPRESS = 'cash express',
  EMONEY = 'emoney',
  ECHANGE = 'échange'
}

export enum BankTransactionStatus {
  PENDING = 'EN_ATTENTE',
  VALIDATED = 'VALIDÉ',
  REJECTED = 'REJETÉ'
}

export interface BankAccount {
  id?: number;
  bankName: BankName;
  accountNumber: string;
  accountName: string;
  currency: Currency;
  balance: number;
  agencyId: number;
}

export interface BankTransaction {
  id?: number;
  type: BankTransactionType;
  bankId: number;
  amount: number;
  currency: Currency;
  reason: BankTransactionReason;
  origin: string; // client / banque / agence
  destination: string; // client / banque / agence
  agentId: number;
  timestamp: number;
  proofUrl?: string;
  status: BankTransactionStatus;
  description: string;
  agencyId: number;
}

export enum TransactionType {
  DEPOT = 'depot',
  RETRAIT = 'retrait',
  VENTE_VIRTUELLE = 'vente_virtuelle',
  CASH_EXPRESS = 'cash_express',
  CHANGE = 'change'
}

export enum Currency {
  USD = 'USD',
  CDF = 'CDF',
  VIRTUEL = 'VIRTUEL',
  MOBILE_MONEY = 'MOBILE_MONEY'
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  REJECTED = 'rejected'
}

export enum ReportStatus {
  PENDING = 'en_attente',
  VALIDATED = 'validé',
  REJECTED = 'rejeté'
}

export enum SlipType {
  DEPOT_CLIENT = 'dépôt_client',
  RETRAIT_CLIENT = 'retrait_client',
  ACHAT_VIRTUEL = 'achat_virtuel',
  ACHAT_VODAE = 'achat_vodae',
  CASH_EXPRESS = 'cash_express',
  DEPOT_COMPTE = 'dépôt_sur_compte',
  CONVERSION = 'conversion',
  PRET = 'prêt',
  DEPENSE = 'dépense',
  APPRO_VODAE = 'appro_vodae',
  APPRO_VIRTUEL = 'appro_virtuel',
  SALAIRE = 'salaire'
}

export enum SlipStatus {
  PENDING_VALIDATION = 'EN_ATTENTE_CAISSE', // Created by Comptable
  VALIDATED = 'VALIDÉ_CAISSE', // Approved by Caisse Principale
  COMPLETED = 'TERMINÉ', // Executed by service
  REJECTED = 'REJETÉ',
  PENDING_SUPERVISOR = 'EN_ATTENTE_PATRON' // For expenses/salaries
}

export interface Slip {
  id?: number;
  type: SlipType;
  status: SlipStatus;
  amount: number;
  currency: Currency;
  secondaryAmount?: number;
  secondaryCurrency?: Currency;
  rate?: number;
  comptableId: number;
  caissierId?: number; // Validator
  executorId?: number; // The person who finally did it
  agencyId: number;
  description: string;
  proofUrl?: string; // Image capture
  billetageDetails?: { denomination: number; count: number }[]; // Inlined billetage for the slip
  timestamp: number;
  updatedAt: number;
  signature?: string;
  commissionRate: number; // The rate applied to this specific slip
  commissionAmount: number;
  totalWithCommission: number;
  discountRequested?: boolean;
  discountApproved?: boolean;
  discountReason?: string;
  standardRateAtTime: number; // For audit
}

export interface User {
  id?: number;
  username: string;
  password?: string; // In-memory hash simulation
  fullName: string;
  photoUrl?: string;
  cvUrl?: string;
  phone: string;
  email: string;
  roles: UserRole[];
  agencyId?: number;
  status: UserStatus;
  createdAt: number;
}

export interface Agency {
  id?: number;
  name: string;
  location: string;
  initialBalances: {
    USD: number;
    CDF: number;
    VIRTUEL: number;
    BANQUE: number;
    MOBILE_MONEY: number;
  };
  currentBalances: {
    USD: number;
    CDF: number;
    VIRTUEL: number;
    BANQUE: number;
    MOBILE_MONEY: number;
  };
  exchangeRateUSD_CDF: number;
  defaultCommissionRate: number; // Base rate for the agency
  createdAt: number;
}

export interface Transaction {
  id?: number;
  agencyId: number;
  userId: number;
  clientId?: number;
  type: TransactionType;
  amount: number;
  currency: Currency;
  secondaryAmount?: number; // For change
  secondaryCurrency?: Currency; // For change
  rate?: number;
  description: string;
  timestamp: number;
  status: 'completed' | 'pending' | 'cancelled';
  signature?: string;
  commissionAmount?: number;
  commissionRate?: number;
}

export interface Billetage {
  id?: number;
  agencyId: number;
  userId: number;
  timestamp: number;
  currency: Currency;
  details: {
    denomination: number;
    count: number;
  }[];
  total: number;
}

export interface Debt {
  id?: number;
  debtorName: string;
  agencyId: number;
  userId: number;
  amount: number;
  currency: Currency;
  type: 'client' | 'agent' | 'enterprise';
  status: 'active' | 'partial' | 'paid';
  dueDate: number;
  createdAt: number;
}

export type AuditAction = 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'TRANSACTION' 
  | 'SLIP_CREATE' 
  | 'SLIP_CREE'
  | 'SLIP_VALIDATE' 
  | 'COMMISSION_UPDATE' 
  | 'USER_CREATE' 
  | 'USER_UPDATE' 
  | 'AGENCY_UPDATE' 
  | 'BILLETAGE'
  | 'BACKUP_EXPORT'
  | 'RESTORE_IMPORT'
  | 'RESTORE_CLOUD'
  | 'CREATION_AGENCE'
  | 'MISE_A_JOUR_TRESORERIE'
  | 'TRANSFERT_FONDS'
  | 'TRANSACTION_BANCAIRE_CREEE'
  | 'VALIDATION_TRANSACTION_BANCAIRE_EN_ATTENTE'
  | 'VALIDATION_TRANSACTION_BANCAIRE_VALIDÉ'
  | 'VALIDATION_TRANSACTION_BANCAIRE_REJETÉ'
  | 'CREATION_DETTE'
  | 'PAIEMENT_DETTE'
  | 'EDITION_UTILISATEUR'
  | 'CREATION_UTILISATEUR'
  | 'CHANGEMENT_STATUT_UTILISATEUR'
  | 'SUPPRESSION_UTILISATEUR'
  | 'ACCEPT_REGULATION'
  | 'CREATE_REGULATION'
  | 'UPDATE_REGULATION';

export interface AuditLog {
  id?: number;
  userId: number;
  action: AuditAction;
  details: string;
  timestamp: number;
  signature?: string;
  userAgent?: string;
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system', // For business integration (transaction sharing)
  ALERT = 'alert' // For fraud and anomaly detection
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'ATTENTION',
  CRITICAL = 'CRITIQUE'
}

export enum AlertType {
  FINANCIAL = 'ANOMALIE_FINANCIERE',
  BEHAVIOR = 'COMPORTEMENT_SUSPECT',
  OPERATIONAL = 'RISQUE_OPERATIONNEL',
  SECURITY = 'ALERTE_SECURITE'
}

export interface Alert {
  id?: number;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  userId?: number;
  userName?: string;
  agencyId: number;
  agencyName: string;
  relatedId?: number | string; // Link to TX, Report, etc.
  relatedType?: 'transaction' | 'slip' | 'report' | 'debt' | 'user' | 'agency' | 'backup';
  timestamp: number;
  status: 'active' | 'resolved' | 'dismissed';
  resolvedBy?: number;
  resolvedAt?: number;
  isSystemGenerated: boolean;
}

export enum MessageStatus {
  PENDING = 'PENDING', // Offline
  SENT = 'SENT',
  RECEIVED = 'RECEIVED',
  READ = 'READ'
}

export enum ChatPriority {
  NORMAL = 'normal',
  URGENT = 'urgent'
}

export enum ServiceType {
  COMPTABILITE = 'comptabilité',
  CAISSE = 'caisse',
  GUICHET = 'guichet',
  VIRTUEL = 'virtuel',
  VODAE = 'vodae',
  CHANGE = 'change',
  GENERAL = 'général'
}

export interface ChatMessage {
  id?: number;
  localId: string; // Unique UUID for offline tracking
  senderId: number;
  senderName: string;
  senderCode: string;
  recipientId?: number; // For private 1:1
  recipientGroupId?: string; // For auto-groups (agency-ID or service-TYPE)
  content: string;
  type: MessageType;
  fileUrl?: string; // Data URI for offline-first images/files if needed, or real URL
  fileName?: string;
  timestamp: number;
  status: MessageStatus;
  priority: ChatPriority;
  agencyId: number;
  service?: ServiceType;
  metadata?: any; // For sharing transactions (e.g. { txId: 123 })
  reactions?: Record<string, number[]>; // emoji -> list of userIds
}

export interface ChatGroup {
  id: string; // e.g., 'agency-1', 'service-comptabilite', 'global'
  name: string;
  type: 'agency' | 'service' | 'global' | 'custom';
  description?: string;
  agencyId?: number;
  members?: number[]; // User IDs for custom groups
  lastMessage?: ChatMessage;
  unreadCount?: number;
}

export interface DailyReport {
  id?: number;
  agencyId: number;
  userId: number;
  date: string; // ISO date string
  status: ReportStatus;
  details: string;
  timestamp: number;
}

export interface Regulation {
  id?: number;
  version: number;
  title: string;
  sections: {
    title: string;
    content: string;
  }[];
  createdBy: number;
  createdAt: number;
  isActive: boolean;
}

export interface RegulationAcceptance {
  id?: number;
  userId: number;
  regulationId: number;
  version: number;
  acceptedAt: number;
  userAgent?: string;
}
