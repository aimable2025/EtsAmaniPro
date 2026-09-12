import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { Building2, Plus, Info, Landmark, Smartphone, Wallet, History, ArrowUpRight, AlertTriangle, BarChart3, ChevronDown, ChevronUp, ArrowRightLeft, FileText, Receipt, UserMinus, Calendar, Filter, X, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { TransactionType } from '../types';

export default function Agencies() {
  const { user } = useAuth();
  const agencies = useLiveQuery(() => db.agencies.toArray());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<any>(null);
  const [sourceAgencyForTransfer, setSourceAgencyForTransfer] = useState<any>(null);
  const [expandedAgencyId, setExpandedAgencyId] = useState<number | null>(null);
  const [selectedAgencyIdForHistory, setSelectedAgencyIdForHistory] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const agencyHistoryTransactions = useLiveQuery(async () => {
    if (!selectedAgencyIdForHistory) return [];
    
    let results = await db.transactions
      .where('agencyId')
      .equals(selectedAgencyIdForHistory)
      .reverse()
      .sortBy('timestamp');

    if (startDate) {
      const start = new Date(startDate).getTime();
      results = results.filter(t => t.timestamp >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      results = results.filter(t => t.timestamp <= end.getTime());
    }
    
    return results;
  }, [selectedAgencyIdForHistory, startDate, endDate]);

  const [transferData, setTransferData] = useState({
    destinationAgencyId: '',
    sourceType: 'USD',
    destType: 'USD',
    amount: 0,
    currency: 'USD'
  });

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    initialUSD: 0,
    initialCDF: 0,
    initialVIRTUEL: 0,
    initialBANQUE: 0,
    initialMM: 0,
    exchangeRateUSD_CDF: 2850,
    defaultCommissionRate: 2.5
  });

  const [editData, setEditData] = useState({
    USD: 0,
    CDF: 0,
    VIRTUEL: 0,
    BANQUE: 0,
    MOBILE_MONEY: 0,
    exchangeRateUSD_CDF: 0,
    defaultCommissionRate: 0
  });

  const isSuperManager = user?.roles.includes('superviseur' as any) || user?.roles.includes('admin_principal' as any);

  const handleAddAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.agencies.add({
      name: formData.name,
      location: formData.location,
      initialBalances: {
        USD: Number(formData.initialUSD),
        CDF: Number(formData.initialCDF),
        VIRTUEL: Number(formData.initialVIRTUEL),
        BANQUE: Number(formData.initialBANQUE),
        MOBILE_MONEY: Number(formData.initialMM)
      },
      currentBalances: {
        USD: Number(formData.initialUSD),
        CDF: Number(formData.initialCDF),
        VIRTUEL: Number(formData.initialVIRTUEL),
        BANQUE: Number(formData.initialBANQUE),
        MOBILE_MONEY: Number(formData.initialMM)
      },
      exchangeRateUSD_CDF: Number(formData.exchangeRateUSD_CDF),
      defaultCommissionRate: Number(formData.defaultCommissionRate),
      createdAt: Date.now()
    });
    
    await db.auditLogs.add({
      userId: user?.id!,
      action: 'CREATION_AGENCE',
      details: `Création de l'agence ${formData.name}`,
      timestamp: Date.now()
    });

    setIsModalOpen(false);
    setFormData({
      name: '',
      location: '',
      initialUSD: 0,
      initialCDF: 0,
      initialVIRTUEL: 0,
      initialBANQUE: 0,
      initialMM: 0,
      exchangeRateUSD_CDF: 2850,
      defaultCommissionRate: 2.5
    });
  };

  const handleEditBalances = (agency: any) => {
    setSelectedAgency(agency);
    setEditData({
      USD: agency.currentBalances.USD,
      CDF: agency.currentBalances.CDF,
      VIRTUEL: agency.currentBalances.VIRTUEL,
      BANQUE: agency.currentBalances.BANQUE,
      MOBILE_MONEY: agency.currentBalances.MOBILE_MONEY,
      exchangeRateUSD_CDF: agency.exchangeRateUSD_CDF,
      defaultCommissionRate: agency.defaultCommissionRate || 0
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateBalances = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgency) return;

    await db.agencies.update(selectedAgency.id, {
      currentBalances: {
        USD: Number(editData.USD),
        CDF: Number(editData.CDF),
        VIRTUEL: Number(editData.VIRTUEL),
        BANQUE: Number(editData.BANQUE),
        MOBILE_MONEY: Number(editData.MOBILE_MONEY)
      },
      exchangeRateUSD_CDF: Number(editData.exchangeRateUSD_CDF),
      defaultCommissionRate: Number(editData.defaultCommissionRate)
    });

    await db.auditLogs.add({
      userId: user?.id!,
      action: 'MISE_A_JOUR_TRESORERIE',
      details: `Mise à jour manuelle de la trésorerie pour l'agence ${selectedAgency.name}`,
      timestamp: Date.now()
    });

    setIsEditModalOpen(false);
    setSelectedAgency(null);
  };

  const handleTransferClick = (agency: any) => {
    setSourceAgencyForTransfer(agency);
    setTransferData({
      destinationAgencyId: agency.id, // Default to self for internal transfer
      sourceType: 'USD',
      destType: 'USD',
      amount: 0,
      currency: 'USD'
    });
    setIsTransferModalOpen(true);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceAgencyForTransfer || !transferData.destinationAgencyId) return;

    const amount = Number(transferData.amount);
    const currency = transferData.currency;
    const sourceAgency = sourceAgencyForTransfer;
    const destAgency = agencies?.find(a => String(a.id) === transferData.destinationAgencyId);

    if (!destAgency) return;

    // Validation: Enough funds?
    const sourceCurrentVal = sourceAgency.currentBalances[transferData.sourceType as keyof typeof sourceAgency.currentBalances];
    if (sourceCurrentVal < amount) {
      setMessage({ type: 'error', text: "Fonds insuffisants dans la source sélectionnée." });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    // Update source agency
    const updatedSourceBalances = { ...sourceAgency.currentBalances };
    (updatedSourceBalances as any)[transferData.sourceType] -= amount;
    await db.agencies.update(sourceAgency.id, { currentBalances: updatedSourceBalances });

    // Update destination agency
    const updatedDestBalances = { ...destAgency.currentBalances };
    (updatedDestBalances as any)[transferData.destType] += amount;
    await db.agencies.update(destAgency.id, { currentBalances: updatedDestBalances });

    // Transaction records
    await db.transactions.add({
      agencyId: sourceAgency.id,
      userId: user?.id!,
      type: TransactionType.RETRAIT,
      amount: amount,
      currency: currency as any,
      description: `Transfert VERS ${destAgency.name} (${transferData.destType})`,
      timestamp: Date.now(),
      status: 'completed'
    });

    await db.transactions.add({
      agencyId: destAgency.id,
      userId: user?.id!,
      type: TransactionType.DEPOT,
      amount: amount,
      currency: currency as any,
      description: `Transfert DEPUIS ${sourceAgency.name} (${transferData.sourceType})`,
      timestamp: Date.now(),
      status: 'completed'
    });

    await db.auditLogs.add({
      userId: user?.id!,
      action: 'TRANSFERT_FONDS',
      details: `Transfert de ${amount} ${currency} de ${sourceAgency.name} (${transferData.sourceType}) vers ${destAgency.name} (${transferData.destType})`,
      timestamp: Date.now()
    });

    setMessage({ 
      type: 'success', 
      text: `Transfert réussi ! ${amount} ${currency} transférés de ${sourceAgency.name} vers ${destAgency.name}.` 
    });
    setTimeout(() => setMessage(null), 5000);

    setIsTransferModalOpen(false);
    setSourceAgencyForTransfer(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 font-serif italic">Gestion des Agences</h1>
          <p className="text-neutral-500">Configuration du réseau et capitaux initiaux.</p>
        </div>
        {isSuperManager && (
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary h-11 md:h-12 px-6">
            <Plus className="w-5 h-5" />
            Nouvelle Agence
          </button>
        )}
      </div>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "p-4 rounded-xl border flex items-center justify-between shadow-sm",
              message.type === 'success' ? "bg-green-50 border-green-100 text-green-800" : "bg-red-50 border-red-100 text-red-800"
            )}
          >
            <div className="flex items-center gap-3">
               {message.type === 'success' ? <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
               <p className="text-sm font-medium">{message.text}</p>
            </div>
            <button onClick={() => setMessage(null)} className="text-xs uppercase font-black opacity-50 hover:opacity-100">Fermer</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {agencies?.map((agency) => (
          <div key={agency.id} className="card group hover:border-blue-500/50 transition-all">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white border border-neutral-200 rounded-xl flex items-center justify-center shadow-sm">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                       <h3 className="font-bold text-lg">{agency.name}</h3>
                       <div className="flex items-center gap-1.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link 
                           to={`/transactions?agencyId=${agency.id}`}
                           className="p-1.5 hover:bg-white rounded-lg text-neutral-400 hover:text-blue-500 transition-all shadow-sm border border-transparent hover:border-blue-100"
                           title="Transactions"
                          >
                             <ArrowRightLeft className="w-3.5 h-3.5" />
                          </Link>
                          <Link 
                           to={`/reports?agencyId=${agency.id}`}
                           className="p-1.5 hover:bg-white rounded-lg text-neutral-400 hover:text-green-500 transition-all shadow-sm border border-transparent hover:border-green-100"
                           title="Rapports"
                          >
                             <FileText className="w-3.5 h-3.5" />
                          </Link>
                          <Link 
                           to={`/debts?agencyId=${agency.id}`}
                           className="p-1.5 hover:bg-white rounded-lg text-neutral-400 hover:text-red-500 transition-all shadow-sm border border-transparent hover:border-red-100"
                           title="Dettes"
                          >
                             <UserMinus className="w-3.5 h-3.5" />
                          </Link>
                       </div>
                    </div>
                    <p className="text-xs text-neutral-400 uppercase font-mono italic">{agency.location}</p>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Taux</p>
                  <p className="font-mono font-bold text-blue-600">1 USD = {agency.exchangeRateUSD_CDF} CDF</p>
               </div>
            </div>
            
            <div className="p-4 md:p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6">
               <BalanceBox label="USD" value={agency.currentBalances.USD} currency="USD" />
               <BalanceBox label="CDF" value={agency.currentBalances.CDF} currency="CDF" />
               <BalanceBox label="Virtuel" value={agency.currentBalances.VIRTUEL} currency="USD" />
               <BalanceBox label="Banque" value={agency.currentBalances.BANQUE} currency="USD" icon={Landmark} />
               <BalanceBox label="Mobile Money" value={agency.currentBalances.MOBILE_MONEY} currency="MOBILE_MONEY" icon={Smartphone} />
               <BalanceBox label="Total Global (USD est.)" value={agency.currentBalances.USD + (agency.currentBalances.CDF / agency.exchangeRateUSD_CDF)} currency="USD" highlight />
            </div>

              <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-xs font-bold text-neutral-400">
                 <div className="flex items-center gap-4">
                   <button 
                    onClick={() => setSelectedAgencyIdForHistory(agency.id!)}
                    className={cn(
                      "flex items-center gap-1 hover:text-blue-600 transition-colors uppercase tracking-widest cursor-pointer",
                      selectedAgencyIdForHistory === agency.id ? "text-blue-600" : ""
                    )}
                   >
                     <History className="w-3 h-3" />
                     Historique
                   </button>
                   <button 
                    onClick={() => setExpandedAgencyId(expandedAgencyId === agency.id ? null : agency.id)}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors uppercase tracking-widest cursor-pointer"
                   >
                     <BarChart3 className="w-3 h-3" />
                     {expandedAgencyId === agency.id ? 'Masquer' : 'Détails'}
                     {expandedAgencyId === agency.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" /> }
                   </button>
                 </div>
               <div className="flex items-center gap-2">
                 <button 
                  onClick={() => handleTransferClick(agency)}
                  className="flex items-center gap-1 hover:text-blue-600 transition-colors uppercase tracking-widest cursor-pointer group"
                 >
                   <ArrowRightLeft className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                   Transfert
                 </button>
                 <button 
                  disabled={!isSuperManager} 
                  onClick={() => handleEditBalances(agency)}
                  className="hover:text-blue-600 transition-colors uppercase tracking-widest cursor-pointer disabled:cursor-not-allowed border-l border-neutral-200 pl-4 ml-2"
                 >
                   Modifier la Trésorerie
                 </button>
               </div>
            </div>

            <AnimatePresence>
              {expandedAgencyId === agency.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-neutral-100 bg-white"
                >
                  <div className="p-6 space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Répartition Visuelle (Capitaux)</h4>
                      <div className="space-y-3">
                        <BalanceProgressBar label="USD" value={agency.currentBalances.USD} max={Math.max(agency.currentBalances.USD, 5000)} color="bg-blue-500" currency="USD" />
                        <BalanceProgressBar label="CDF" value={agency.currentBalances.CDF} max={Math.max(agency.currentBalances.CDF, 10000000)} color="bg-green-500" currency="CDF" />
                        <BalanceProgressBar label="Virtuel" value={agency.currentBalances.VIRTUEL} max={Math.max(agency.currentBalances.VIRTUEL, 5000)} color="bg-purple-500" currency="USD" />
                        <BalanceProgressBar label="Banque" value={agency.currentBalances.BANQUE} max={Math.max(agency.currentBalances.BANQUE, 10000)} color="bg-amber-500" currency="USD" />
                        <BalanceProgressBar label="Mobile Money" value={agency.currentBalances.MOBILE_MONEY} max={Math.max(agency.currentBalances.MOBILE_MONEY, 5000)} color="bg-rose-500" currency="MOBILE_MONEY" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {(!agencies || agencies.length === 0) && (
          <div className="flex flex-col items-center justify-center p-12 card border-dashed border-2 col-span-full bg-neutral-50">
             <Building2 className="w-12 h-12 text-neutral-200 mb-4" />
             <p className="text-neutral-500 italic font-serif">Aucune agence n'a encore été enregistrée dans le système.</p>
             {isSuperManager && (
               <button onClick={() => setIsModalOpen(true)} className="btn btn-secondary mt-4">
                 Initialiser la première agence
               </button>
             )}
          </div>
        )}
      </div>

      {/* Transaction History Section */}
      <AnimatePresence>
        {selectedAgencyIdForHistory && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-neutral-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                     <History className="w-6 h-6" />
                  </div>
                  <div>
                     <h2 className="text-2xl font-display font-black text-neutral-900 tracking-tighter uppercase">
                        Journal des Flux : <span className="text-blue-600">{agencies?.find(a => a.id === selectedAgencyIdForHistory)?.name}</span>
                     </h2>
                     <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Analyse détaillée des encaissements et décaissements</p>
                  </div>
               </div>
               <button 
                 onClick={() => setSelectedAgencyIdForHistory(null)}
                 className="btn btn-secondary px-4 text-[10px] font-black uppercase tracking-widest"
               >
                 <X className="w-4 h-4" /> Fermer
               </button>
            </div>

            <div className="card shadow-xl shadow-neutral-200/50">
               <div className="p-6 bg-neutral-50/50 border-b border-neutral-100 flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-3">
                     <Calendar className="w-4 h-4 text-neutral-400" />
                     <div className="flex items-center bg-white border border-neutral-200 rounded-xl px-3 py-1.5 shadow-sm">
                        <input 
                          type="date" 
                          className="text-xs font-bold border-none bg-transparent focus:ring-0 p-0 text-neutral-600"
                          value={startDate}
                          onChange={e => setStartDate(e.target.value)}
                        />
                        <span className="mx-2 text-neutral-300">→</span>
                        <input 
                          type="date" 
                          className="text-xs font-bold border-none bg-transparent focus:ring-0 p-0 text-neutral-600"
                          value={endDate}
                          onChange={e => setEndDate(e.target.value)}
                        />
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <Filter className="w-4 h-4 text-neutral-400" />
                     <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest italic">{agencyHistoryTransactions?.length || 0} Opérations trouvées</span>
                  </div>
               </div>

               <div className="overflow-x-auto min-h-[300px]">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-neutral-50/30 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                           <th className="p-6">Date & Heure</th>
                           <th className="p-6">Type / Motif</th>
                           <th className="p-6">Montant</th>
                           <th className="p-6">Status</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-neutral-50">
                        {agencyHistoryTransactions?.map((t) => (
                          <tr key={t.id} className="hover:bg-neutral-50/80 transition-all font-medium">
                             <td className="p-6">
                                <div className="flex flex-col">
                                   <span className="text-xs text-neutral-900">{formatDate(t.timestamp)}</span>
                                   <span className="text-[9px] text-neutral-400 font-mono italic">ID: TR-{t.id?.toString().slice(-6)}</span>
                                </div>
                             </td>
                             <td className="p-6">
                                <div className="flex items-center gap-3">
                                   <div className={cn(
                                     "w-8 h-8 rounded-lg flex items-center justify-center",
                                     t.type === TransactionType.DEPOT ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                                   )}>
                                      {t.type === TransactionType.DEPOT ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
                                   </div>
                                   <div className="flex flex-col">
                                      <span className="text-xs font-bold uppercase tracking-tight">{t.type}</span>
                                      <span className="text-[10px] text-neutral-400 italic line-clamp-1">{t.description}</span>
                                   </div>
                                </div>
                             </td>
                             <td className="p-6">
                                <span className={cn(
                                  "font-display font-black text-base tracking-tighter",
                                  t.type === TransactionType.DEPOT ? "text-green-600" : "text-neutral-900"
                                )}>
                                   {t.type === TransactionType.DEPOT ? '+' : '-'}{formatCurrency(t.amount, t.currency)}
                                </span>
                             </td>
                             <td className="p-6">
                                <div className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest",
                                  t.status === 'completed' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                                )}>
                                   {t.status}
                                </div>
                             </td>
                          </tr>
                        ))}
                        {(!agencyHistoryTransactions || agencyHistoryTransactions.length === 0) && (
                          <tr>
                             <td colSpan={4} className="p-12 text-center">
                                <div className="flex flex-col items-center justify-center text-neutral-300">
                                   <Receipt className="w-12 h-12 mb-3 opacity-20" />
                                   <p className="text-xs font-bold uppercase tracking-[0.2em] italic">Aucune transaction pour cette période</p>
                                </div>
                             </td>
                          </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal for New Agency */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 bg-neutral-900 text-white flex items-center justify-between">
                <div>
                   <h2 className="text-xl font-bold font-serif italic">Nouvelle Agence</h2>
                   <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">Paramétrage initial des capitaux</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-neutral-500 hover:text-white transition-colors">
                  <ArrowUpRight className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddAgency} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Nom de l'agence</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="Ex: Agence Goma Centre"
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Localisation</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="Province/Ville/Quartier"
                      required
                      value={formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                      <Wallet className="w-4 h-4 text-blue-600" />
                      <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-800">Saisie des fonds de roulement</h4>
                   </div>
                   
                   <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                     <BalanceInput label="USD Initial" value={formData.initialUSD} onChange={val => setFormData({...formData, initialUSD: val})} />
                     <BalanceInput label="CDF Initial" value={formData.initialCDF} onChange={val => setFormData({...formData, initialCDF: val})} />
                     <BalanceInput label="Virtuel Initial" value={formData.initialVIRTUEL} onChange={val => setFormData({...formData, initialVIRTUEL: val})} />
                     <BalanceInput label="Banque" value={formData.initialBANQUE} onChange={val => setFormData({...formData, initialBANQUE: val})} />
                     <BalanceInput label="Mobile Money" value={formData.initialMM} onChange={val => setFormData({...formData, initialMM: val})} />
                     <BalanceInput label="Taux USD/CDF (Initial)" value={formData.exchangeRateUSD_CDF} onChange={val => setFormData({...formData, exchangeRateUSD_CDF: val})} />
                     <BalanceInput label="Commission Standard (%)" value={formData.defaultCommissionRate} onChange={val => setFormData({...formData, defaultCommissionRate: val})} />
                   </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-4">
                   <Info className="w-5 h-5 text-blue-600 shrink-0" />
                   <p className="text-xs text-blue-800 leading-relaxed italic">
                     <strong>Attention:</strong> Ces capitaux ne peuvent plus être modifiés sans l'accord conjoint du Superviseur et de l'Administrateur Principal après validation finale. Assurez-vous des montants réels en coffre.
                   </p>
                </div>

                <div className="flex gap-3 pt-4">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary flex-1 h-12">Annuler</button>
                   <button type="submit" className="btn btn-primary flex-1 h-12 shadow-lg shadow-blue-600/20 uppercase tracking-widest text-sm font-black">Valider & Initialiser</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Edit Balances */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
                <div>
                   <h2 className="text-xl font-bold font-serif italic text-white line-clamp-1">Trésorerie: {selectedAgency?.name}</h2>
                   <p className="text-[10px] text-blue-100 uppercase tracking-widest font-mono">Ajustement manuel des soldes actuels</p>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="text-blue-100 hover:text-white transition-colors">
                  <Plus className="rotate-45 w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleUpdateBalances} className="p-8 space-y-6">
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex gap-4">
                   <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
                   <p className="text-xs text-yellow-800 leading-relaxed">
                     <strong>Attention:</strong> Vous modifiez directement les soldes en direct de cette agence. Cette action sera enregistrée dans les logs d'audit et impactera immédiatement les capacités d'opération de l'agence.
                   </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <BalanceInput label="Solde USD" value={editData.USD} onChange={val => setEditData({...editData, USD: val})} />
                  <BalanceInput label="Solde CDF" value={editData.CDF} onChange={val => setEditData({...editData, CDF: val})} />
                  <BalanceInput label="Solde Virtuel" value={editData.VIRTUEL} onChange={val => setEditData({...editData, VIRTUEL: val})} />
                  <BalanceInput label="Solde Banque" value={editData.BANQUE} onChange={val => setEditData({...editData, BANQUE: val})} />
                  <BalanceInput label="Solde Mobile Money" value={editData.MOBILE_MONEY} onChange={val => setEditData({...editData, MOBILE_MONEY: val})} />
                  <BalanceInput label="Taux USD/CDF" value={editData.exchangeRateUSD_CDF} onChange={val => setEditData({...editData, exchangeRateUSD_CDF: val})} />
                  <BalanceInput label="Commission Standard (%)" value={editData.defaultCommissionRate} onChange={val => setEditData({...editData, defaultCommissionRate: val})} />
                </div>

                <div className="flex gap-3 pt-4">
                   <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn btn-secondary flex-1">Annuler</button>
                   <button type="submit" className="btn btn-primary flex-1">Enregistrer les modifications</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Transfer */}
      <AnimatePresence>
        {isTransferModalOpen && sourceAgencyForTransfer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTransferModalOpen(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold font-serif italic text-white flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5" />
                    Transférer des fonds
                  </h2>
                  <p className="text-[10px] text-blue-100 uppercase tracking-widest font-mono">Source: {sourceAgencyForTransfer.name}</p>
                </div>
                <button onClick={() => setIsTransferModalOpen(false)} className="text-blue-100 hover:text-white transition-colors">
                  <Plus className="rotate-45 w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleExecuteTransfer} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Type de source</label>
                    <select 
                      className="input text-sm"
                      value={transferData.sourceType}
                      onChange={e => setTransferData({...transferData, sourceType: e.target.value})}
                    >
                      <option value="USD">Coffre USD</option>
                      <option value="CDF">Coffre CDF</option>
                      <option value="VIRTUEL">Compte Virtuel</option>
                      <option value="BANQUE">Compte Bancaire</option>
                      <option value="MOBILE_MONEY">Mobile Money</option>
                    </select>
                    <p className="text-[9px] text-neutral-400 font-bold uppercase">Dispo: {formatCurrency(sourceAgencyForTransfer.currentBalances[transferData.sourceType as keyof typeof sourceAgencyForTransfer.currentBalances], transferData.sourceType === 'CDF' ? 'CDF' : transferData.sourceType === 'MOBILE_MONEY' ? 'MOBILE_MONEY' : 'USD')}</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Destination</label>
                    <select 
                      className="input text-sm"
                      value={transferData.destinationAgencyId}
                      onChange={e => setTransferData({...transferData, destinationAgencyId: e.target.value})}
                    >
                      {agencies?.map(a => (
                        <option key={a.id} value={a.id}>{a.name} {a.id === sourceAgencyForTransfer.id ? '(Interne)' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Montant à transférer</label>
                    <input 
                      type="number"
                      className="input font-mono"
                      value={transferData.amount}
                      onChange={e => setTransferData({...transferData, amount: Number(e.target.value)})}
                      required
                      min={0.01}
                      step="any"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Devise (Référence)</label>
                    <select 
                      className="input text-sm"
                      value={transferData.currency}
                      onChange={e => setTransferData({...transferData, currency: e.target.value})}
                    >
                      <option value="USD">USD</option>
                      <option value="CDF">CDF</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Type de destination</label>
                  <select 
                    className="input text-sm"
                    value={transferData.destType}
                    onChange={e => setTransferData({...transferData, destType: e.target.value})}
                  >
                    <option value="USD">Coffre USD</option>
                    <option value="CDF">Coffre CDF</option>
                    <option value="VIRTUEL">Compte Virtuel</option>
                    <option value="BANQUE">Compte Bancaire</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                  </select>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-4">
                  <Info className="w-5 h-5 text-blue-600 shrink-0" />
                  <p className="text-[11px] text-blue-800 leading-relaxed italic">
                    Le transfert impactera immédiatement les soldes des deux agences. Deux transactions (Débit/Crédit) seront générées automatiquement pour la traçabilité.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsTransferModalOpen(false)} className="btn btn-secondary flex-1">Annuler</button>
                  <button type="submit" className="btn btn-primary flex-1">Confirmer le transfert</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BalanceProgressBar({ label, value, max, color, currency }: { label: string, value: number, max: number, color: string, currency: string }) {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-bold">
        <span className="text-neutral-500 uppercase">{label}</span>
        <span className="font-mono text-neutral-900">{formatCurrency(value, currency)}</span>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className={cn("h-full", color)}
        />
      </div>
    </div>
  );
}

function BalanceBox({ label, value, currency, icon: Icon = Wallet, highlight = false }: any) {
  return (
    <div className={cn(
      "flex flex-col gap-1 p-3 rounded-xl transition-all",
      highlight ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-neutral-50 border border-neutral-100"
    )}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("w-3 h-3", highlight ? "text-blue-200" : "text-neutral-400")} />
        <span className={cn("text-[9px] uppercase font-black tracking-widest", highlight ? "text-blue-100" : "text-neutral-400")}>{label}</span>
      </div>
      <span className="font-mono font-bold text-sm truncate">{formatCurrency(value, currency)}</span>
    </div>
  );
}

function BalanceInput({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{label}</label>
      <input 
        type="number" 
        className="input font-mono h-10 py-1" 
        value={value} 
        onChange={e => onChange(Number(e.target.value))} 
        onFocus={(e) => e.target.select()}
      />
    </div>
  );
}
