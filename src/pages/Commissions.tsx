import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { SlipType, UserRole, CommissionRate, Currency } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { 
  Settings2, 
  Percent, 
  TrendingUp, 
  ArrowRightLeft, 
  ShieldAlert, 
  Save, 
  History, 
  AlertCircle,
  Building2,
  Filter,
  CheckCircle2,
  BarChart3,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Commissions() {
  const { user } = useAuth();
  const agencies = useLiveQuery(() => db.agencies.toArray());
  const storedRates = useLiveQuery(() => db.commissionRates.toArray());
  const slips = useLiveQuery(() => db.slips.toArray());
  
  const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [defaultRate, setDefaultRate] = useState<number>(0);

  // Default rates if none exist
  const [editingRates, setEditingRates] = useState<Record<string, number>>({});

  const isAdmin = user?.roles.includes(UserRole.SUPERVISEUR) || user?.roles.includes(UserRole.ADMIN_PRINCIPAL);

  // Pre-load current rates for selected agency
  React.useEffect(() => {
    if (selectedAgencyId && storedRates && agencies) {
      const agency = agencies.find(a => a.id === selectedAgencyId);
      setDefaultRate(agency?.defaultCommissionRate || 0);

      const agencyRates = storedRates.filter(r => r.agencyId === selectedAgencyId);
      const ratesMap: Record<string, number> = {};
      Object.values(SlipType).forEach(type => {
        const found = agencyRates.find(r => r.operationType === type);
        ratesMap[type] = found ? found.standardRate : (agency?.defaultCommissionRate || 0);
      });
      setEditingRates(ratesMap);
    }
  }, [selectedAgencyId, storedRates, agencies]);

  const handleSaveRate = async () => {
    if (!selectedAgencyId || !user?.id) return;
    setIsSaving(true);
    
    try {
      // 1. Update Agency level default rate
      await db.agencies.update(selectedAgencyId, {
        defaultCommissionRate: defaultRate
      });

      // 2. Update specific operation rates
      for (const [type, rate] of Object.entries(editingRates)) {
        const existing = storedRates?.find(r => r.agencyId === selectedAgencyId && r.operationType === type);
        
        if (existing) {
          await db.commissionRates.update(existing.id!, {
            standardRate: rate,
            updatedAt: Date.now(),
            updatedBy: user.id
          });
        } else {
          await db.commissionRates.add({
            agencyId: selectedAgencyId,
            operationType: type as SlipType,
            standardRate: rate,
            updatedAt: Date.now(),
            updatedBy: user.id
          });
        }
      }

      await db.auditLogs.add({
        userId: user.id,
        action: 'COMMISSION_UPDATE',
        details: `Mise à jour des taux de commission pour l'agence #${selectedAgencyId}`,
        timestamp: Date.now()
      });

      setSuccess("Configuration enregistrée avec succès");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const dashboardStats = useMemo(() => {
    if (!slips) return { today: 0, month: 0, discounts: 0 };
    
    const today = new Date().setHours(0, 0, 0, 0);
    const completedSlips = slips.filter(s => s.status === 'TERMINÉ');
    
    return {
      today: completedSlips.filter(s => s.timestamp >= today).reduce((acc, s) => acc + (s.commissionAmount || 0), 0),
      month: completedSlips.reduce((acc, s) => acc + (s.commissionAmount || 0), 0),
      discounts: slips.filter(s => s.discountApproved).length
    };
  }, [slips]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-neutral-400">
        <ShieldAlert className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-xl font-display font-black uppercase tracking-widest">Accès Restreint</h2>
        <p className="text-xs font-medium italic">Seul le Superviseur peut configurer les taux de commission.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-4xl font-display font-black tracking-tighter text-neutral-900 group">
             Gestion des <span className="text-blue-600">Commissions</span>
           </h1>
           <p className="text-neutral-500 font-medium max-w-lg mt-1">Standardisation des revenus et contrôle des exceptions tarifaires.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white px-4 py-2 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Total Aujourd'hui</p>
              <p className="text-sm font-display font-black text-neutral-900">{formatCurrency(dashboardStats.today, Currency.USD)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Configuration Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card border-none shadow-xl shadow-neutral-200/50 overflow-hidden">
            <div className="p-8 border-b border-neutral-100 bg-neutral-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-800">Configuration des Taux</h3>
                  <p className="text-[10px] text-neutral-400 font-black uppercase tracking-widest italic">Standardiser par agence</p>
                </div>
              </div>
              
              <select 
                className="input max-w-xs h-11 bg-white" 
                value={selectedAgencyId || ''} 
                onChange={e => setSelectedAgencyId(Number(e.target.value))}
              >
                <option value="">Sélectionner une agence...</option>
                {agencies?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {selectedAgencyId ? (
              <div className="p-8 space-y-8">
                {/* Global Agency Default Rate */}
                <div className="p-6 rounded-[2rem] bg-blue-600 text-white shadow-xl shadow-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-display font-black tracking-tighter">Taux Standard par Défaut</h4>
                      <p className="text-[10px] uppercase font-black tracking-widest text-blue-100/60">S'applique à toutes les opérations non spécifiées</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="relative">
                          <input 
                            type="number" 
                            step="0.1"
                            className="w-24 px-4 py-3 bg-white text-neutral-900 rounded-2xl font-display font-black text-xl text-center focus:outline-none"
                            value={defaultRate}
                            onChange={e => setDefaultRate(Number(e.target.value))}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">%</span>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase font-black tracking-widest text-neutral-400 flex items-center gap-2">
                    <Filter className="w-3 h-3" /> Overrides Spécifiques par Opération
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.values(SlipType).map(type => (
                      <div key={type} className="p-4 rounded-2xl border border-neutral-100 bg-neutral-50/30 flex items-center justify-between group hover:border-blue-100 transition-all">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">{type.replace('_', ' ')}</span>
                          <span className="text-xs font-bold text-neutral-700">Taux Standard (%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <input 
                              type="number" 
                              step="0.1"
                              min="0"
                              max="100"
                              className="w-20 px-3 py-2 bg-white border border-neutral-200 rounded-xl font-mono text-xs font-bold text-center focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                              value={editingRates[type] || 0}
                              onChange={e => setEditingRates({...editingRates, [type]: Number(e.target.value)})}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-300">%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-neutral-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 italic">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Les changements s'appliquent immédiatement aux nouveaux bordereaux.
                  </div>
                  <button 
                    onClick={handleSaveRate}
                    disabled={isSaving}
                    className="btn btn-primary h-12 px-8 shadow-xl shadow-blue-500/20 group"
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="uppercase tracking-widest text-[10px] font-black">Sauvegarder</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-20 text-center flex flex-col items-center justify-center">
                <Building2 className="w-16 h-16 text-neutral-100 mb-4" />
                <p className="text-xs font-black uppercase text-neutral-300 tracking-widest">Choisir une agence pour commencer</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Stats & Insights */}
        <div className="space-y-6">
          <div className="card p-8 border-none bg-neutral-900 text-white shadow-2xl">
            <h3 className="text-xl font-display font-bold tracking-tighter mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" /> Analyse Revenus
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Volume Cumulé</p>
                  <p className="text-2xl font-display font-black">{formatCurrency(dashboardStats.month, Currency.USD)}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  < TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Exceptions Validées</p>
                  <p className="text-2xl font-display font-black">{dashboardStats.discounts}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-4">Top Agences (Revenus)</p>
              <div className="space-y-4">
                {agencies?.slice(0, 3).map((a, idx) => (
                  <div key={a.id} className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-300">{a.name}</span>
                    <div className="h-1 flex-1 mx-4 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${80 - (idx * 20)}%` }} />
                    </div>
                    <span className="text-[10px] font-mono font-black text-blue-400">82.5%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-6 border-blue-100 bg-blue-50/30">
            <div className="flex items-center gap-3 mb-4">
              <History className="w-5 h-5 text-blue-600" />
              <h4 className="text-sm font-bold text-neutral-800">Dernières Activités</h4>
            </div>
            <div className="space-y-3">
              {storedRates?.slice(-3).reverse().map((r, i) => (
                <div key={i} className="flex items-baseline gap-3">
                  <div className="w-1 h-1 rounded-full bg-blue-400 shrink-0 translate-y-[-4px]" />
                  <p className="text-[10px] font-medium text-neutral-500 leading-relaxed italic">
                    Taux {r.operationType.replace('_', ' ')} fixé à <span className="font-bold text-neutral-900">{r.standardRate}%</span> pour {agencies?.find(a => a.id === r.agencyId)?.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">{success}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
