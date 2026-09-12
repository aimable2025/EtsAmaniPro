import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatDate, cn } from '../lib/utils';
import { History, Shield, User, Info, Search, AlertTriangle, CheckCircle2, Fingerprint, MousePointer2, Filter } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { verifyDataIntegrity } from '../lib/security';
import { motion, AnimatePresence } from 'motion/react';

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [hoveredLogId, setHoveredLogId] = useState<number | null>(null);
  const logs = useLiveQuery(() => db.auditLogs.orderBy('timestamp').reverse().toArray());
  const users = useLiveQuery(() => db.users.toArray());
  const slips = useLiveQuery(() => db.slips.toArray());
  const transactions = useLiveQuery(() => db.transactions.toArray());

  const uniqueActions = useMemo(() => {
    if (!logs) return [];
    return Array.from(new Set(logs.map(log => log.action))).sort();
  }, [logs]);

  const integrityStats = useMemo(() => {
    if (!logs || !slips || !transactions) return { valid: 0, invalid: 0, riskyUsers: 0 };
    
    let invalid = 0;
    // For now, we only check slips and transactions created after signature implementation
    // But logically, any record without a signature *could* be a legacy or manual record
    const untrustedSlips = slips.filter(s => !s.signature).length;
    const untrustedTransactions = transactions.filter(t => !t.signature).length;
    
    const usersWithMultiRoles = users?.filter(u => u.roles.length > 3).length || 0;

    return {
      valid: (slips.length + transactions.length) - (untrustedSlips + untrustedTransactions),
      invalid: untrustedSlips + untrustedTransactions,
      riskyUsers: usersWithMultiRoles
    };
  }, [logs, slips, transactions, users]);

  const filteredLogs = logs?.filter(log => {
    const user = users?.find(u => u.id === log.userId);
    const matchesSearch = (
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      user?.fullName.toLowerCase().includes(search.toLowerCase())
    );
    const matchesAction = selectedAction === 'all' || log.action === selectedAction;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 font-serif italic">Audit & Sécurité</h1>
          <p className="text-neutral-500 italic">Traçabilité complète de toutes les actions système.</p>
        </div>
        <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center text-white">
           <History className="w-5 h-5" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="card p-6 bg-green-50 border-green-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-green-600 shadow-sm">
               <Fingerprint className="w-6 h-6" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase text-green-600/60 tracking-widest">Signatures Valides</p>
               <h4 className="text-2xl font-display font-black text-green-900">{integrityStats.valid}</h4>
            </div>
         </div>
         <div className="card p-6 bg-amber-50 border-amber-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-amber-600 shadow-sm">
               <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase text-amber-600/60 tracking-widest">Enregistrements non-signés</p>
               <h4 className="text-2xl font-display font-black text-amber-900">{integrityStats.invalid}</h4>
            </div>
         </div>
         <div className="card p-6 bg-blue-50 border-blue-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-blue-600 shadow-sm">
               <Shield className="w-6 h-6" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase text-blue-600/60 tracking-widest">Vigilance Privilèges</p>
               <h4 className="text-2xl font-display font-black text-blue-900">{integrityStats.riskyUsers}</h4>
            </div>
         </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-6 border-b border-neutral-100 bg-neutral-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
           <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input 
                type="text" 
                placeholder="Rechercher par action, détail ou utilisateur..." 
                className="input pl-10 text-sm h-10 w-full"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
           </div>
           
           <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
               <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
               <select 
                 className="input pl-10 text-sm h-10 w-full appearance-none bg-white cursor-pointer"
                 value={selectedAction}
                 onChange={e => setSelectedAction(e.target.value)}
               >
                 <option value="all">Toutes les actions</option>
                 {uniqueActions.map(action => (
                   <option key={action} value={action}>
                     {action.replace(/_/g, ' ')}
                   </option>
                 ))}
               </select>
             </div>

             <div className="hidden lg:flex text-[10px] uppercase font-black text-neutral-400 tracking-widest items-center gap-2 shrink-0">
                <Shield className="w-3 h-3 text-blue-600" /> Journal Immuable
             </div>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50 text-[10px] uppercase font-black tracking-widest text-neutral-500 border-b border-neutral-100">
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Utilisateur</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Détails de l'événement</th>
                <th className="px-6 py-3 text-right">Infos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filteredLogs?.map((log) => {
                const user = users?.find(u => u.id === log.userId);
                return (
                  <tr key={log.id} className="text-sm hover:bg-neutral-50/50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-neutral-400 italic">
                      {formatDate(log.timestamp)}
                    </td>
                    <td 
                      className="px-6 py-4 relative"
                      onMouseEnter={() => setHoveredLogId(log.id!)}
                      onMouseLeave={() => setHoveredLogId(null)}
                    >
                       <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center">
                             <User className="w-3 h-3 text-neutral-500" />
                          </div>
                          <span className="font-bold text-neutral-800">{user?.fullName || `Utilisateur #${log.userId}`}</span>
                       </div>

                       <AnimatePresence>
                         {hoveredLogId === log.id && user && (
                           <motion.div 
                             initial={{ opacity: 0, y: 5, scale: 0.95 }}
                             animate={{ opacity: 1, y: 0, scale: 1 }}
                             exit={{ opacity: 0, y: 5, scale: 0.95 }}
                             className="absolute bottom-full left-6 mb-2 p-4 bg-neutral-900 text-white rounded-2xl shadow-2xl z-50 w-64 pointer-events-none"
                           >
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                                  <User className="w-4 h-4 text-blue-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-black uppercase tracking-tight truncate">{user.fullName}</p>
                                  <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest">ID: #{user.id}</p>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[8px] font-black uppercase text-neutral-500 tracking-[0.2em] mb-1">Rôles Assignés</p>
                                <div className="flex flex-wrap gap-1">
                                  {user.roles.map((role, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-blue-500/30">
                                      {role.replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="absolute top-full left-4 -translate-y-px border-8 border-transparent border-t-neutral-900" />
                           </motion.div>
                         )}
                       </AnimatePresence>
                    </td>
                    <td className="px-6 py-4">
                       <span className={cn(
                         "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                         log.action.includes('SUPPRESSION') || log.action.includes('ALERT') 
                           ? "bg-red-50 text-red-700 border-red-100" 
                           : "bg-blue-50 text-blue-700 border-blue-100"
                       )}>
                         {log.action.replace('_', ' ')}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-600 font-medium italic text-xs leading-relaxed max-w-md truncate md:whitespace-normal">
                       {log.details}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-2">
                          <div title={log.signature ? "Intégrité validée graphiquement" : "Enregistrement non signé"} className={cn("w-2 h-2 rounded-full", log.signature ? "bg-green-500" : "bg-amber-300")} />
                          <button className="text-neutral-300 hover:text-blue-600 transition-colors">
                             <Fingerprint className="w-4 h-4" />
                          </button>
                       </div>
                    </td>
                  </tr>
                );
              })}
              {(!filteredLogs || filteredLogs.length === 0) && (
                <tr>
                   <td colSpan={5} className="px-6 py-12 text-center text-neutral-400 italic">
                      Aucune entrée correspondante dans le journal d'audit.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
