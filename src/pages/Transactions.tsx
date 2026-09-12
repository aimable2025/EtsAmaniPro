import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { TransactionType, Currency, UserRole } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { useSearchParams } from 'react-router-dom';
import { 
  ArrowRightLeft, 
  Plus, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Repeat, 
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  User as UserIcon,
  DollarSign,
  Info,
  Download,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatService } from '../services/chatService';
import { DetectionService } from '../services/DetectionService';

export default function Transactions() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAgencyId, setFilterAgencyId] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const agencyIdParam = searchParams.get('agencyId');
    if (agencyIdParam) {
      setFilterAgencyId(agencyIdParam);
    }
  }, [searchParams]);

  const isAdmin = user?.roles.includes(UserRole.ADMIN_PRINCIPAL) || user?.roles.includes(UserRole.SUPERVISEUR);

  const agencies = useLiveQuery(() => {
    if (isAdmin) return db.agencies.toArray();
    return db.agencies.where('id').equals(user?.agencyId || 0).toArray();
  }, [user, isAdmin]);

  const transactions = useLiveQuery(() => {
    if (isAdmin) return db.transactions.orderBy('timestamp').reverse().toArray();
    return db.transactions.where('agencyId').equals(user?.agencyId || 0).reverse().toArray();
  }, [user, isAdmin]);

  const [formData, setFormData] = useState({
    agencyId: user?.agencyId || 0,
    type: TransactionType.DEPOT,
    amount: '' as any,
    currency: Currency.USD,
    secondaryAmount: '' as any,
    secondaryCurrency: Currency.CDF,
    description: '',
    rate: 2850
  });

  const filteredTransactions = transactions?.filter(t => {
    const s = search.toLowerCase();
    const agency = agencies?.find(a => a.id === t.agencyId);
    
    const matchesSearch = 
      t.description.toLowerCase().includes(s) ||
      t.amount.toString().includes(s) ||
      t.currency.toLowerCase().includes(s) ||
      (agency?.name.toLowerCase().includes(s) ?? false);

    const matchesType = filterType === 'all' || t.type === filterType;
    
    const matchesAgency = filterAgencyId === 'all' || t.agencyId === Number(filterAgencyId);
    
    let matchesDateRange = true;
    if (startDate) {
      const start = new Date(`${startDate}T00:00:00`).getTime();
      if (t.timestamp < start) matchesDateRange = false;
    }
    if (endDate) {
      const end = new Date(`${endDate}T23:59:59`).getTime();
      if (t.timestamp > end) matchesDateRange = false;
    }
    
    return matchesSearch && matchesType && matchesAgency && matchesDateRange;
  });

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agencyId) return alert('Veuillez sélectionner une agence.');

    const agency = await db.agencies.get(Number(formData.agencyId));
    if (!agency) return;

    const txAmount = Number(formData.amount);
    const txRate = Number(formData.rate);

    // Update Agency Balance Logic
    const updatedBalances = { ...agency.currentBalances };

    if (formData.type === TransactionType.DEPOT) {
      updatedBalances[formData.currency] += txAmount;
    } else if (formData.type === TransactionType.RETRAIT) {
      if (updatedBalances[formData.currency] < txAmount) {
        return alert('Solde insuffisant dans le coffre de l\'agence pour ce retrait.');
      }
      updatedBalances[formData.currency] -= txAmount;
    } else if (formData.type === TransactionType.CHANGE) {
      if (formData.currency === Currency.USD) {
        // Change USD to CDF
        updatedBalances.USD += txAmount;
        updatedBalances.CDF -= txAmount * txRate;
      } else {
        // Change CDF to USD
        updatedBalances.CDF += txAmount;
        updatedBalances.USD -= txAmount / txRate;
      }
    }

    await db.agencies.update(agency.id!, { currentBalances: updatedBalances });

    await db.transactions.add({
      agencyId: Number(formData.agencyId),
      userId: user?.id!,
      type: formData.type,
      amount: txAmount,
      currency: formData.currency,
      description: formData.description,
      timestamp: Date.now(),
      status: 'completed',
      rate: txRate
    });

    await db.auditLogs.add({
      userId: user?.id!,
      action: 'TRANSACTION',
      details: `${formData.type} de ${txAmount} ${formData.currency} à l'agence ${agency.name}`,
      timestamp: Date.now()
    });

    if (user) {
      await DetectionService.checkSuspectActivity(user);
      await DetectionService.checkOperationDensity(user.id!, user.agencyId || 0);
    }

    setIsModalOpen(false);
    setFormData({
      ...formData,
      amount: '',
      description: ''
    });
  };

  const exportToCSV = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) return;

    const headers = ['ID', 'Type', 'Description', 'Agence', 'Montant', 'Devise', 'Date', 'Taux'];
    const rows = filteredTransactions.map(tx => [
      `#TX-${String(tx.id).padStart(4, '0')}`,
      tx.type,
      tx.description,
      agencies?.find(a => a.id === tx.agencyId)?.name || 'N/A',
      tx.amount,
      tx.currency,
      formatDate(tx.timestamp).replace(',', ''), // Remove comma for CSV
      tx.rate || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 font-serif italic">Flux Financiers</h1>
          <p className="text-neutral-500 italic">Enregistrement et suivi des mouvements de fonds.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={exportToCSV} 
            disabled={!filteredTransactions || filteredTransactions.length === 0}
            className="btn btn-secondary h-11 md:h-12 px-4 md:px-6 border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm"
          >
            <Download className="w-4 h-4" />
            <span>Exporter CSV</span>
          </button>
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary h-11 md:h-12 px-4 md:px-6 shadow-lg shadow-blue-600/20 text-xs md:text-sm">
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
            Effectuer une Opération
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-6">
             <div className="flex items-center gap-2 mb-6">
                <Filter className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-black uppercase tracking-widest">Filtrer & Rechercher</h2>
             </div>
             
             <div className="space-y-4">
                <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                   <input 
                     type="text" 
                     placeholder="Description..." 
                     className="input pl-10 text-sm"
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                   />
                </div>

                 <div className="space-y-1">
                   <label className="text-[10px] uppercase font-bold text-neutral-400">Agence</label>
                   <select 
                     className="input text-sm"
                     value={filterAgencyId}
                     onChange={(e) => setFilterAgencyId(e.target.value)}
                   >
                     <option value="all">Toutes les agences</option>
                     {agencies?.map(a => (
                       <option key={a.id} value={a.id}>{a.name}</option>
                     ))}
                   </select>
                </div>

                <div className="space-y-1">
                   <label className="text-[10px] uppercase font-bold text-neutral-400">Type d'opération</label>
                   <select 
                     className="input text-sm"
                     value={filterType}
                     onChange={(e) => setFilterType(e.target.value)}
                   >
                     <option value="all">Toutes les opérations</option>
                     <option value={TransactionType.DEPOT}>Dépôts</option>
                     <option value={TransactionType.RETRAIT}>Retraits</option>
                     <option value={TransactionType.CHANGE}>Change</option>
                     <option value={TransactionType.CASH_EXPRESS}>Cash Express</option>
                   </select>
                </div>

                <div className="pt-4 border-t border-neutral-100">
                   <div className="flex items-center gap-2 mb-3">
                      <Filter className="w-3 h-3 text-neutral-400" />
                      <span className="text-[10px] uppercase font-bold text-neutral-400">Période Personnalisée</span>
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                         <label className="text-[10px] uppercase font-bold text-neutral-400">Du (Début)</label>
                         <input 
                           type="date" 
                           className="input text-xs" 
                           value={startDate}
                           onChange={(e) => setStartDate(e.target.value)}
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] uppercase font-bold text-neutral-400">Au (Fin)</label>
                         <input 
                           type="date" 
                           className="input text-xs" 
                           value={endDate}
                           onChange={(e) => setEndDate(e.target.value)}
                         />
                      </div>
                   </div>
                </div>

                {(startDate || endDate) && (
                  <button 
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="text-[10px] text-blue-600 font-bold uppercase tracking-widest hover:underline"
                  >
                    Réinitialiser les dates
                  </button>
                )}
             </div>
          </div>

          <div className="card p-6 bg-neutral-900 text-white">
             <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <h2 className="text-xs font-black uppercase tracking-widest">Rappel de Sécurité</h2>
             </div>
             <p className="text-xs text-neutral-400 leading-relaxed italic">
               Toute transaction est irréversible après validation locale. Assurez-vous d'avoir compté les billets physiquement avant de cliquer sur "Enregistrer".
             </p>
          </div>
        </div>

        {/* Transactions List */}
        <div className="lg:col-span-3 card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
                <th className="px-6 py-3">Réf</th>
                <th className="px-6 py-3">Opération</th>
                <th className="px-6 py-3">Lieu / Agent</th>
                <th className="px-6 py-3">Montant</th>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filteredTransactions?.map((tx) => (
                <tr 
                  key={tx.id} 
                  className="text-sm hover:bg-neutral-50/80 transition-colors group cursor-pointer"
                  onClick={() => setSelectedTxId(tx.id!)}
                >
                  <td className="px-6 py-4 font-mono text-xs text-neutral-400">
                    #TX-{String(tx.id).padStart(4, '0')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        tx.type === TransactionType.DEPOT ? "bg-green-100 text-green-700" :
                        tx.type === TransactionType.RETRAIT ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {tx.type === TransactionType.DEPOT ? <ArrowUpCircle className="w-4 h-4" /> : 
                         tx.type === TransactionType.RETRAIT ? <ArrowDownCircle className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-neutral-800 capitalize leading-tight">{tx.type.replace('_', ' ')}</span>
                        <span className="text-[10px] text-neutral-400 truncate max-w-[120px] italic">{tx.description}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <p className="text-xs font-bold text-neutral-700">{agencies?.find(a => a.id === tx.agencyId)?.name}</p>
                     <p className="text-[10px] text-neutral-400">ID Agent: {tx.userId}</p>
                  </td>
                  <td className="px-6 py-4">
                     <span className="font-mono font-black text-neutral-900">{formatCurrency(tx.amount, tx.currency)}</span>
                     {tx.rate && (
                       <p className="text-[9px] text-neutral-400 font-bold uppercase mt-1">@ {tx.rate} CDF</p>
                     )}
                  </td>
                  <td className="px-6 py-4 text-neutral-500 font-mono text-xs italic">
                    {formatDate(tx.timestamp)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTxId(tx.id!);
                      }}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-neutral-400 hover:text-blue-600"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(!filteredTransactions || filteredTransactions.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-400 italic">
                    Aucune transaction trouvée pour vos critères de recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* Transaction Modal */}
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
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
                <div>
                   <h2 className="text-xl font-bold font-serif italic">Enregistrer une Opération</h2>
                   <p className="text-[10px] text-blue-100 uppercase tracking-widest font-mono">Formulaire de saisie transactionnelle</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 bg-blue-500/50 hover:bg-blue-500 rounded-lg flex items-center justify-center transition-colors">
                  <ArrowRightLeft className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleTransaction} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black text-neutral-400">Agence</label>
                    <select 
                      className="input text-sm"
                      value={formData.agencyId}
                      onChange={e => setFormData({...formData, agencyId: Number(e.target.value)})}
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {agencies?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black text-neutral-400">Type</label>
                    <select 
                      className="input text-sm"
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value as TransactionType})}
                    >
                      {Object.values(TransactionType).map(t => <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black text-neutral-400">Montant</label>
                    <div className="relative">
                       <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                       <input 
                         type="number" 
                         className="input pl-10 font-mono" 
                         required 
                         value={formData.amount}
                         onChange={e => setFormData({...formData, amount: e.target.value})}
                         onFocus={(e) => e.target.select()}
                       />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black text-neutral-400">Devise</label>
                    <select 
                      className="input text-sm font-bold"
                      value={formData.currency}
                      onChange={e => setFormData({...formData, currency: e.target.value as Currency})}
                    >
                      <option value={Currency.USD}>USD (Dollar)</option>
                      <option value={Currency.CDF}>CDF (Franc Congolais)</option>
                      <option value={Currency.VIRTUEL}>VIRTUEL</option>
                      <option value={Currency.MOBILE_MONEY}>MOBILE MONEY</option>
                    </select>
                  </div>
                </div>

                {formData.type === TransactionType.CHANGE && (
                  <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100 space-y-4">
                    <div className="flex items-center justify-between">
                       <p className="text-[10px] uppercase font-black text-neutral-400">Paramètres de Change</p>
                       <span className="text-[10px] font-mono text-blue-600 font-bold italic">Calcul Automatique Activé</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                         <label className="text-[9px] uppercase font-bold text-neutral-500">Taux appliqué</label>
                         <input 
                           type="number" 
                           className="input h-9 text-sm font-mono" 
                           value={formData.rate}
                           onChange={e => setFormData({...formData, rate: Number(e.target.value)})}
                         />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[9px] uppercase font-bold text-neutral-500">Montant Équivalent</label>
                         <div className="h-9 px-3 bg-white border border-neutral-200 rounded-lg flex items-center font-mono text-sm font-black text-blue-600">
                           {formData.currency === Currency.USD 
                             ? formatCurrency(Number(formData.amount) * formData.rate, 'CDF')
                             : formatCurrency(Number(formData.amount) / formData.rate, 'USD')
                           }
                         </div>
                       </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-neutral-400">Motif ou Client</label>
                  <div className="relative">
                     <UserIcon className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                     <textarea 
                       className="input pl-10 min-h-[80px]" 
                       placeholder="Nom du client, numéro de téléphone, référence..."
                       value={formData.description}
                       onChange={e => setFormData({...formData, description: e.target.value})}
                     />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary w-full h-12 text-sm uppercase tracking-[0.2em] font-black">
                   Confirmer l'Opération
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTxId && (
          <TransactionDetailModal 
            id={selectedTxId} 
            onClose={() => setSelectedTxId(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TransactionDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const tx = useLiveQuery(() => db.transactions.get(id));
  const agency = useLiveQuery(() => tx ? db.agencies.get(tx.agencyId) : null, [tx]);
  const user = useLiveQuery(() => tx ? db.users.get(tx.userId) : null, [tx]);

  if (!tx) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
           <div>
              <h3 className="font-bold text-lg">Détails de la Transaction</h3>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Référence #TX-{String(tx.id).padStart(4, '0')}</p>
           </div>
           <button onClick={onClose} className="text-neutral-300 hover:text-neutral-500">
              <CheckCircle2 className="w-6 h-6" />
           </button>
        </div>

        <div className="p-8 space-y-6">
           <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
              <div className="flex items-center gap-3">
                 <div className={cn(
                   "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                   tx.type === TransactionType.DEPOT ? "bg-green-100 text-green-700" :
                   tx.type === TransactionType.RETRAIT ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                 )}>
                    {tx.type === TransactionType.DEPOT ? <ArrowUpCircle className="w-6 h-6" /> : 
                     tx.type === TransactionType.RETRAIT ? <ArrowDownCircle className="w-6 h-6" /> : <Repeat className="w-6 h-6" />}
                 </div>
                 <div>
                    <p className="text-[10px] font-black uppercase text-neutral-400 mb-0.5">Type d'opération</p>
                    <p className="text-sm font-bold text-neutral-900 capitalize">{tx.type.replace('_', ' ')}</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black uppercase text-neutral-400 mb-0.5">Statut</p>
                 <span className="text-[10px] font-black uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    {tx.status}
                 </span>
              </div>
           </div>

           <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Montant</p>
                    <p className="text-xl font-mono font-black text-neutral-900">{formatCurrency(tx.amount, tx.currency)}</p>
                 </div>
                 {tx.rate && (
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Taux Appliqué</p>
                      <p className="text-xl font-mono font-black text-blue-600">{tx.rate} <span className="text-[10px] uppercase">CDF</span></p>
                   </div>
                 )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Agence</p>
                    <p className="text-xs font-bold text-neutral-700">{agency?.name || 'Agence inconnue'}</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Date & Heure</p>
                    <p className="text-xs font-bold text-neutral-700">{formatDate(tx.timestamp)}</p>
                 </div>
              </div>

              <div className="space-y-1 pt-2">
                 <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Agent / Opérateur</p>
                 <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center">
                       <UserIcon className="w-3 h-3 text-neutral-400" />
                    </div>
                    <p className="text-xs font-bold text-neutral-700">{user?.fullName || `ID: ${tx.userId}`}</p>
                 </div>
              </div>

              <div className="space-y-1 pt-2">
                 <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Description / Libellé</p>
                 <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 italic text-xs text-neutral-600">
                    "{tx.description || 'Aucune description fournie'}"
                 </div>
              </div>
           </div>

           <div className="pt-4 flex flex-wrap gap-3">
              <button 
                onClick={onClose}
                className="btn btn-secondary flex-1 min-w-[120px] h-12 uppercase tracking-widest text-[10px] font-black"
              >
                 Fermer
              </button>
              <button 
                className="btn btn-primary flex-1 min-w-[120px] h-12 uppercase tracking-widest text-[10px] font-black"
                onClick={() => window.print()}
              >
                 Imprimer
              </button>
              <button 
                className="btn bg-neutral-900 text-white hover:bg-neutral-800 flex-1 min-w-[120px] h-12 uppercase tracking-widest text-[10px] font-black flex items-center justify-center gap-2"
                onClick={async () => {
                  if (user) {
                     await ChatService.shareTransaction(tx.id!, {
                       senderId: user.id!,
                       senderName: user.fullName,
                       senderCode: `AGN-${user.id}`,
                       agencyId: user.agencyId || 0
                     }, { recipientGroupId: 'global' });
                     alert('Transaction partagée dans le canal Global !');
                  }
                }}
              >
                 <Share2 className="w-3 h-3" />
                 Partager
              </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
}
