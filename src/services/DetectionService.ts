import { db } from '../db';
import { 
  Alert, 
  AlertSeverity, 
  AlertType, 
  ChatMessage, 
  MessageType, 
  MessageStatus, 
  ChatPriority, 
  User, 
  UserRole,
  Slip,
  DailyReport,
  Debt
} from '../types';

export class DetectionService {
  static async triggerAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'status' | 'isSystemGenerated'>) {
    const timestamp = Date.now();
    
    // 1. Create the alert record
    const alertId = await db.alerts.add({
      ...alert,
      timestamp,
      status: 'active',
      isSystemGenerated: true
    } as Alert);

    // 2. Find supervisors and admins to notify
    const staff = await db.users
      .filter(u => u.roles.includes(UserRole.SUPERVISEUR) || u.roles.includes(UserRole.ADMIN_PRINCIPAL))
      .toArray();

    // 3. Create a chat message for the alert
    // By convention, we'll send it to the 'alerts' group if it exists, or just to the global group
    const message: ChatMessage = {
      localId: crypto.randomUUID(),
      senderId: 0, // System user ID
      senderName: 'SYSTÈME ETS AMANI',
      senderCode: 'SYSTEM',
      content: `${alert.severity}: ${alert.title}\n${alert.description}`,
      type: MessageType.ALERT,
      timestamp,
      status: MessageStatus.SENT,
      priority: alert.severity === AlertSeverity.CRITICAL ? ChatPriority.URGENT : ChatPriority.NORMAL,
      agencyId: alert.agencyId,
      recipientGroupId: 'global', // Send to global alert channel
      metadata: {
        alertId,
        relatedId: alert.relatedId,
        relatedType: alert.relatedType
      }
    };

    await db.messages.add(message);
    
    // Also send to agency-specific group if it's a behavior or operational risk
    if (alert.type !== AlertType.FINANCIAL) {
        await db.messages.add({
            ...message,
            localId: crypto.randomUUID(),
            recipientGroupId: `agency-${alert.agencyId}`
        });
    }

    return alertId;
  }

  static async checkSlipAnomaly(slip: Slip, creator: User) {
    const agency = await db.agencies.get(slip.agencyId);
    if (!agency) return;

    // A. Montant anormalement élevé
    const highAmountThreshold = slip.currency === 'USD' ? 5000 : 10000000;
    if (slip.amount > highAmountThreshold) {
      await this.triggerAlert({
        type: AlertType.FINANCIAL,
        severity: AlertSeverity.WARNING,
        title: 'Montant Élevé Détecté',
        description: `Une transaction de ${slip.amount} ${slip.currency} a été initiée par ${creator.fullName}. Seuil dépassé.`,
        agencyId: slip.agencyId,
        agencyName: agency.name,
        userId: creator.id,
        userName: creator.fullName,
        relatedId: slip.id,
        relatedType: 'slip'
      });
    }

    // B. Commission modifiée anormalement
    // Assuming standard commission check logic here
    if (slip.commissionRate < agency.defaultCommissionRate * 0.5) {
        await this.triggerAlert({
            type: AlertType.FINANCIAL,
            severity: AlertSeverity.CRITICAL,
            title: 'Commission Suspecte',
            description: `Commission très basse (${slip.commissionRate}%) appliquée par ${creator.fullName} sur un montant de ${slip.amount} ${slip.currency}.`,
            agencyId: slip.agencyId,
            agencyName: agency.name,
            userId: creator.id,
            userName: creator.fullName,
            relatedId: slip.id,
            relatedType: 'slip'
          });
    }

    // C. Transaction sans pièce justificative (description trop courte)
    if (!slip.description || slip.description.trim().length < 5) {
      await this.triggerAlert({
        type: AlertType.OPERATIONAL,
        severity: AlertSeverity.WARNING,
        title: 'Absence de Justificatif',
        description: `Bordereau #${slip.id} créé par ${creator.fullName} sans description ou justification suffisante.`,
        agencyId: slip.agencyId,
        agencyName: agency.name,
        userId: creator.id,
        userName: creator.fullName,
        relatedId: slip.id,
        relatedType: 'slip'
      });
    }
  }

  static async checkFrequentCancellations(userId: number, agencyId: number) {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentCancellations = await db.auditLogs
      .where('userId').equals(userId)
      .and(log => log.timestamp > oneHourAgo && log.action.includes('ANNULATION'))
      .count();

    if (recentCancellations >= 3) {
      const user = await db.users.get(userId);
      const agency = await db.agencies.get(agencyId);
      if (!user || !agency) return;

      await this.triggerAlert({
        type: AlertType.BEHAVIOR,
        severity: AlertSeverity.CRITICAL,
        title: 'Annulations Fréquentes',
        description: `${user.fullName} a annulé ${recentCancellations} opérations au cours de la dernière heure.`,
        agencyId: agencyId,
        agencyName: agency.name,
        userId: userId,
        userName: user.fullName,
        relatedType: 'user',
        relatedId: userId
      });
    }
  }

  static async checkLowTreasury(agencyId: number) {
    const agency = await db.agencies.get(agencyId);
    if (!agency) return;

    if (agency.currentBalances.USD < 100 || agency.currentBalances.CDF < 200000) {
      await this.triggerAlert({
        type: AlertType.OPERATIONAL,
        severity: AlertSeverity.WARNING,
        title: 'Trésorerie Faible',
        description: `Le solde de l'agence ${agency.name} est critique (USD: ${agency.currentBalances.USD}, CDF: ${agency.currentBalances.CDF}).`,
        agencyId: agencyId,
        agencyName: agency.name,
        relatedType: 'agency',
        relatedId: agencyId
      });
    }
  }

  static async checkDebtAccumulation(debtorId: number, agencyId: number) {
      const activeDebts = await db.debts
        .where('userId').equals(debtorId)
        .and(d => d.status === 'active')
        .toArray();
      
      const totalDebt = activeDebts.reduce((acc, d) => acc + d.amount, 0);
      if (totalDebt > 1000) { // Example threshold
          const user = await db.users.get(debtorId);
          const agency = await db.agencies.get(agencyId);
          await this.triggerAlert({
              type: AlertType.FINANCIAL,
              severity: AlertSeverity.WARNING,
              title: 'Accumulation de Dettes',
              description: `Dettes cumulées de ${totalDebt} USD pour l'agent ${user?.fullName}.`,
              agencyId: agencyId,
              agencyName: agency?.name || 'Inconnue',
              userId: debtorId,
              userName: user?.fullName,
              relatedType: 'user',
              relatedId: debtorId
          });
      }
  }

  static async checkSuspectActivity(user: User) {
    const now = new Date();
    const hour = now.getHours();
    
    // 1. Outside normal hours (e.g., 20:00 - 06:00)
    if (hour >= 20 || hour < 6) {
      const agency = await db.agencies.get(user.agencyId || 0);
      await this.triggerAlert({
        title: "Activité Hors Horaires",
        description: `L'agent ${user.fullName} effectue une opération à ${hour}h, en dehors des heures normales de service.`,
        severity: AlertSeverity.WARNING,
        type: AlertType.OPERATIONAL,
        userId: user.id,
        userName: user.fullName,
        agencyId: user.agencyId || 0,
        agencyName: agency?.name || "N/A"
      });
    }

    // 2. Mock Geo-location anomaly (random chance for simulation)
    if (Math.random() > 0.98) {
      const agency = await db.agencies.get(user.agencyId || 0);
      await this.triggerAlert({
        title: "Connexion Géographique Suspecte",
        description: `Une tentative d'accès a été détectée depuis une localisation inhabituelle pour l'agent ${user.fullName}.`,
        severity: AlertSeverity.CRITICAL,
        type: AlertType.SECURITY,
        userId: user.id,
        userName: user.fullName,
        agencyId: user.agencyId || 0,
        agencyName: agency?.name || "N/A"
      });
    }
  }

  static async checkBilletageAnomaly(data: {
    agencyId: number;
    userId: number;
    declaredTotal: number;
    calculatedTotal: number;
    currency: string;
  }) {
    const gap = Math.abs(data.declaredTotal - data.calculatedTotal);
    const threshold = data.currency === 'USD' ? 50 : 100000;

    if (gap > threshold) {
      const user = await db.users.get(data.userId);
      const agency = await db.agencies.get(data.agencyId);
      await this.triggerAlert({
        title: "Écart de Caisse Détecté",
        description: `Un écart de ${gap} ${data.currency} a été constaté lors du billetage par l'agent ${user?.fullName}.`,
        severity: AlertSeverity.CRITICAL,
        type: AlertType.FINANCIAL,
        userId: data.userId,
        userName: user?.fullName,
        agencyId: data.agencyId,
        agencyName: agency?.name || "N/A"
      });
    }
  }

  static async checkOperationDensity(userId: number, agencyId: number) {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    const recentOps = await db.auditLogs
      .where('userId').equals(userId)
      .and(log => log.timestamp > tenMinutesAgo)
      .count();

    if (recentOps >= 15) { // Threshold: 15 operations in 10 minutes
      const user = await db.users.get(userId);
      const agency = await db.agencies.get(agencyId);
      await this.triggerAlert({
        title: "Activité Frénétique Détectée",
        description: `L'agent ${user?.fullName} a effectué ${recentOps} opérations en moins de 10 minutes. Risque de manipulation d'erreurs ou fraude.`,
        severity: AlertSeverity.WARNING,
        type: AlertType.BEHAVIOR,
        userId: userId,
        userName: user?.fullName,
        agencyId,
        agencyName: agency?.name || "N/A"
      });
    }
  }
}
