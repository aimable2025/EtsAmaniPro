import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertSeverity, AlertType, UserRole } from '../types';
import { formatDate, cn } from '../lib/utils';
import { 
  ShieldAlert, 
  ShieldX, 
  Info, 
  Search, 
  Filter, 
  ArrowRight,
  CheckCircle2,
  XCircle,
  Eye,
  Trash2,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Alerts() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | AlertSeverity>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');
  
  const alerts = useLiveQuery(() => 
    db.alerts.orderBy('timestamp').reverse().toArray()
  );

  const filteredAlerts = alerts?.filter(a => {
    const matchesSearch = 
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.agencyName.toLowerCase().includes(search.toLowerCase()) ||
      (a.userName?.toLowerCase().includes(search.toLowerCase()) ?? false);
    
    const matchesSeverity = severityFilter === 'all' || a.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const handleResolve = async (id: number) => {
    await db.alerts.update(id, { 
      status: 'resolved', 
      resolvedBy: user?.id, 
      resolvedAt: Date.now() 
    });
  };

  const handleDelete = async (id: number, severity: AlertSeverity) => {
    if (severity === AlertSeverity.CRITICAL) {
      alert("Impossible de supprimer une alerte critique pour des raisons de conformité.");
      return;
    }
    if (confirm("Supprimer cette alerte de l'historique ?")) {
      await db.alerts.delete(id);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-4xl font-display font-black tracking-tighter text-neutral-900">
             Centre de <span className="text-red-600">Lutte Anti-Fraude</span>
           </h1>
           <p className="text-neutral-500 font-medium max-w-lg mt-1 italic">Surveillance intelligente des anomalies et détection préventive des risques financiers.</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-2xl border border-neutral-100 shadow-sm">
           <button 
             onClick={() => setStatusFilter('all')}
             className={cn(
               "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
               statusFilter === 'all' ? "bg-neutral-900 text-white shadow-lg" : "text-neutral-400 hover:bg-neutral-50"
             )}
           >Toutes</button>
           <button 
             onClick={() => setStatusFilter('active')}
             className={cn(
               "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
               statusFilter === 'active' ? "bg-red-600 text-white shadow-lg" : "text-neutral-400 hover:bg-neutral-50"
             )}
           >Actives</button>
           <button 
             onClick={() => setStatusFilter('resolved')}
             className={cn(
               "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
               statusFilter === 'resolved' ? "bg-green-600 text-white shadow-lg" : "text-neutral-400 hover:bg-neutral-50"
             )}
           >Résolues</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
           <div className="card p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                 <Filter className="w-4 h-4 text-blue-600" />
                 <h2 className="text-xs font-black uppercase tracking-widest">Filtres Vigilance</h2>
              </div>

              <div className="space-y-4">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input 
                      type="text" 
                      placeholder="Chercher..." 
                      className="input pl-10 text-xs"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-neutral-400">Gravité</label>
                    <select 
                      className="input text-sm"
                      value={severityFilter}
                      onChange={e => setSeverityFilter(e.target.value as any)}
                    >
                       <option value="all">Tous les niveaux</option>
                       <option value={AlertSeverity.INFO}>INFO (Information)</option>
                       <option value={AlertSeverity.WARNING}>ATTENTION (Risque)</option>
                       <option value={AlertSeverity.CRITICAL}>CRITIQUE (Action requise)</option>
                    </select>
                 </div>
              </div>
           </div>

           <div className="card p-6 bg-red-600 text-white">
              <ShieldAlert className="w-8 h-8 mb-4 opacity-50" />
              <h3 className="text-sm font-black uppercase tracking-tight mb-2">Signalement Immédiat</h3>
              <p className="text-[11px] leading-relaxed opacity-80 italic">
                En cas de fraude confirmée, utilisez le bouton "Signalement Fraude" dans le détail de l'alerte pour figer les accès de l'agent.
              </p>
           </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
           {filteredAlerts?.map(alert => (
             <motion.div 
               key={alert.id}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className={cn(
                 "p-6 rounded-[2rem] border-2 transition-all hover:shadow-xl group",
                 alert.status === 'resolved' ? "bg-neutral-50/50 border-neutral-100 opacity-60" :
                 alert.severity === AlertSeverity.CRITICAL ? "bg-red-50/30 border-red-100" :
                 alert.severity === AlertSeverity.WARNING ? "bg-amber-50/30 border-amber-100" :
                 "bg-blue-50/30 border-blue-100"
               )}
             >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                   <div className="flex items-start gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-sm",
                        alert.severity === AlertSeverity.CRITICAL ? "bg-red-600 text-white" :
                        alert.severity === AlertSeverity.WARNING ? "bg-amber-500 text-white" :
                        "bg-blue-600 text-white"
                      )}>
                         {alert.severity === AlertSeverity.CRITICAL ? <ShieldX className="w-6 h-6" /> : 
                          alert.severity === AlertSeverity.WARNING ? <ShieldAlert className="w-6 h-6" /> : 
                          <Info className="w-6 h-6" />}
                      </div>
                      <div className="space-y-1">
                         <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.2em]",
                              alert.severity === AlertSeverity.CRITICAL ? "bg-red-100 text-red-600" :
                              alert.severity === AlertSeverity.WARNING ? "bg-amber-100 text-amber-600" :
                              "bg-blue-100 text-blue-600"
                            )}>{alert.severity}</span>
                            <span className="text-[10px] text-neutral-400 font-mono italic">{formatDate(alert.timestamp)}</span>
                         </div>
                         <h3 className="text-base font-black text-neutral-900 tracking-tight">{alert.title}</h3>
                         <p className="text-xs text-neutral-600 font-medium">{alert.description}</p>
                         <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-dashed border-neutral-200">
                            <div className="flex items-center gap-1.5">
                               <Calendar className="w-3 h-3 text-neutral-400" />
                               <span className="text-[10px] font-black uppercase text-neutral-400">{alert.agencyName}</span>
                            </div>
                            {alert.userName && (
                               <div className="flex items-center gap-1.5">
                                  <ShieldAlert className="w-3 h-3 text-neutral-400" />
                                  <span className="text-[10px] font-black uppercase text-neutral-400">Agent: {alert.userName}</span>
                               </div>
                            )}
                            <div className="flex items-center gap-1.5">
                               <ArrowRight className="w-3 h-3 text-neutral-400" />
                               <span className="text-[10px] font-black uppercase text-neutral-400">Type: {alert.type.replace('_', ' ')}</span>
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="flex items-center gap-2 self-end md:self-center">
                      {alert.status === 'active' ? (
                        <button 
                          onClick={() => handleResolve(alert.id!)}
                          className="btn btn-primary h-10 px-5 text-[10px] font-black uppercase tracking-widest gap-2 bg-green-600 hover:bg-green-700"
                        >
                           <CheckCircle2 className="w-4 h-4" /> Marquer Résolue
                        </button>
                      ) : (
                        <div className="flex flex-col items-end gap-1 px-4">
                           <span className="text-[9px] font-black uppercase tracking-widest text-green-600 italic">✓ Résolue</span>
                           <span className="text-[8px] text-neutral-400 italic">le {formatDate(alert.resolvedAt!)}</span>
                        </div>
                      )}
                      
                      <button className="p-2.5 rounded-xl bg-white border border-neutral-100 text-neutral-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
                         <Eye className="w-5 h-5" />
                      </button>
                      
                      <button 
                        onClick={() => handleDelete(alert.id!, alert.severity)}
                        className="p-2.5 rounded-xl bg-white border border-neutral-100 text-neutral-400 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                      >
                         <Trash2 className="w-5 h-5" />
                      </button>
                   </div>
                </div>
             </motion.div>
           ))}

           {(!filteredAlerts || filteredAlerts.length === 0) && (
             <div className="py-20 text-center space-y-6">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-xl">
                   <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <div className="max-w-xs mx-auto space-y-2">
                   <h3 className="font-serif italic font-black text-xl text-neutral-900">Tout est sous contrôle</h3>
                   <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-widest leading-relaxed">
                     Aucune anomalie détectée pour le moment. Votre écosystème financier est sécurisé.
                   </p>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
