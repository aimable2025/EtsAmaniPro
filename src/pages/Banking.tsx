import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { 
  BankName, 
  Currency, 
  BankTransactionType, 
  BankTransactionReason, 
  BankTransactionStatus, 
  UserRole,
  BankAccount,
  BankTransaction
} from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { 
  Landmark, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowLeftRight, 
  History, 
  ShieldCheck, 
  ShieldAlert, 
  FileText, 
  Image as ImageIcon,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Building2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Banking() {
  const { user } = useAuth();
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  
  const accounts = useLiveQuery(() => db.bankAccounts.toArray());
  const transactions = useLiveQuery(() => db.bankTransactions.orderBy('timestamp').reverse().toArray());
  const agencies = useLiveQuery(() => db.agencies.toArray());

  const [txFormData, setTxFormData] = useState({
    type: BankTransactionType.DEPOT,
    bankId: 0,
    amount: 0,
    currency: Currency.USD,
    reason: BankTransactionReason.DEPOT,
    origin: '',
    destination: '',
    description: '',
    proofUrl: ''
  });

  const [accountFormData, setAccountFormData] = useState({
    bankName: BankName.EQUITY_BCDC,
    accountNumber: '',
    accountName: '',
    currency: Currency.USD,
    balance: 0,
    agencyId: user?.agencyId || 0
  });

  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) {
        alert("L'image est trop volumineuse (>500KB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setTxFormData({ ...txFormData, proofUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.bankAccounts.add(accountFormData);
    setIsAccountModalOpen(false);
    setAccountFormData({
      bankName: BankName.EQUITY_BCDC,
      accountNumber: '',
      accountName: '',
      currency: Currency.USD,
      balance: 0,
      agencyId: user?.agencyId || 0
    });
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txFormData.bankId) return alert("Veuillez sélectionner une banque");
    
    const newTx: BankTransaction = {
      ...txFormData,
      agentId: user?.id!,
      timestamp: Date.now(),
      status: BankTransactionStatus.PENDING,
      agencyId: user?.agencyId || 0
    };

    await db.bankTransactions.add(newTx);
    
    // Audit Log
    await db.auditLogs.add({
      userId: user?.id!,
      action: 'TRANSACTION_BANCAIRE_CREEE',
      details: `${newTx.type} de ${newTx.amount} ${newTx.currency} - Banque ID: ${newTx.bankId}`,
      timestamp: Date.now()
    });

    setIsTxModalOpen(false);
    setTxFormData({
      type: BankTransactionType.DEPOT,
      bankId: 0,
      amount: 0,
      currency: Currency.USD,
      reason: BankTransactionReason.DEPOT,
      origin: '',
      destination: '',
      description: '',
      proofUrl: ''
    });
  };

  const handleValidateTx = async (txId: number, status: BankTransactionStatus) => {
    const tx = await db.bankTransactions.get(txId);
    if (!tx) return;

    await db.bankTransactions.update(txId, { status });

    if (status === BankTransactionStatus.VALIDATED) {
      const account = await db.bankAccounts.get(tx.bankId);
      if (account) {
        let newBalance = account.balance;
        if (tx.type === BankTransactionType.DEPOT) newBalance += tx.amount;
        if (tx.type === BankTransactionType.RETRAIT) newBalance -= tx.amount;
        // For transfer, we'd need a more complex source/dest logic, but let's assume same account for simplicity in this demo or add dest logic
        await db.bankAccounts.update(tx.bankId, { balance: newBalance });
      }
    }

    // Audit Log
    await db.auditLogs.add({
      userId: user?.id!,
      action: `VALIDATION_TRANSACTION_BANCAIRE_${status}`,
      details: `Transaction #${txId} ${status}`,
      timestamp: Date.now()
    });
  };

  const selectedTx = useMemo(() => {
    return transactions?.find(t => t.id === selectedTxId);
  }, [transactions, selectedTxId]);

  const isAdminOrSupervisor = user?.roles.includes(UserRole.ADMIN_PRINCIPAL) || user?.roles.includes(UserRole.SUPERVISEUR);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-neutral-900 font-serif italic">Module Bancaire</h1>
           <p className="text-neutral-500 italic">Gestion des comptes, dépôts, retraits et transferts institutionnels.</p>
        </div>
        <div className="flex gap-4">
           <button onClick={() => setIsAccountModalOpen(true)} className="btn btn-secondary h-12">
              <Building2 className="w-5 h-5" /> Nouveau Compte
           </button>
           <button onClick={() => setIsTxModalOpen(true)} className="btn btn-primary h-12 shadow-lg shadow-blue-600/20">
              <Plus className="w-5 h-5" /> Nouvelle Opération
           </button>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts?.map(acc => (
          <div key={acc.id} className="relative group">
            <div className="absolute inset-0 bg-blue-600 rounded-3xl translate-y-1 translate-x-1 opacity-10 group-hover:translate-y-2 group-hover:translate-x-2 transition-all" />
            <div className="relative card overflow-hidden border-2 border-neutral-100 group-hover:border-blue-500 transition-all p-6 bg-gradient-to-br from-white to-neutral-50/50">
               <div className="flex items-start justify-between mb-8">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                     <Landmark className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 bg-white px-3 py-1 rounded-full border border-neutral-100 italic">
                     {acc.bankName}
                  </span>
               </div>
               
               <div className="mb-6">
                  <p className="text-[10px] uppercase font-black text-neutral-400 tracking-widest mb-1 italic">Solde Actuel</p>
                  <h3 className="text-3xl font-black text-neutral-900 font-mono tracking-tighter">
                    {formatCurrency(acc.balance, acc.currency)}
                  </h3>
               </div>
               
               <div className="space-y-2 border-t border-neutral-100 pt-4">
                  <div className="flex justify-between items-center text-xs">
                     <span className="text-neutral-400">Numéro</span>
                     <span className="font-mono font-bold tracking-wider">{acc.accountNumber}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                     <span className="text-neutral-400">Libellé</span>
                     <span className="font-bold text-neutral-700">{acc.accountName}</span>
                  </div>
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
           <h3 className="font-bold text-lg text-neutral-900 flex items-center gap-2 italic">
              <History className="w-5 h-5 text-blue-600" /> Historique Bancaire
           </h3>
           <div className="flex gap-2">
              <button className="btn btn-secondary text-xs h-9">
                 <Filter className="w-3 h-3" /> Filtrer
              </button>
           </div>
        </div>
        
        <div className="overflow-x-auto">
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="border-b border-neutral-100 bg-neutral-50/30">
                    <th className="p-4 text-[10px] uppercase font-black text-neutral-400 tracking-widest italic">ID / Date</th>
                    <th className="p-4 text-[10px] uppercase font-black text-neutral-400 tracking-widest italic">Opération</th>
                    <th className="p-4 text-[10px] uppercase font-black text-neutral-400 tracking-widest italic">Banque</th>
                    <th className="p-4 text-[10px] uppercase font-black text-neutral-400 tracking-widest italic">Montant</th>
                    <th className="p-4 text-[10px] uppercase font-black text-neutral-400 tracking-widest italic">Motif</th>
                    <th className="p-4 text-[10px] uppercase font-black text-neutral-400 tracking-widest italic">Statut</th>
                    <th className="p-4 text-[10px] uppercase font-black text-neutral-400 tracking-widest italic text-center">Action</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                 {transactions?.map(tx => {
                   const bank = accounts?.find(a => a.id === tx.bankId);
                   return (
                     <tr key={tx.id} className="hover:bg-neutral-50/50 transition-colors group">
                        <td className="p-4">
                           <div className="flex flex-col">
                              <span className="text-[10px] font-mono text-neutral-400">#BNK-{tx.id}</span>
                              <span className="text-xs font-bold text-neutral-700 italic">{formatDate(tx.timestamp)}</span>
                           </div>
                        </td>
                        <td className="p-4">
                           <div className="flex items-center gap-2">
                              {tx.type === BankTransactionType.DEPOT ? <ArrowDownRight className="w-4 h-4 text-green-500" /> : tx.type === BankTransactionType.RETRAIT ? <ArrowUpRight className="w-4 h-4 text-red-500" /> : <ArrowLeftRight className="w-4 h-4 text-blue-500" />}
                              <span className="text-xs font-black uppercase tracking-wider">{tx.type}</span>
                           </div>
                        </td>
                        <td className="p-4">
                           <div className="flex flex-col">
                              <span className="text-xs font-bold">{bank?.bankName || 'Inconnu'}</span>
                              <span className="text-[10px] text-neutral-400 font-mono">{bank?.accountNumber}</span>
                           </div>
                        </td>
                        <td className="p-4">
                           <span className={cn(
                             "text-sm font-black font-mono tracking-tighter",
                             tx.type === BankTransactionType.DEPOT ? "text-green-600" : tx.type === BankTransactionType.RETRAIT ? "text-red-600" : "text-blue-600"
                           )}>
                             {tx.type === BankTransactionType.RETRAIT ? '-' : '+'}{formatCurrency(tx.amount, tx.currency)}
                           </span>
                        </td>
                        <td className="p-4">
                           <span className="text-[10px] px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full font-bold uppercase tracking-widest border border-neutral-200 italic">
                              {tx.reason}
                           </span>
                        </td>
                        <td className="p-4">
                           <span className={cn(
                             "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                             tx.status === BankTransactionStatus.VALIDATED ? "bg-green-100 text-green-700" :
                             tx.status === BankTransactionStatus.PENDING ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                           )}>
                             {tx.status}
                           </span>
                        </td>
                        <td className="p-4">
                           <div className="flex items-center justify-center gap-2">
                              <button onClick={() => setSelectedTxId(tx.id!)} className="p-2 hover:bg-white rounded-lg text-neutral-400 hover:text-blue-600 transition-all border border-transparent hover:border-blue-100">
                                 <EyeIcon className="w-4 h-4" />
                              </button>
                              {tx.status === BankTransactionStatus.PENDING && isAdminOrSupervisor && (
                                <>
                                  <button onClick={() => handleValidateTx(tx.id!, BankTransactionStatus.VALIDATED)} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all">
                                     <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleValidateTx(tx.id!, BankTransactionStatus.REJECTED)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all">
                                     <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                           </div>
                        </td>
                     </tr>
                   );
                 })}
              </tbody>
           </table>
        </div>
      </div>

      {/* Account Modal */}
      <AnimatePresence>
        {isAccountModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAccountModalOpen(false)} className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden p-8">
               <div className="text-center mb-8">
                  <Landmark className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold font-serif italic text-neutral-900">Nouveau Compte Bancaire</h2>
                  <p className="text-xs text-neutral-500 uppercase tracking-widest font-black italic">Paramétrage Institutionnel</p>
               </div>
               
               <form onSubmit={handleAddAccount} className="space-y-4">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Institution Bancaire</label>
                     <select className="input" value={accountFormData.bankName} onChange={e => setAccountFormData({...accountFormData, bankName: e.target.value as BankName})}>
                        {Object.values(BankName).map(bn => <option key={bn} value={bn}>{bn}</option>)}
                     </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Numéro de Compte</label>
                        <input type="text" className="input font-mono" placeholder="Ex: 001-XXXX-X" required value={accountFormData.accountNumber} onChange={e => setAccountFormData({...accountFormData, accountNumber: e.target.value})} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Devise</label>
                        <select className="input" value={accountFormData.currency} onChange={e => setAccountFormData({...accountFormData, currency: e.target.value as Currency})}>
                           <option value={Currency.USD}>USD</option>
                           <option value={Currency.CDF}>CDF</option>
                        </select>
                     </div>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Nom du Détenteur / Libellé</label>
                     <input type="text" className="input" placeholder="Ex: Trésorerie Amani - Kinshasa" required value={accountFormData.accountName} onChange={e => setAccountFormData({...accountFormData, accountName: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Affectation Agence</label>
                     <select className="input" value={accountFormData.agencyId} onChange={e => setAccountFormData({...accountFormData, agencyId: Number(e.target.value)})}>
                        <option value="0">Compte Global</option>
                        {agencies?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                     </select>
                  </div>
                  <div className="pt-4 flex gap-4">
                     <button type="button" onClick={() => setIsAccountModalOpen(false)} className="flex-1 btn btn-secondary py-3 uppercase tracking-widest text-xs font-bold italic">Annuler</button>
                     <button type="submit" className="flex-1 btn btn-primary py-3 shadow-lg shadow-blue-500/20 uppercase tracking-widest text-xs font-black italic">Enregistrer le Compte</button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Modal */}
      <AnimatePresence>
        {isTxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTxModalOpen(false)} className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
               <div className="bg-neutral-900 p-6 text-white text-center border-b border-white/10">
                  <div className="flex items-center justify-center gap-3 mb-2">
                     <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Plus className="w-5 h-5 text-blue-400" />
                     </div>
                     <h2 className="text-xl font-bold font-serif italic">Nouvelle Opération Bancaire</h2>
                  </div>
                  <p className="text-[9px] text-neutral-500 uppercase tracking-[0.2em] font-black">Audit de validation requis</p>
               </div>
               
               <form onSubmit={handleAddTransaction} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-4">
                        <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Flux Financier</label>
                           <div className="grid grid-cols-3 gap-2">
                              {Object.values(BankTransactionType).map(t => (
                                <button 
                                  key={t}
                                  type="button"
                                  onClick={() => setTxFormData({...txFormData, type: t})}
                                  className={cn(
                                    "py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all",
                                    txFormData.type === t ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20" : "bg-neutral-50 text-neutral-500 border-neutral-100 hover:border-neutral-200"
                                  )}
                                >
                                  {t}
                                </button>
                              ))}
                           </div>
                        </div>
                        
                        <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Compte Cible</label>
                           <select className="input" required value={txFormData.bankId} onChange={e => setTxFormData({...txFormData, bankId: Number(e.target.value)})}>
                              <option value="0">Sélectionner un compte...</option>
                              {accounts?.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber} ({acc.currency})</option>
                              ))}
                           </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Montant</label>
                              <input type="number" step="0.01" className="input font-mono font-bold" required value={txFormData.amount} onChange={e => setTxFormData({...txFormData, amount: Number(e.target.value)})} />
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Devise</label>
                              <select className="input" value={txFormData.currency} onChange={e => setTxFormData({...txFormData, currency: e.target.value as Currency})}>
                                 <option value={Currency.USD}>USD</option>
                                 <option value={Currency.CDF}>CDF</option>
                              </select>
                           </div>
                        </div>

                        <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Motif de l'opération</label>
                           <select className="input" value={txFormData.reason} onChange={e => setTxFormData({...txFormData, reason: e.target.value as BankTransactionReason})}>
                              {Object.values(BankTransactionReason).map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                           </select>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Origine</label>
                              <input type="text" className="input text-xs" placeholder="Ex: Client" value={txFormData.origin} onChange={e => setTxFormData({...txFormData, origin: e.target.value})} />
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Destination</label>
                              <input type="text" className="input text-xs" placeholder="Ex: Banque" value={txFormData.destination} onChange={e => setTxFormData({...txFormData, destination: e.target.value})} />
                           </div>
                        </div>
                        
                        <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Notes / Détails</label>
                           <textarea className="input text-xs h-24" placeholder="Description détaillée..." value={txFormData.description} onChange={e => setTxFormData({...txFormData, description: e.target.value})} />
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Preuve de l'opération</label>
                           <div className="relative h-20 border-2 border-dashed border-neutral-200 rounded-xl flex items-center justify-center hover:border-blue-500 transition-all cursor-pointer overflow-hidden group">
                              {txFormData.proofUrl ? (
                                <img src={txFormData.proofUrl} className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex flex-col items-center">
                                   <ImageIcon className="w-5 h-5 text-neutral-300 group-hover:text-blue-500" />
                                   <span className="text-[9px] text-neutral-400 font-bold mt-1">CAPTURE / REÇU</span>
                                </div>
                              )}
                              <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleProofUpload} />
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-start gap-3">
                     <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                     <p className="text-[10px] text-amber-800 italic leading-relaxed">
                        Cette opération sera soumise à une validation système et auditée par l'administrateur principal. Assurez-vous que toutes les informations sont exactes avant de valider.
                     </p>
                  </div>

                  <div className="flex gap-4">
                     <button type="button" onClick={() => setIsTxModalOpen(false)} className="flex-1 btn btn-secondary py-3 uppercase tracking-widest text-xs font-bold">Annuler</button>
                     <button type="submit" className="flex-1 btn btn-primary py-3 shadow-lg shadow-blue-500/20 uppercase tracking-[0.2em] text-xs font-black italic">
                        Initier la Transaction
                     </button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedTxId && selectedTx && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedTxId(null)} className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
               <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                  <h3 className="font-bold text-lg italic">Détails Opération #BNK-{selectedTx.id}</h3>
                  <button onClick={() => setSelectedTxId(null)} className="text-neutral-400 hover:text-neutral-600">
                     <XCircle className="w-5 h-5" />
                  </button>
               </div>
               
               <div className="p-8 space-y-6">
                  {selectedTx.proofUrl && (
                    <div className="aspect-video w-full rounded-2xl border border-neutral-100 overflow-hidden shadow-inner bg-neutral-900">
                       <img src={selectedTx.proofUrl} className="w-full h-full object-contain" />
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-4">
                        <DetailRow label="Type" value={selectedTx.type.toUpperCase()} />
                        <DetailRow label="Montant" value={formatCurrency(selectedTx.amount, selectedTx.currency)} />
                        <DetailRow label="Banque" value={accounts?.find(a => a.id === selectedTx.bankId)?.bankName || 'N/A'} />
                        <DetailRow label="Status" value={selectedTx.status} />
                     </div>
                     <div className="space-y-4">
                        <DetailRow label="Origine" value={selectedTx.origin || 'N/A'} />
                        <DetailRow label="Destination" value={selectedTx.destination || 'N/A'} />
                        <DetailRow label="Date" value={formatDate(selectedTx.timestamp)} />
                     </div>
                  </div>
                  
                  {selectedTx.description && (
                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 italic text-xs text-neutral-600">
                       "{selectedTx.description}"
                    </div>
                  )}

                  {selectedTx.status === BankTransactionStatus.PENDING && isAdminOrSupervisor && (
                    <div className="flex gap-4 pt-4">
                       <button onClick={() => { handleValidateTx(selectedTx.id!, BankTransactionStatus.REJECTED); setSelectedTxId(null); }} className="flex-1 btn bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all font-bold">REJETER</button>
                       <button onClick={() => { handleValidateTx(selectedTx.id!, BankTransactionStatus.VALIDATED); setSelectedTxId(null); }} className="flex-1 btn btn-primary shadow-lg shadow-blue-500/20 font-bold">VALIDER</button>
                    </div>
                  )}
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col gap-1">
       <span className="text-[9px] font-black uppercase text-neutral-400 tracking-widest italic">{label}</span>
       <span className="text-xs font-bold text-neutral-900">{value}</span>
    </div>
  );
}

function EyeIcon(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
