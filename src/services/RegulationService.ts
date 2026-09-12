import { db } from '../db';
import { Regulation, RegulationAcceptance, AuditAction } from '../types';

export class RegulationService {
  static async getActiveRegulation(): Promise<Regulation | null> {
    const regulation = await db.regulations
      .where('isActive')
      .equals(1 as any)
      .first();
    return regulation || null;
  }

  static async hasAcceptedLatest(userId: number): Promise<boolean> {
    const active = await this.getActiveRegulation();
    if (!active) return true; // No regulation active, so nothing to accept

    const acceptance = await db.regulationAcceptances
      .where('[userId+regulationId]')
      .equals([userId, active.id!] as any)
      .first();

    return !!acceptance && acceptance.version === active.version;
  }

  static async acceptRegulation(userId: number, regulationId: number, version: number): Promise<void> {
    const acceptance: RegulationAcceptance = {
      userId,
      regulationId,
      version,
      acceptedAt: Date.now(),
      userAgent: navigator.userAgent
    };

    await db.regulationAcceptances.add(acceptance);
    
    // Log audit
    await db.auditLogs.add({
      userId,
      action: 'ACCEPT_REGULATION' as AuditAction,
      details: `Acceptation du règlement version ${version}`,
      timestamp: Date.now()
    });
  }

  static async createNewVersion(title: string, sections: { title: string; content: string }[], userId: number): Promise<void> {
    // Deactivate previous
    await db.regulations.where('isActive').equals(1 as any).modify({ isActive: false });

    const last = await db.regulations.orderBy('version').last();
    const newVersion = (last?.version || 0) + 1;

    const regulation: Regulation = {
      title,
      sections,
      version: newVersion,
      createdBy: userId,
      createdAt: Date.now(),
      isActive: true
    };

    await db.regulations.add(regulation);

    // Log audit
    await db.auditLogs.add({
      userId,
      action: 'CREATE_REGULATION' as AuditAction,
      details: `Création du règlement version ${newVersion}`,
      timestamp: Date.now()
    });
  }

  static async getAllVersions(): Promise<Regulation[]> {
    return db.regulations.orderBy('version').reverse().toArray();
  }

  static async getAcceptancesByRegulation(regulationId: number): Promise<RegulationAcceptance[]> {
    return db.regulationAcceptances.where('regulationId').equals(regulationId).toArray();
  }
}
