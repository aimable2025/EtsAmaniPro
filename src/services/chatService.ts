import { db } from '../db';
import { ChatMessage, MessageStatus, MessageType, ChatPriority, ServiceType, ChatGroup } from '../types';

export class ChatService {
  /**
   * Envoie un message (local-first)
   */
  static async sendMessage(params: {
    senderId: number;
    senderName: string;
    senderCode: string;
    agencyId: number;
    content: string;
    type?: MessageType;
    recipientId?: number;
    recipientGroupId?: string;
    priority?: ChatPriority;
    service?: ServiceType;
    fileUrl?: string;
    fileName?: string;
    metadata?: any;
  }): Promise<string> {
    const localId = crypto.randomUUID();
    
    const newMessage: ChatMessage = {
      localId,
      senderId: params.senderId,
      senderName: params.senderName,
      senderCode: params.senderCode,
      agencyId: params.agencyId,
      content: params.content,
      type: params.type || MessageType.TEXT,
      recipientId: params.recipientId,
      recipientGroupId: params.recipientGroupId,
      priority: params.priority || ChatPriority.NORMAL,
      service: params.service,
      fileUrl: params.fileUrl,
      fileName: params.fileName,
      metadata: params.metadata,
      timestamp: Date.now(),
      status: MessageStatus.PENDING, // Toujours pending au départ (offline-first)
    };

    await db.messages.add(newMessage);
    
    // Simuler une synchronisation réseau après 1.5s
    setTimeout(() => this.syncMessage(localId), 1500);
    
    return localId;
  }

  /**
   * Simule la synchronisation avec un serveur
   */
  private static async syncMessage(localId: string) {
    const msg = await db.messages.where('localId').equals(localId).first();
    if (msg && msg.status === MessageStatus.PENDING) {
      await db.messages.update(msg.id!, {
        status: MessageStatus.SENT
      });
      
      // Simuler la réception (double check) après 2s
      setTimeout(async () => {
        await db.messages.update(msg.id!, { status: MessageStatus.RECEIVED });
      }, 2000);
    }
  }

  /**
   * Récupère ou crée les groupes automatiques pour un utilisateur
   */
  static async getAutoGroups(agencyId: number, roles: string[]): Promise<ChatGroup[]> {
    const groups: ChatGroup[] = [
      { id: 'global', name: 'Global Entreprise', type: 'global', description: 'Communication générale Ets Amani' }
    ];

    if (agencyId) {
      const agency = await db.agencies.get(agencyId);
      groups.push({ 
        id: `agency-${agencyId}`, 
        name: `Agence ${agency?.name || agencyId}`, 
        type: 'agency', 
        agencyId,
        description: 'Coordination locale de l\'agence'
      });
    }

    // Ajouter les groupes de service selon les rôles
    const services = Object.values(ServiceType);
    services.forEach(service => {
        groups.push({
            id: `service-${service}`,
            name: `Service ${service.toUpperCase()}`,
            type: 'service',
            description: `Canal dédié au service ${service}`
        });
    });

    return groups;
  }
  
  /**
   * Partage une transaction dans le chat
   */
  static async shareTransaction(txId: number, senderParams: any, target: { recipientId?: number, recipientGroupId?: string }) {
    const tx = await db.transactions.get(txId);
    if (!tx) return;

    return this.sendMessage({
      ...senderParams,
      content: `📦 Nouvelle transaction partagée : #TX-${String(tx.id).padStart(4, '0')}`,
      type: MessageType.SYSTEM,
      metadata: { txId: tx.id },
      ...target
    });
  }
}
