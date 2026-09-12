import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { Currency } from '../types';
import { formatDate, formatCurrency, cn } from '../lib/utils';
import { useSearchParams } from 'react-router-dom';
import { 
  TrendingDown, 
  MessageSquare, 
  Calendar, 
  UserCircle, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Plus, 
  Filter,
  DollarSign,
  BarChart3,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';

export default function Debts() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filterAgencyId, setFilterAgencyId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const debts = useLiveQuery(() => db.debts.orderBy('createdAt').reverse().toArray());
  const agencies = useLiveQuery(() => db.agencies.toArray());

  useEffect(() => {
    const agencyIdParam = searchParams.get('agencyId');
    if (agencyIdParam) {
      setFilterAgencyId(agencyIdParam);
    }
  }, [searchParams]);

  const [formData, setFormData] = useState({
    debtorName: '',
    agencyId: user?.agencyId || 0,
    amount: '' as any,
    currency: Currency.USD,
    type: 'client' as 'client' | 'agent' | 'enterprise',
    dueDate: ''
  });

  const filteredDebts = debts?.filter(d => {
    const matchesSearch = d.debtorName.toLowerCase().includes(search.toLowerCase());
    const matchesAgency = filterAgencyId === 'all' || d.agencyId === Number(filterAgencyId);
    return matchesSearch && matchesAgency;
  });

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.debts.add({
      debtorName: formData.debtorName,
      agencyId: Number(formData.agencyId),
      userId: user?.id!,
      amount: Number(formData.amount),
      currency: formData.currency,
      type: formData.type,
      status: 'active',
      dueDate: new Date(formData.dueDate).getTime(),
      createdAt: Date.now()
    });

    await db.auditLogs.add({
      userId: user?.id!,
      action: 'CREATION_DETTE',
      details: `Dette créée pour ${formData.debtorName} de ${formData.amount} ${formData.currency}`,
      timestamp: Date.now()
    });

    setIsModalOpen(false);
    setFormData({ ...formData, debtorName: '', amount: '', dueDate: '' });
  };

  const handlePayDebt = async (debtId: number) => {
    const debt = await db.debts.get(debtId);
    if (!debt) return;
    
    // In a real app, this would involve a transaction record too
    await db.debts.update(debtId, { status: 'paid' });
    
    await db.auditLogs.add({
      userId: user?.id!,
      action: 'PAIEMENT_DETTE',
      details: `Dette de ${debt.debtorName} marquée comme payée`,
      timestamp: Date.now()
    });
  };

  const stats = useMemo(() => {
    if (!debts) return { totalUsd: 0, totalCdf: 0 };
    return debts.reduce((acc, d) => {
      if (d.status !== 'paid') {
        if (d.currency === Currency.USD) acc.totalUsd += d.amount;
        else acc.totalCdf += d.amount;
      }
      return acc;
    }, { totalUsd: 0, totalCdf: 0 });
  }, [debts]);

  const chartData = useMemo(() => {
    if (!debts) return [];
    
    const grouped = {
      Active: { USD: 0, CDF: 0 },
      Retard: { USD: 0, CDF: 0 },
      Soldée: { USD: 0, CDF: 0 },
    };

    debts.forEach(d => {
      let status: keyof typeof grouped = 'Active';
      if (d.status === 'paid') status = 'Soldée';
      else if (Date.now() > d.dueDate) status = 'Retard';

      if (d.currency === Currency.USD) grouped[status].USD += d.amount;
      else grouped[status].CDF += d.amount;
    });

    return [
      { name: 'Active', USD: grouped.Active.USD, CDF: grouped.Active.CDF },
      { name: 'Retard', USD: grouped.Retard.USD, CDF: grouped.Retard.CDF },
      { name: 'Soldée', USD: grouped.Soldée.USD, CDF: grouped.Soldée.CDF },
    ];
  }, [debts]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 font-serif italic">Suivi des Dettes</h1>
          <p className="text-neutral-500 italic">Gestion des créances clients, agents et interne.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary h-11 md:h-12 px-6 shadow-lg shadow-blue-600/20 text-xs md:text-sm">
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          Enregistrer une Créance
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6 bg-neutral-900 text-white relative overflow-hidden group">
           <TrendingDown className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 -rotate-12 group-hover:rotate-0 transition-transform duration-700" />
           <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Total USD à Recouvrer</p>
           <p className="text-4xl font-black font-mono tracking-tighter text-blue-400">{formatCurrency(stats.totalUsd, 'USD')}</p>
           <div className="mt-4 flex items-center gap-2 text-[10px] text-neutral-500">
              <AlertCircle className="w-3 h-3 text-red-500" />
              <span>Sur {debts?.filter(d => d.status !== 'paid' && d.currency === 'USD').length} créance(s) active(s)</span>
           </div>
        </div>
        <div className="card p-6 bg-white relative overflow-hidden group">
           <TrendingDown className="absolute -right-4 -bottom-4 w-32 h-32 opacity-5 -rotate-12 group-hover:rotate-0 transition-transform duration-700" />
           <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Total CDF à Recouvrer</p>
           <p className="text-4xl font-black font-mono tracking-tighter text-neutral-900">{formatCurrency(stats.totalCdf, 'CDF')}</p>
           <div className="mt-4 flex items-center gap-2 text-[10px] text-neutral-400">
              <AlertCircle className="w-3 h-3 text-red-500" />
              <span>Sur {debts?.filter(d => d.status !== 'paid' && d.currency === 'CDF').length} créance(s) active(s)</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="card p-6">
            <div className="flex items-center gap-2 mb-6">
               <BarChart3 className="w-4 h-4 text-blue-500" />
               <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-800">Répartition par Statut (USD)</h3>
            </div>
            <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#a3a3a3' }} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 500, fill: '#a3a3a3' }} />
                     <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: 'transparent' }}
                     />
                     <Bar dataKey="USD" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.name === 'Retard' ? '#ef4444' : entry.name === 'Soldée' ? '#22c55e' : '#3b82f6'} />
                        ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="card p-6">
            <div className="flex items-center gap-2 mb-6">
               <BarChart3 className="w-4 h-4 text-neutral-600" />
               <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-800">Répartition par Statut (CDF)</h3>
            </div>
            <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#a3a3a3' }} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 500, fill: '#a3a3a3' }} />
                     <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: 'transparent' }}
                     />
                     <Bar dataKey="CDF" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.name === 'Retard' ? '#ef4444' : entry.name === 'Soldée' ? '#22c55e' : '#171717'} />
                        ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
           <div className="flex flex-wrap items-center gap-4">
              <div className="relative w-64">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                 <input 
                   type="text" 
                   placeholder="Ex: Jean Paul..." 
                   className="input pl-10 text-sm h-10"
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                 />
              </div>
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
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-neutral-50 text-[10px] uppercase font-bold text-neutral-400 border-b border-neutral-100">
                <th className="px-6 py-3">Débiteur</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Montant</th>
                <th className="px-6 py-3">Échéance</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
               {filteredDebts?.map(debt => (
                  <tr key={debt.id} className="text-sm hover:bg-neutral-50/50 transition-colors group">
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center border border-neutral-200">
                             <UserCircle className="w-5 h-5 text-neutral-400" />
                          </div>
                          <div className="flex flex-col">
                             <span className="font-bold text-neutral-800">{debt.debtorName}</span>
                             <span className="text-[10px] text-neutral-400 italic">Enregistré le {formatDate(debt.createdAt)}</span>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-4 capitalize font-medium text-neutral-600">
                      {debt.type}
                    </td>
                    <td className="px-6 py-4 font-mono font-black text-neutral-900">
                      {formatCurrency(debt.amount, debt.currency)}
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2 text-xs">
                          <Calendar className={cn("w-3 h-3", Date.now() > debt.dueDate && debt.status !== 'paid' ? "text-red-500" : "text-neutral-400")} />
                          <span className={cn(Date.now() > debt.dueDate && debt.status !== 'paid' ? "text-red-600 font-bold" : "text-neutral-500")}>
                            {formatDate(debt.dueDate)}
                          </span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className={cn(
                         "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border",
                         debt.status === 'paid' ? "bg-green-100 text-green-700 border-green-200" : 
                         Date.now() > debt.dueDate ? "bg-red-100 text-red-700 border-red-200 animate-pulse" : "bg-yellow-100 text-yellow-700 border-yellow-200"
                       )}>
                         {debt.status === 'paid' ? 'Soldée' : Date.now() > debt.dueDate ? 'Retard' : 'Active'}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       {debt.status !== 'paid' && (
                         <div className="flex items-center justify-end gap-2">
                           <button 
                             onClick={() => {
                               if (window.confirm(`Confirmez-vous le paiement de ${formatCurrency(debt.amount, debt.currency)} par ${debt.debtorName} ?`)) {
                                 handlePayDebt(debt.id!);
                               }
                             }}
                             className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-md shadow-green-500/10 text-[10px] font-black uppercase tracking-widest"
                             title="Marquer comme payé"
                           >
                             <CheckCircle2 className="w-3.5 h-3.5" />
                             <span className="hidden sm:inline">Marquer comme payé</span>
                             <span className="sm:hidden">Payer</span>
                           </button>
                           <button className="p-2 bg-white border border-neutral-200 rounded-lg text-neutral-400 hover:text-blue-600 transition-all shadow-sm">
                             <MessageSquare className="w-4 h-4" />
                           </button>
                         </div>
                       )}
                    </td>
                  </tr>
               ))}
               {(!filteredDebts || filteredDebts.length === 0) && (
                 <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-neutral-400 italic">Aucune créance enregistrée.</td>
                 </tr>
               )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
               <div className="p-6 bg-neutral-900 text-white text-center">
                  <h2 className="text-xl font-bold font-serif italic">Enregistrer une Créance</h2>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">Suivi des dettes & paiements</p>
               </div>
               
               <form onSubmit={handleAddDebt} className="p-8 space-y-6">
                  <div className="space-y-1">
                     <label className="text-xs font-bold text-neutral-400 uppercase">Nom du Débiteur</label>
                     <input type="text" className="input" placeholder="Ex: Jean Mukendi" required value={formData.debtorName} onChange={e => setFormData({...formData, debtorName: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-400 uppercase">Montant</label>
                        <div className="relative">
                           <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                           <input type="number" className="input pl-10 font-mono font-bold" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-400 uppercase">Devise</label>
                        <select className="input font-bold" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as Currency})}>
                           <option value={Currency.USD}>USD</option>
                           <option value={Currency.CDF}>CDF</option>
                        </select>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-400 uppercase">Type de Dette</label>
                        <select className="input" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                           <option value="client">Client Externe</option>
                           <option value="agent">Agent Interne</option>
                           <option value="enterprise">Dette Entreprise</option>
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-400 uppercase">Date d'Échéance</label>
                        <input type="date" className="input font-mono" required value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
                     </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                     <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary flex-1 h-12 uppercase tracking-widest text-xs font-black">Annuler</button>
                     <button type="submit" className="btn btn-primary flex-1 h-12 shadow-lg shadow-blue-600/20 uppercase tracking-[0.2em] text-xs font-black">Enregistrer</button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
