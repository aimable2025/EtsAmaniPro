import React, { useMemo, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Search,
  Filter,
  Plus,
  Building2
} from 'lucide-react';
import { subDays, isAfter } from 'date-fns';
import { TransactionType, ReportStatus, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';

export default function Reports() {
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const isSupervisor = currentUser?.roles.includes(UserRole.SUPERVISEUR) || currentUser?.roles.includes(UserRole.ADMIN_PRINCIPAL);

  const transactions = useLiveQuery(() => db.transactions.toArray());
  const agencies = useLiveQuery(() => db.agencies.toArray());
  const allReports = useLiveQuery(() => db.reports.toArray());
  const allUsers = useLiveQuery(() => db.users.toArray());

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAgencyId, setFilterAgencyId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newReportDetails, setNewReportDetails] = useState('');

  // Custom Report State
  const [showCustomReport, setShowCustomReport] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 7).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [customAgencyFilter, setCustomAgencyFilter] = useState('all');

  const customAnalytics = useMemo(() => {
    if (!transactions) return null;
    
    const filtered = transactions.filter(tx => {
      const date = new Date(tx.timestamp).toISOString().split('T')[0];
      const matchesDate = date >= dateRange.start && date <= dateRange.end;
      const matchesAgency = customAgencyFilter === 'all' || tx.agencyId === Number(customAgencyFilter);
      return matchesDate && matchesAgency;
    });

    return filtered.reduce((acc, tx) => {
      const key = `${tx.type}_${tx.currency}`;
      acc.volumes[key] = (acc.volumes[key] || 0) + tx.amount;
      acc.commissions[tx.currency] = (acc.commissions[tx.currency] || 0) + (tx.commissionAmount || 0);
      acc.txCount++;
      return acc;
    }, { 
      volumes: {} as Record<string, number>, 
      commissions: { USD: 0, CDF: 0 },
      txCount: 0 
    });
  }, [transactions, dateRange, customAgencyFilter]);

  useEffect(() => {
    const agencyIdParam = searchParams.get('agencyId');
    if (agencyIdParam) {
      setFilterAgencyId(agencyIdParam);
    }
  }, [searchParams]);

  const filteredReports = useMemo(() => {
    if (!allReports) return [];
    return allReports.filter(r => {
      const u = allUsers?.find(user => user.id === r.userId);
      const matchesSearch = u?.fullName.toLowerCase().includes(search.toLowerCase()) || r.details.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
      const matchesAgency = filterAgencyId === 'all' || r.agencyId === Number(filterAgencyId);
      return matchesSearch && matchesStatus && matchesAgency;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [allReports, allUsers, search, filterStatus, filterAgencyId]);

  const handleCreateReport = async () => {
    if (!currentUser || !newReportDetails) return;
    
    await db.reports.add({
      agencyId: currentUser.agencyId || 0,
      userId: currentUser.id!,
      date: new Date().toISOString().split('T')[0],
      status: ReportStatus.PENDING,
      details: newReportDetails,
      timestamp: Date.now()
    });

    setIsModalOpen(false);
    setNewReportDetails('');
  };

  const updateReportStatus = async (id: number, status: ReportStatus) => {
    if (!isSupervisor) return;
    await db.reports.update(id, { status });
  };

  const summary = useMemo(() => {
    if (!transactions) return { usd: 0, cdf: 0, count: 0 };
    return transactions.reduce((acc, tx) => {
      if (tx.type === TransactionType.DEPOT) {
         if (tx.currency === 'USD') acc.usd += tx.amount;
         else if (tx.currency === 'CDF') acc.cdf += tx.amount;
      } else if (tx.type === TransactionType.RETRAIT) {
         if (tx.currency === 'USD') acc.usd -= tx.amount;
         else if (tx.currency === 'CDF') acc.cdf -= tx.amount;
      }
      acc.count++;
      return acc;
    }, { usd: 0, cdf: 0, count: 0 });
  }, [transactions]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 font-serif italic">Rapports Journaliers</h1>
          <p className="text-neutral-500 italic">Centralisation et validation des rapports de caisse.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setShowCustomReport(!showCustomReport)}
            className={cn(
              "btn h-11 md:h-12 shadow-sm font-bold text-xs md:text-sm",
              showCustomReport ? "bg-neutral-900 text-white" : "btn-secondary"
            )}
          >
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 mr-2" /> 
            <span className="hidden xs:inline">{showCustomReport ? 'Masquer Analyses' : 'Générateur d\'Analyses'}</span>
            <span className="xs:hidden">{showCustomReport ? 'Masquer' : 'Analyses'}</span>
          </button>
          {!isSupervisor && (
             <button 
               onClick={() => setIsModalOpen(true)}
               className="btn btn-primary h-11 md:h-12 shadow-sm font-bold text-xs md:text-sm"
             >
               <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2" /> 
               <span className="hidden xs:inline">Nouveau Rapport</span>
               <span className="xs:hidden">Nouveau</span>
             </button>
          )}
          <button className="btn btn-secondary h-11 md:h-12 shadow-sm uppercase tracking-widest text-[10px] font-black">
             <Download className="w-4 h-4 md:w-5 md:h-5 mr-2" /> 
             <span className="hidden sm:inline">Exporter (.CSV)</span>
             <span className="sm:hidden">CSV</span>
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {showCustomReport && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="card p-8 bg-blue-600 text-white shadow-xl shadow-blue-200 mb-8 space-y-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl" />
               
               <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
                  <div className="space-y-4 flex-1">
                     <h3 className="text-xl font-bold font-serif italic">Générateur d'Analyses Financières</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase tracking-widest text-blue-100">Date de Début</label>
                           <input 
                              type="date" 
                              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:bg-white/20"
                              value={dateRange.start}
                              onChange={e => setDateRange({...dateRange, start: e.target.value})}
                           />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase tracking-widest text-blue-100">Date de Fin</label>
                           <input 
                              type="date" 
                              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:bg-white/20"
                              value={dateRange.end}
                              onChange={e => setDateRange({...dateRange, end: e.target.value})}
                           />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase tracking-widest text-blue-100">Agence</label>
                           <select 
                              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:bg-white/20 appearance-none"
                              value={customAgencyFilter}
                              onChange={e => setCustomAgencyFilter(e.target.value)}
                           >
                              <option value="all" className="text-neutral-900">Toutes les Agences</option>
                              {agencies?.map(a => (
                                <option key={a.id} value={a.id} className="text-neutral-900">{a.name}</option>
                              ))}
                           </select>
                        </div>
                     </div>
                  </div>
                  <button className="btn bg-white text-blue-600 hover:bg-blue-50 h-10 px-6 font-black uppercase tracking-widest text-[10px] shrink-0">
                     <Download className="w-4 h-4 mr-2" /> Télécharger Rapport
                  </button>
               </div>

               {customAnalytics && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-white/10 relative z-10">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Volume Dépôts (USD)</p>
                          <p className="text-2xl font-black font-mono">{formatCurrency(customAnalytics.volumes['DEPOT_USD'] || 0, 'USD')}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Volume Retraits (USD)</p>
                          <p className="text-2xl font-black font-mono text-blue-200">{formatCurrency(customAnalytics.volumes['RETRAIT_USD'] || 0, 'USD')}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Commissions (USD)</p>
                          <p className="text-2xl font-black font-mono text-green-300">+{formatCurrency(customAnalytics.commissions.USD, 'USD')}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Commissions (CDF)</p>
                          <p className="text-2xl font-black font-mono text-green-300">+{formatCurrency(customAnalytics.commissions.CDF, 'CDF')}</p>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/5 relative z-10">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100/60">Volume Dépôts (CDF)</p>
                          <p className="text-xl font-bold font-mono">{formatCurrency(customAnalytics.volumes['DEPOT_CDF'] || 0, 'CDF')}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100/60">Volume Retraits (CDF)</p>
                          <p className="text-xl font-bold font-mono opacity-80">{formatCurrency(customAnalytics.volumes['RETRAIT_CDF'] || 0, 'CDF')}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100/60">Nombre Transactions</p>
                          <p className="text-xl font-bold font-mono">{customAnalytics.txCount}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100/60">Période</p>
                          <p className="text-[10px] font-bold uppercase tracking-tight">{dateRange.start} au {dateRange.end}</p>
                       </div>
                    </div>
                  </>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Overview for Reports */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
         <StatsCard 
           title="Rapports Reçus" 
           value={allReports?.length || 0} 
           icon={FileText} 
           color="blue" 
         />
         <StatsCard 
           title="En Attente" 
           value={allReports?.filter(r => r.status === ReportStatus.PENDING).length || 0} 
           icon={Clock} 
           color="amber" 
         />
         <StatsCard 
           title="Validés" 
           value={allReports?.filter(r => r.status === ReportStatus.VALIDATED).length || 0} 
           icon={CheckCircle2} 
           color="green" 
         />
         <StatsCard 
           title="Rejetés" 
           value={allReports?.filter(r => r.status === ReportStatus.REJECTED).length || 0} 
           icon={XCircle} 
           color="red" 
         />
      </div>

      {/* Reports Management Table */}
      <div className="card overflow-hidden">
         <div className="p-6 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
               <input 
                 type="text" 
                 placeholder="Rechercher un rapport..." 
                 className="input pl-10" 
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
               />
            </div>
            <div className="flex flex-wrap items-center gap-4">
               <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-neutral-400" />
                  <select 
                    className="input h-10 py-0 text-sm"
                    value={filterAgencyId}
                    onChange={(e) => setFilterAgencyId(e.target.value)}
                  >
                     <option value="all">Toutes les Agences</option>
                     {agencies?.map(a => (
                       <option key={a.id} value={a.id}>{a.name}</option>
                     ))}
                  </select>
               </div>
               <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-neutral-400" />
                  <select 
                    className="input h-10 py-0 text-sm"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                     <option value="all">Tous les Statuts</option>
                     <option value={ReportStatus.PENDING}>En Attente</option>
                     <option value={ReportStatus.VALIDATED}>Validés</option>
                     <option value={ReportStatus.REJECTED}>Rejetés</option>
                  </select>
               </div>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-neutral-50 text-[10px] uppercase font-black text-neutral-400 tracking-widest border-b border-neutral-100 pb-3">
                     <th className="px-6 py-4">Agent & Agence</th>
                     <th className="px-6 py-4">Date & Heure</th>
                     <th className="px-6 py-4">Détails/Observations</th>
                     <th className="px-6 py-4">Statut</th>
                     <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-neutral-50">
                  {filteredReports.map((report) => {
                     const agent = allUsers?.find(u => u.id === report.userId);
                     const agency = agencies?.find(a => a.id === report.agencyId);
                     return (
                        <tr key={report.id} className="hover:bg-neutral-50/50 transition-colors group">
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center font-bold text-neutral-500 text-xs">
                                    {agent?.fullName.substring(0, 1)}
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="font-bold text-neutral-800 text-sm">{agent?.fullName}</span>
                                    <span className="text-[10px] text-neutral-400 uppercase font-black">{agency?.name}</span>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex flex-col">
                                 <span className="text-sm font-medium text-neutral-600">{report.date}</span>
                                 <span className="text-[10px] text-neutral-400 font-mono">{new Date(report.timestamp).toLocaleTimeString()}</span>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <p className="text-xs text-neutral-500 italic truncate max-w-xs">{report.details}</p>
                           </td>
                           <td className="px-6 py-4">
                              <span className={cn(
                                 "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                                 report.status === ReportStatus.PENDING ? "bg-amber-100 text-amber-700" :
                                 report.status === ReportStatus.VALIDATED ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                              )}>
                                 {report.status.replace('_', ' ')}
                              </span>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                 {isSupervisor && report.status === ReportStatus.PENDING && (
                                    <>
                                       <button 
                                          onClick={() => updateReportStatus(report.id!, ReportStatus.VALIDATED)}
                                          className="p-2 hover:bg-green-50 text-green-600 rounded-lg transition-all"
                                          title="Valider"
                                       >
                                          <CheckCircle2 className="w-4 h-4" />
                                       </button>
                                       <button 
                                          onClick={() => updateReportStatus(report.id!, ReportStatus.REJECTED)}
                                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all"
                                          title="Rejeter"
                                       >
                                          <XCircle className="w-4 h-4" />
                                       </button>
                                    </>
                                 )}
                                 <button className="p-2 hover:bg-neutral-100 text-neutral-600 rounded-lg transition-all">
                                    <Eye className="w-4 h-4" />
                                 </button>
                              </div>
                           </td>
                        </tr>
                     );
                  })}
                  {filteredReports.length === 0 && (
                     <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-neutral-400 italic text-sm">
                           Aucun rapport trouvé.
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* New Report Modal */}
      <AnimatePresence>
         {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />
               <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                     <h2 className="text-2xl font-bold font-serif italic">Nouveau Rapport Journalier</h2>
                     <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 transition-colors">
                        <XCircle className="w-6 h-6" />
                     </button>
                  </div>
                  
                  <div className="space-y-4">
                     <div>
                        <label className="text-xs font-black uppercase text-neutral-400 mb-2 block">Détails et Observations</label>
                        <textarea 
                           className="input min-h-[150px] pt-3" 
                           placeholder="Résumez votre journée de caisse, mentionnez tout écart ou événement particulier..."
                           value={newReportDetails}
                           onChange={(e) => setNewReportDetails(e.target.value)}
                        />
                     </div>
                     
                     <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
                        <Clock className="w-4 h-4 text-amber-600 mt-0.5" />
                        <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
                           Le rapport sera automatiquement daté d'aujourd'hui ({new Date().toLocaleDateString()}) et envoyé pour validation au superviseur.
                        </p>
                     </div>

                     <button 
                        onClick={handleCreateReport}
                        className="btn btn-primary w-full py-4 font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20"
                     >
                        Envoyer le Rapport Focus
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, color }: any) {
   const colors = {
      blue: 'bg-blue-50 text-blue-600 border-blue-100',
      amber: 'bg-amber-50 text-amber-600 border-amber-100',
      green: 'bg-green-50 text-green-600 border-green-100',
      red: 'bg-red-50 text-red-600 border-red-100',
   };

   return (
      <div className={cn("card p-6 border-b-4", colors[color as keyof typeof colors])}>
         <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{title}</span>
            <Icon className="w-5 h-5" />
         </div>
         <p className="text-3xl font-black font-mono">{value}</p>
      </div>
   );
}


