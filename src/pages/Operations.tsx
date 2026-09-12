import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { 
  SlipType, 
  SlipStatus, 
  Currency, 
  UserRole, 
  Slip, 
  TransactionType,
  Agency
} from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { 
  FileText, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Search, 
  Filter, 
  Zap,
  Image as ImageIcon,
  Clock,
  ShieldCheck,
  Send,
  AlertTriangle,
  History,
  Coins,
  Wallet,
  TrendingDown,
  TrendingUp,
  FileSearch,
  CheckSquare,
  Percent,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateDataSignature } from '../lib/security';
import { DetectionService } from '../services/DetectionService';

export default function Operations() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlipId, setSelectedSlipId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  
  const slips = useLiveQuery(() => db.slips.orderBy('timestamp').reverse().toArray());
  const agencies = useLiveQuery(() => db.agencies.toArray());
  const commissionRates = useLiveQuery(() => db.commissionRates.toArray());

  const [formData, setFormData] = useState({
    type: SlipType.DEPOT_CLIENT,
    amount: 0,
    currency: Currency.USD,
    description: '',
    agencyId: user?.agencyId || 0,
    proofUrl: '',
    rate: 0,
    billetageDetails: [] as { denomination: number; count: number }[],
    commissionRate: 0,
    commissionAmount: 0,
    totalWithCommission: 0,
    discountRequested: false,
    discountReason: '',
    standardRateAtTime: 0,
    printAfterCreate: false
  });

  const [billetageInput, setBilletageInput] = useState<{ denomination: number; count: number }[]>([]);

  // Automatic Commission Rates Logic
  useEffect(() => {
    if (commissionRates && formData.type && formData.agencyId && agencies) {
      const agency = agencies.find(a => a.id === formData.agencyId);
      const rate = commissionRates.find(r => r.agencyId === formData.agencyId && r.operationType === formData.type);
      
      const standardRate = rate ? rate.standardRate : (agency?.defaultCommissionRate || 0);
      
      if (!formData.discountRequested) {
        setFormData(prev => ({
          ...prev,
          commissionRate: standardRate,
          standardRateAtTime: standardRate
        }));
      }
    }
  }, [formData.type, formData.agencyId, commissionRates, formData.discountRequested, agencies]);

  // Calculate Commission Totals
  useEffect(() => {
    const commission = (formData.amount * formData.commissionRate) / 100;
    setFormData(prev => ({
      ...prev,
      commissionAmount: commission,
      totalWithCommission: formData.amount + commission
    }));
  }, [formData.amount, formData.commissionRate]);

  const slipCounts = useMemo(() => {
    if (!slips) return { pending: 0, validated: 0, completed: 0 };
    return {
      pending: slips.filter(s => s.status === SlipStatus.PENDING_VALIDATION || s.status === SlipStatus.PENDING_SUPERVISOR).length,
      validated: slips.filter(s => s.status === SlipStatus.VALIDATED).length,
      completed: slips.filter(s => s.status === SlipStatus.COMPLETED).length
    };
  }, [slips]);

  const totalBilletage = useMemo(() => {
    return billetageInput.reduce((acc, curr) => acc + (curr.denomination * curr.count), 0);
  }, [billetageInput]);

  const billetageMatches = Math.abs(totalBilletage - formData.amount) < 0.01;

  const handleCreateSlip = async () => {
    if (!formData.amount || formData.amount <= 0) return;
    if (!formData.proofUrl) return alert("La pièce justificative est obligatoire.");
    if (!billetageMatches) return alert("Le billetage ne correspond pas au montant total.");

    const newSlip: Slip = {
      ...formData,
      status: [SlipType.DEPENSE, SlipType.SALAIRE].includes(formData.type) 
        ? SlipStatus.PENDING_SUPERVISOR 
        : SlipStatus.PENDING_VALIDATION,
      comptableId: user?.id!,
      timestamp: Date.now(),
      updatedAt: Date.now(),
      billetageDetails: billetageInput
    };

    // Data Security: Digital Signature for Integrity
    newSlip.signature = generateDataSignature(newSlip);

    const slipId = await db.slips.add(newSlip);
    newSlip.id = slipId; // Ensure ID is present for detection
    
    if (user) {
      await DetectionService.checkSlipAnomaly(newSlip, user);
      await DetectionService.checkSuspectActivity(user);
      await DetectionService.checkOperationDensity(user.id!, user.agencyId || 0);
    }
    
    await db.auditLogs.add({
      userId: user?.id!,
      action: 'SLIP_CREE',
      details: `Bordereau ${newSlip.type} de ${newSlip.amount} ${newSlip.currency} créé`,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      signature: generateDataSignature({ action: 'SLIP_CREE', userId: user?.id, amount: newSlip.amount })
    });

    setIsModalOpen(false);
    if (formData.printAfterCreate) {
       setSelectedSlipId(slipId);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      type: SlipType.DEPOT_CLIENT,
      amount: 0,
      currency: Currency.USD,
      description: '',
      agencyId: user?.agencyId || 0,
      proofUrl: '',
      rate: 0,
      billetageDetails: [],
      commissionRate: 0,
      commissionAmount: 0,
      totalWithCommission: 0,
      discountRequested: false,
      discountReason: '',
      standardRateAtTime: 0,
      printAfterCreate: false
    });
    setBilletageInput([]);
    setCurrentStep(1);
  };

  const handleValidateSlip = async (slipId: number) => {
    await db.slips.update(slipId, { 
      status: SlipStatus.VALIDATED, 
      caissierId: user?.id,
      updatedAt: Date.now() 
    });
  };

  const handleSupervisorValidateSlip = async (slipId: number) => {
    await db.slips.update(slipId, { 
      status: SlipStatus.VALIDATED, 
      caissierId: user?.id,
      updatedAt: Date.now() 
    });
  };

  const handleExecuteSlip = async (slipId: number) => {
    const slip = await db.slips.get(slipId);
    if (!slip) return;

    const agency = await db.agencies.get(slip.agencyId);
    if (!agency) return;

    const updatedBalances = { ...agency.currentBalances };
    
    if (slip.type === SlipType.DEPOT_CLIENT || slip.type === SlipType.DEPOT_COMPTE) {
       updatedBalances[slip.currency] += slip.amount;
    } else if (slip.type === SlipType.RETRAIT_CLIENT || slip.type === SlipType.DEPENSE || slip.type === SlipType.SALAIRE) {
       if (updatedBalances[slip.currency] < slip.amount) return alert("Solde insuffisant.");
       updatedBalances[slip.currency] -= slip.amount;
    }

    await db.agencies.update(slip.agencyId, { currentBalances: updatedBalances });
    await DetectionService.checkLowTreasury(slip.agencyId);
    
    await db.slips.update(slipId, { 
      status: SlipStatus.COMPLETED, 
      executorId: user?.id,
      updatedAt: Date.now() 
    });

    await db.transactions.add({
      agencyId: slip.agencyId,
      userId: user?.id!,
      type: slip.type as unknown as TransactionType,
      amount: slip.amount,
      currency: slip.currency,
      description: `BOR#${slip.id}: ${slip.description}`,
      timestamp: Date.now(),
      status: 'completed',
      rate: slip.rate
    });
  };

  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1000 * 1024) return alert("Fichier trop volumineux (>1Mo)");
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, proofUrl: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const filteredSlips = slips?.filter(s => 
    s.description.toLowerCase().includes(search.toLowerCase()) ||
    s.type.toLowerCase().includes(search.toLowerCase())
  );

  const isAdmin = user?.roles.includes(UserRole.ADMIN_PRINCIPAL) || user?.roles.includes(UserRole.SUPERVISEUR);
  const isComptable = user?.roles.includes(UserRole.COMPTABLE) || isAdmin;
  const isCaissier = user?.roles.includes(UserRole.CAISSIER_PRINCIPAL) || isAdmin;
  
  const canExecute = (type: SlipType) => {
    const roles = user?.roles || [];
    if (isAdmin) return true;
    if (type === SlipType.DEPOT_CLIENT && roles.includes(UserRole.GUICHETIER)) return true;
    return roles.includes(UserRole.ADMIN_AGENCE);
  };

  const steps = [
    { n: 1, title: 'Nature', icon: Zap },
    { n: 2, title: 'Détails', icon: FileText },
    { n: 3, title: 'Billetage', icon: Coins },
    { n: 4, title: 'Validation', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Header with Glassmorphism */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-4xl font-display font-black tracking-tighter text-neutral-900 group">
             Flux <span className="text-blue-600">Opérationnel</span>
           </h1>
           <p className="text-neutral-500 font-medium max-w-lg mt-1">Gestion intelligente du cycle de vie des bordereaux, de l'émission à l'exécution.</p>
        </div>
        <div className="flex gap-4">
           {isComptable && (
             <button onClick={() => setIsModalOpen(true)} className="btn btn-primary h-14 px-8 shadow-2xl shadow-blue-500/20 rounded-2xl group">
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> 
                <span className="uppercase tracking-widest text-xs font-black">Nouveau Bordereau</span>
             </button>
           )}
        </div>
      </div>

      {/* Modern Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
         <StatCard 
           label="Flux en attente" 
           value={slipCounts.pending} 
           icon={Clock} 
           color="amber" 
           trend="+2 depuis 1h"
         />
         <StatCard 
           label="Prêt pour exécution" 
           value={slipCounts.validated} 
           icon={CheckSquare} 
           color="blue" 
           trend="Priorité haute"
         />
         <div className="sm:col-span-2 lg:col-span-1">
           <StatCard 
             label="Clôturés (24h)" 
             value={slipCounts.completed} 
             icon={CheckCircle2} 
             color="green" 
             trend="Performance : 98%"
           />
         </div>
      </div>

      {/* Main Table Content */}
      <div className="card border-none shadow-xl shadow-neutral-200/50">
         <div className="p-8 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <FileSearch className="w-5 h-5 text-blue-600" />
               </div>
               <div>
                  <h3 className="font-bold text-neutral-800">Registre des Bordereaux</h3>
                  <p className="text-[10px] text-neutral-400 font-black uppercase tracking-widest">Temps réel</p>
               </div>
            </div>
            <div className="relative w-full md:w-80">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
               <input 
                 type="text" 
                 placeholder="Chercher une référence ou un motif..." 
                 className="input pl-11 h-12 bg-neutral-50/50 border-neutral-100"
                 value={search}
                 onChange={e => setSearch(e.target.value)}
               />
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-neutral-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                     <th className="p-6">Référence</th>
                     <th className="p-6">Opération</th>
                     <th className="p-6">Montant</th>
                     <th className="p-6">Workflow</th>
                     <th className="p-6 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-neutral-50">
                  {filteredSlips?.map(slip => (
                    <tr key={slip.id} className="hover:bg-neutral-50/80 transition-all group">
                       <td className="p-6">
                          <div className="flex flex-col">
                             <span className="text-[10px] font-mono font-bold text-neutral-400">#BOR-{slip.id}</span>
                             <span className="text-xs font-bold text-neutral-700">{formatDate(slip.timestamp)}</span>
                          </div>
                       </td>
                       <td className="p-6">
                          <div className="flex flex-col">
                             <span className="text-xs font-black uppercase tracking-widest text-blue-600 mb-1">{slip.type.replace('_', ' ')}</span>
                             <span className="text-[11px] text-neutral-400 font-medium line-clamp-1">{slip.description}</span>
                          </div>
                       </td>
                       <td className="p-6">
                          <span className="text-base font-display font-black text-neutral-900 tracking-tighter">
                             {formatCurrency(slip.amount, slip.currency)}
                          </span>
                       </td>
                       <td className="p-6 text-center">
                          <div className={cn(
                            "inline-flex items-center gap-2 px-3 py-1 rounded-full border",
                            slip.status === SlipStatus.PENDING_VALIDATION || slip.status === SlipStatus.PENDING_SUPERVISOR ? "bg-amber-50 text-amber-600 border-amber-100" :
                            slip.status === SlipStatus.VALIDATED ? "bg-blue-50 text-blue-600 border-blue-100" :
                            slip.status === SlipStatus.COMPLETED ? "bg-green-50 text-green-600 border-green-100" : "bg-neutral-50 text-neutral-400 border-neutral-100"
                          )}>
                             <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                             <span className="text-[9px] font-black uppercase tracking-widest">
                                {slip.status.replace('_', ' ')}
                             </span>
                          </div>
                       </td>
                       <td className="p-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                             <button onClick={() => setSelectedSlipId(slip.id!)} className="btn btn-secondary p-2.5 rounded-xl hover:text-blue-600">
                                <FileSearch className="w-4.5 h-4.5" />
                             </button>
                             {slip.status === SlipStatus.PENDING_VALIDATION && isCaissier && (
                               <button onClick={() => handleValidateSlip(slip.id!)} className="btn btn-primary bg-amber-500 hover:bg-amber-600 text-[10px] uppercase font-black tracking-widest py-2.5">
                                  Valider
                               </button>
                             )}
                             {slip.status === SlipStatus.VALIDATED && canExecute(slip.type) && (
                               <button onClick={() => handleExecuteSlip(slip.id!)} className="btn btn-primary bg-blue-600 hover:bg-blue-700 text-[10px] uppercase font-black tracking-widest py-2.5">
                                  Exécuter
                               </button>
                             )}
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Creation Modal - Multi Step Workflow */}
      <AnimatePresence>
         {isModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-neutral-900/60 backdrop-blur-xl">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }} 
                className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                 {/* Step Indicator */}
                 <div className="bg-neutral-950 p-8 text-white border-b border-white/5">
                    <div className="flex items-center justify-between mb-8">
                       <div>
                          <h2 className="text-2xl font-display font-bold tracking-tighter">Nouveau Bordereau</h2>
                          <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest mt-1">Saisie Administrative</p>
                       </div>
                       <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
                          <XCircle className="w-6 h-6 text-neutral-500" />
                       </button>
                    </div>
                    
                    <div className="flex items-center justify-between relative px-2">
                       <div className="absolute top-1/2 left-0 w-full h-0.5 bg-neutral-800 -translate-y-1/2 z-0" />
                       {steps.map(step => {
                         const Icon = step.icon;
                         const isPast = currentStep > step.n;
                         const isCurrent = currentStep === step.n;
                         
                         return (
                           <div key={step.n} className="relative z-10 flex flex-col items-center gap-2">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 border-2",
                                isCurrent ? "bg-white text-neutral-950 border-white" :
                                isPast ? "bg-blue-600 text-white border-blue-600" : "bg-neutral-950 text-neutral-700 border-neutral-800"
                              )}>
                                 {isPast ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                              </div>
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest",
                                isCurrent ? "text-white" : "text-neutral-600"
                              )}>{step.title}</span>
                           </div>
                         );
                       })}
                    </div>
                 </div>

                 <div className="flex-1 overflow-y-auto p-10 bg-neutral-50/30 custom-scrollbar">
                    <AnimatePresence mode="wait">
                       {currentStep === 1 && (
                         <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                            <div className="space-y-2">
                               <label className="text-[11px] font-black uppercase text-neutral-400 tracking-widest">Type d'opération</label>
                               <div className="grid grid-cols-2 gap-3">
                                  {Object.values(SlipType).map(t => (
                                    <button 
                                      key={t}
                                      type="button" 
                                      onClick={() => setFormData({...formData, type: t})}
                                      className={cn(
                                        "p-4 rounded-2xl border-2 text-left transition-all group",
                                        formData.type === t ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-neutral-100 hover:border-blue-100 text-neutral-600"
                                      )}
                                    >
                                       <span className="text-[9px] font-black uppercase tracking-widest opacity-60 block mb-1">Nature</span>
                                       <span className="text-xs font-bold leading-tight uppercase line-clamp-1">{t.replace('_', ' ')}</span>
                                    </button>
                                  ))}
                               </div>
                            </div>
                         </motion.div>
                       )}

                       {currentStep === 2 && (
                         <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="text-xs font-bold text-neutral-700">Montant</label>
                                  <input 
                                    type="number" 
                                    className="input text-xl font-display font-black text-blue-600" 
                                    value={formData.amount || ''} 
                                    onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                                    placeholder="0.00"
                                  />
                               </div>
                               <div className="space-y-2">
                                  <label className="text-xs font-bold text-neutral-700">Devise</label>
                                  <div className="flex gap-2">
                                     {Object.values(Currency).map(c => (
                                       <button 
                                         key={c}
                                         type="button"
                                         onClick={() => setFormData({...formData, currency: c})}
                                         className={cn(
                                           "flex-1 py-3 rounded-xl border-2 font-bold transition-all",
                                           formData.currency === c ? "bg-neutral-900 text-white border-neutral-900" : "bg-white border-neutral-100 text-neutral-400"
                                         )}
                                       >
                                          {c}
                                       </button>
                                     ))}
                                  </div>
                               </div>
                            </div>

                            <div className="space-y-2">
                               <label className="text-xs font-bold text-neutral-700">Libellé / Motif</label>
                               <textarea 
                                 className="input min-h-[120px] bg-white resize-none" 
                                 placeholder="Détails précis de l'opération..."
                                 value={formData.description}
                                 onChange={e => setFormData({...formData, description: e.target.value})}
                               />
                            </div>

                            <div className="space-y-2">
                               <label className="text-xs font-bold text-neutral-700">Preuve (Capture/Scan)</label>
                               <label className="flex items-center justify-center p-8 border-2 border-dashed border-neutral-200 rounded-3xl bg-white hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer group relative overflow-hidden h-40">
                                  {formData.proofUrl ? (
                                    <img src={formData.proofUrl} className="absolute inset-0 w-full h-full object-cover" />
                                  ) : (
                                    <div className="flex flex-col items-center">
                                       <ImageIcon className="w-8 h-8 text-neutral-300 group-hover:text-blue-500 mb-2" />
                                       <span className="text-[10px] font-black uppercase text-neutral-400">Importer une image</span>
                                    </div>
                                  )}
                                  <input type="file" className="hidden" onChange={handleProofUpload} accept="image/*" />
                               </label>
                            </div>

                            <div className="p-6 rounded-3xl bg-neutral-900 text-white shadow-xl">
                               <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-2">
                                     <Percent className="w-4 h-4 text-blue-400" />
                                     <span className="text-xs font-black uppercase tracking-widest text-neutral-400">Commission</span>
                                  </div>
                                  <button 
                                     type="button"
                                     onClick={() => setFormData({...formData, discountRequested: !formData.discountRequested})}
                                     className={cn(
                                       "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all",
                                       formData.discountRequested ? "bg-blue-600 border-blue-600 text-white" : "bg-white/5 border-white/10 text-blue-400"
                                     )}
                                  >
                                     <TrendingDown className="w-3 h-3" />
                                     <span className="text-[9px] font-black uppercase tracking-widest">Réduction</span>
                                  </button>
                               </div>

                               <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                     {formData.discountRequested ? (
                                       <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
                                          <input 
                                            type="number" 
                                            className="w-20 bg-white border-none rounded-xl px-3 py-2 text-sm font-black text-neutral-900 focus:ring-2 focus:ring-blue-500"
                                            value={formData.commissionRate}
                                            onChange={e => setFormData({...formData, commissionRate: Number(e.target.value)})}
                                          />
                                          <span className="text-blue-400 font-bold">%</span>
                                       </div>
                                     ) : (
                                       <span className="text-2xl font-display font-black">{formData.commissionRate}% <span className="text-[10px] text-neutral-500 font-mono">(standard)</span></span>
                                     )}
                                  </div>
                                  <div className="text-right">
                                     <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Frais</p>
                                     <p className="text-xl font-display font-black text-blue-400">{formatCurrency(formData.commissionAmount, formData.currency)}</p>
                                  </div>
                               </div>

                               {formData.discountRequested && (
                                 <div className="mt-4 pt-4 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                                    <input 
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-medium focus:ring-1 focus:ring-blue-500 outline-none placeholder:text-neutral-600"
                                      placeholder="Raison de la réduction exceptionnelle..."
                                      value={formData.discountReason}
                                      onChange={e => setFormData({...formData, discountReason: e.target.value})}
                                    />
                                 </div>
                               )}
                            </div>
                         </motion.div>
                       )}

                       {currentStep === 3 && (
                         <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                            <div className="flex items-center justify-between">
                               <div className="flex flex-col">
                                  <span className="text-xl font-display font-black text-neutral-800">Billetage</span>
                                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Dépôt physique</span>
                               </div>
                               <button type="button" onClick={() => setBilletageInput([...billetageInput, { denomination: 0, count: 0 }])} className="btn btn-secondary border-blue-100 text-blue-600 bg-blue-50/50 text-[10px] uppercase font-black px-4">
                                  + Ajouter
                               </button>
                            </div>

                            <div className="space-y-2 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                               {billetageInput.map((bill, idx) => (
                                 <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-neutral-100 group">
                                    <div className="flex-1 flex items-center gap-2">
                                       <input 
                                         type="number" 
                                         placeholder="Dénomination" 
                                         className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold placeholder:text-neutral-200" 
                                         value={bill.denomination || ''} 
                                         onChange={e => {
                                            const next = [...billetageInput];
                                            next[idx].denomination = Number(e.target.value);
                                            setBilletageInput(next);
                                         }}
                                       />
                                       <span className="text-neutral-300">×</span>
                                       <input 
                                         type="number" 
                                         placeholder="Quantité" 
                                         className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold placeholder:text-neutral-200"
                                         value={bill.count || ''} 
                                         onChange={e => {
                                            const next = [...billetageInput];
                                            next[idx].count = Number(e.target.value);
                                            setBilletageInput(next);
                                         }}
                                       />
                                    </div>
                                    <div className="text-xs font-mono font-black text-neutral-400 min-w-[80px] text-right">
                                       {formatCurrency(bill.denomination * bill.count, formData.currency)}
                                    </div>
                                    <button onClick={() => setBilletageInput(billetageInput.filter((_, i) => i !== idx))} className="p-2 text-neutral-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                       <XCircle className="w-5 h-5" />
                                    </button>
                                 </div>
                               ))}
                            </div>

                            <div className={cn(
                               "p-6 rounded-3xl border-2 transition-all",
                               billetageMatches ? "bg-green-50/50 border-green-100" : "bg-red-50/50 border-red-100"
                            )}>
                               <div className="flex justify-between items-center text-sm mb-4">
                                  <span className="font-bold text-neutral-600">Total Billeté</span>
                                  <span className="font-mono font-black">{formatCurrency(totalBilletage, formData.currency)}</span>
                               </div>
                               <div className="flex justify-between items-center text-sm font-display">
                                  <span className="font-bold text-neutral-600">Différence</span>
                                  <span className={cn("font-black", billetageMatches ? "text-green-600" : "text-red-600")}>
                                     {formatCurrency(totalBilletage - formData.amount, formData.currency)}
                                  </span>
                               </div>
                            </div>
                         </motion.div>
                       )}

                       {currentStep === 4 && (
                         <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                            <div className="p-8 bg-neutral-900 rounded-[2rem] text-white space-y-6 shadow-2xl">
                               <div className="flex justify-between items-start border-b border-white/10 pb-6">
                                  <div>
                                     <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest mb-1">Montant Opération</p>
                                     <h4 className="text-4xl font-display font-black tracking-tighter">{formatCurrency(formData.amount, formData.currency)}</h4>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest mb-1">Nature</p>
                                     <span className="text-xs font-black uppercase bg-white/10 px-3 py-1 rounded-full text-blue-400">{formData.type.replace('_', ' ')}</span>
                                  </div>
                               </div>
                               
                               <div className="space-y-3">
                                  <div className="flex justify-between text-[11px] font-bold">
                                     <span className="text-neutral-500 italic uppercase">Comptable</span>
                                     <span>{user?.fullName}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px] font-bold">
                                     <span className="text-neutral-500 italic uppercase">Taux Appliqué</span>
                                     <span className={cn(formData.discountRequested ? "text-amber-500" : "text-blue-400")}>
                                       {formData.commissionRate}% {formData.discountRequested && "(Réduit)"}
                                     </span>
                                  </div>
                                  <div className="flex justify-between text-[11px] font-bold">
                                     <span className="text-neutral-500 italic uppercase">Frais Commission</span>
                                     <span className="text-blue-400">+{formatCurrency(formData.commissionAmount, formData.currency)}</span>
                                  </div>
                                  <div className="flex justify-between items-baseline pt-6 border-t border-white/5">
                                     <span className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.2em]">Total Client</span>
                                     <span className="text-3xl font-display font-black text-white">{formatCurrency(formData.totalWithCommission, formData.currency)}</span>
                                  </div>
                               </div>

                               {formData.discountRequested && (
                                 <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                       <AlertTriangle className="w-3 h-3 text-amber-500" />
                                       <span className="text-[10px] font-black uppercase text-amber-500">Demande de Dérogation</span>
                                    </div>
                                    <p className="text-[10px] text-amber-200/60 leading-relaxed italic">Raison: {formData.discountReason || 'Non spécifiée'}</p>
                                 </div>
                               )}
                            </div>

                            <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                               <div className="w-10 h-10 bg-blue-100 flex items-center justify-center rounded-xl">
                                  <ShieldCheck className="w-6 h-6 text-blue-600" />
                                </div>
                               <p className="text-[11px] text-blue-700 font-medium leading-tight italic">
                                 En confirmant, vous certifiez l'exactitude du calcul et la conformité du taux appliqué.
                               </p>
                            </div>

                            <div className="flex items-center gap-4 p-4 bg-neutral-50 border border-neutral-100 rounded-2xl">
                               <div className="flex-1">
                                  <h5 className="text-xs font-bold text-neutral-700">Impression du Bordereau</h5>
                                  <p className="text-[10px] text-neutral-400">Générer un justificatif imprimable après l'émission.</p>
                               </div>
                               <label className="relative inline-flex items-center cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={formData.printAfterCreate}
                                    onChange={e => setFormData({ ...formData, printAfterCreate: e.target.checked })}
                                  />
                                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                               </label>
                            </div>
                         </motion.div>
                       )}
                    </AnimatePresence>
                 </div>

                 <div className="p-8 bg-white border-t border-neutral-100 flex gap-4">
                    {currentStep > 1 && (
                      <button onClick={() => setCurrentStep(currentStep - 1)} className="btn btn-secondary flex-1 h-12 uppercase tracking-widest text-[10px] font-black">Retour</button>
                    )}
                    {currentStep < 4 ? (
                      <button 
                        onClick={() => setCurrentStep(currentStep + 1)} 
                        disabled={(currentStep === 2 && !formData.amount) || (currentStep === 3 && !billetageMatches)}
                        className="btn btn-primary flex-1 h-12 uppercase tracking-[0.2em] text-[10px] font-black italic"
                      >
                         Suivant
                      </button>
                    ) : (
                      <button onClick={handleCreateSlip} className="btn btn-primary flex-1 bg-green-600 hover:bg-green-700 h-12 uppercase tracking-[0.2em] text-[10px] font-black italic">
                         Émettre le bordereau
                      </button>
                    )}
                 </div>
              </motion.div>
           </div>
         )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedSlipId && (
          <SlipDetailModal 
            id={selectedSlipId} 
            onClose={() => setSelectedSlipId(null)} 
            onValidate={(id: number) => handleValidateSlip(id)}
            onExecute={(id: number) => handleExecuteSlip(id)}
            isCaissier={isCaissier}
            canExecute={canExecute}
            onSupervisorValidate={(id: number) => handleSupervisorValidateSlip(id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, trend }: any) {
  const colors: any = {
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100"
  };

  return (
    <div className={cn("card p-6 border-2 transition-all hover:translate-y-[-2px]", colors[color])}>
       <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-sm">
             <Icon className="w-5 h-5" />
          </div>
          <span className="text-3xl font-black font-mono tracking-tighter">{value}</span>
       </div>
       <h4 className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1 italic">{label}</h4>
       <p className="text-[9px] opacity-60 leading-tight">{trend}</p>
    </div>
  );
}

function SlipDetailModal({ id, onClose, onValidate, onExecute, isCaissier, canExecute, onSupervisorValidate }: any) {
  const slip = useLiveQuery(() => db.slips.get(id));
  const { user } = useAuth();
  const comptable = useLiveQuery(() => slip ? db.users.get(slip.comptableId) : null, [slip]);

  if (!slip) return null;

  const isSupervisor = user?.roles.includes(UserRole.SUPERVISEUR) || user?.roles.includes(UserRole.ADMIN_PRINCIPAL);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />
       <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
             <div>
                <h3 className="font-bold text-lg font-serif italic">Bordereau #BOR-{slip.id}</h3>
                <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Détails d'audit complet</p>
             </div>
             <button onClick={onClose} className="text-neutral-300 hover:text-neutral-500">
                <XCircle className="w-6 h-6" />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
             <div className="grid grid-cols-2 gap-4">
                <DetailRow label="Nature" value={slip.type.replace('_', ' ').toUpperCase()} />
                <DetailRow label="Statut" value={slip.status.replace('_', ' ')} highlighted />
                <DetailRow label="Émis par" value={comptable?.fullName || '...'} />
                <DetailRow label="Date Émission" value={formatDate(slip.timestamp)} />
             </div>

             <div className="p-6 bg-neutral-900 rounded-3xl text-white flex items-center justify-between">
                <div>
                   <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1 italic">Valeur Faciale</p>
                   <h4 className="text-3xl font-black font-mono tracking-tighter">{formatCurrency(slip.amount, slip.currency)}</h4>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1 italic">Vérification Billetage</p>
                   <span className="text-green-400 text-xs font-bold uppercase italic flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Certifié Conforme
                   </span>
                </div>
             </div>

             <div className="space-y-4">
                <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest italic border-b border-neutral-100 pb-2">Commission & Frais</h5>
                <div className="grid grid-cols-2 gap-4">
                    <DetailRow label="Taux Appliqué" value={`${slip.commissionRate}% ${slip.discountRequested ? '(Réduit)' : ''}`} />
                    <DetailRow label="Montant Commission" value={formatCurrency(slip.commissionAmount || 0, slip.currency)} />
                    <DetailRow label="Total Calculé" value={formatCurrency(slip.totalWithCommission || slip.amount, slip.currency)} />
                    {slip.discountRequested && (
                      <DetailRow label="Raison Réduction" value={slip.discountReason || 'N/A'} />
                    )}
                </div>
             </div>

             <div className="space-y-4">
                <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest italic border-b border-neutral-100 pb-2">Description / Motif</h5>
                <p className="text-xs text-neutral-600 italic leading-relaxed">"{slip.description}"</p>
             </div>

             {slip.proofUrl && (
               <div className="space-y-4">
                  <h5 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest italic border-b border-neutral-100 pb-2">Pièce Justificative</h5>
                  <img src={slip.proofUrl} className="w-full rounded-2xl border border-neutral-100 shadow-sm" alt="Preuve" />
               </div>
             )}
          </div>

          <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-3">
             <button onClick={onClose} className="btn btn-secondary flex-1 h-12 uppercase tracking-widest text-[10px] font-black">Fermer</button>
             <button 
                onClick={() => window.print()} 
                className="btn btn-secondary flex-1 h-12 uppercase tracking-widest text-[10px] font-black border-blue-100 text-blue-600"
             >
                <Printer className="w-4 h-4" /> Imprimer
             </button>
             {slip.status === SlipStatus.PENDING_VALIDATION && isCaissier && (
               <button onClick={() => { onValidate(slip.id!); onClose(); }} className="btn btn-primary flex-1 bg-amber-500 hover:bg-amber-600 h-12 uppercase tracking-widest text-[10px] font-black">Valider</button>
             )}
             {slip.status === SlipStatus.PENDING_SUPERVISOR && isSupervisor && (
               <button onClick={() => { onSupervisorValidate(slip.id!); onClose(); }} className="btn btn-primary flex-1 bg-purple-600 hover:bg-purple-700 h-12 uppercase tracking-widest text-[10px] font-black italic">Validation Superviseur</button>
             )}
             {slip.status === SlipStatus.VALIDATED && canExecute(slip.type) && (
               <button onClick={() => { onExecute(slip.id!); onClose(); }} className="btn btn-primary flex-1 bg-blue-600 hover:bg-blue-700 h-12 uppercase tracking-widest text-[10px] font-black italic">Exécuter</button>
             )}
          </div>
       </motion.div>
    </div>
  );
}

function DetailRow({ label, value, highlighted }: any) {
  return (
    <div className="space-y-1">
       <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest italic">{label}</p>
       <p className={cn("text-xs font-bold", highlighted ? "text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block" : "text-neutral-700")}>{value}</p>
    </div>
  );
}
