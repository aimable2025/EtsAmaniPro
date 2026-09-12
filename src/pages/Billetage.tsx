import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { Currency } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { Coins, CheckCircle2, AlertCircle, Save, History, Landmark } from 'lucide-react';
import { motion } from 'motion/react';
import { DetectionService } from '../services/DetectionService';

const USD_DENOMINATIONS = [100, 50, 20, 10, 5, 2, 1];
const CDF_DENOMINATIONS = [20000, 10000, 5000, 2000, 1000, 500, 200, 100];

export default function BilletagePage() {
  const { user } = useAuth();
  const [currency, setCurrency] = useState<Currency>(Currency.USD);
  const [counts, setCounts] = useState<{ [key: string]: number }>({});
  const [selectedAgencyId, setSelectedAgencyId] = useState<number>(user?.agencyId || 0);

  const agencies = useLiveQuery(() => db.agencies.toArray());
  const pastBilletages = useLiveQuery(() => 
    db.billetages.orderBy('timestamp').reverse().limit(5).toArray()
  );

  const currentDenominations = currency === Currency.USD ? USD_DENOMINATIONS : CDF_DENOMINATIONS;

  const total = useMemo(() => {
    return Object.entries(counts).reduce((sum, [denom, count]) => {
      return sum + (Number(denom) * count);
    }, 0);
  }, [counts]);

  const handleSave = async () => {
    if (!selectedAgencyId) return alert('Veuillez sélectionner une agence.');
    if (total === 0) return alert('Le montant total doit être supérieur à zéro.');

    const billetage = {
      agencyId: selectedAgencyId,
      userId: user?.id!,
      timestamp: Date.now(),
      currency,
      details: Object.entries(counts).map(([denom, count]) => ({
        denomination: Number(denom),
        count: Number(count)
      })),
      total
    };

    await db.billetages.add(billetage);
    
    if (user) {
      await DetectionService.checkBilletageAnomaly({
        agencyId: selectedAgencyId,
        userId: user.id!,
        declaredTotal: total,
        calculatedTotal: agencyBalance,
        currency: currency
      });
    }

    await db.auditLogs.add({
      userId: user?.id!,
      action: 'BILLETAGE',
      details: `Saisie de billetage ${currency} pour un total de ${formatCurrency(total, currency)}`,
      timestamp: Date.now()
    });

    alert('Billetage enregistré avec succès.');
    setCounts({});
  };

  const agencyBalance = useMemo(() => {
    if (!selectedAgencyId || !agencies) return 0;
    const agency = agencies.find(a => a.id === selectedAgencyId);
    return agency?.currentBalances[currency] || 0;
  }, [selectedAgencyId, agencies, currency]);

  const exportCSV = () => {
    if (total === 0) return alert('Le montant total doit être supérieur à zéro pour exporter.');
    
    const agency = agencies?.find(a => a.id === selectedAgencyId);
    const agencyName = agency?.name || 'Inconnue';

    const csvRows = [
      ['Denomination', 'Quantite', 'Total'].join(',')
    ];

    currentDenominations.forEach(denom => {
      const count = counts[denom] || 0;
      if (count > 0) {
        csvRows.push([denom, count, denom * count].join(','));
      }
    });

    csvRows.push('');
    csvRows.push(['Total General', '', total].join(','));
    csvRows.push(['Agence', '', `"${agencyName.replace(/"/g, '""')}"`].join(','));
    csvRows.push(['Date', '', new Date().toLocaleString()].join(','));

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AMANI_Billetage_${currency}_${agencyName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const difference = total - agencyBalance;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 font-serif italic">Billetage & Inventaire</h1>
          <p className="text-neutral-500 italic">Comptage physique des fonds en coffre.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
           <button 
             onClick={exportCSV}
             className="btn btn-secondary h-10 px-4 uppercase tracking-widest text-[10px] font-black"
           >
             <History className="w-3.5 h-3.5 mr-2" /> Exporter (.CSV)
           </button>

           <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
              <button 
                onClick={() => setCurrency(Currency.USD)}
                className={cn("h-8 px-5 rounded-lg uppercase tracking-widest text-[10px] font-black transition-all", currency === Currency.USD ? "bg-white text-blue-600 shadow-sm border border-neutral-200" : "text-neutral-500 hover:text-neutral-700")}
              >USD</button>
              <button 
                onClick={() => setCurrency(Currency.CDF)}
                className={cn("h-8 px-5 rounded-lg uppercase tracking-widest text-[10px] font-black transition-all", currency === Currency.CDF ? "bg-white text-blue-600 shadow-sm border border-neutral-200" : "text-neutral-500 hover:text-neutral-700")}
              >CDF</button>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card overflow-hidden">
            <div className="p-6 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <Landmark className="w-5 h-5 text-neutral-400" />
                  <h2 className="text-xs font-black uppercase tracking-widest">Feuille de Comptage - {currency}</h2>
               </div>
               <select 
                 className="bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-xs font-bold"
                 value={selectedAgencyId}
                 onChange={e => setSelectedAgencyId(Number(e.target.value))}
               >
                 <option value="0">Sélectionner Agence</option>
                 {agencies?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
               </select>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {currentDenominations.map((denom) => (
                  <div key={denom} className="flex items-center gap-4 group">
                    <div className="w-20 font-mono font-black text-neutral-400 group-hover:text-blue-600 transition-colors">
                      {formatCurrency(denom, currency).replace(',00', '')}
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <input 
                        type="number" 
                        className="input h-10 text-center font-mono font-bold" 
                        placeholder="0"
                        value={counts[denom] || ''}
                        onChange={e => setCounts({ ...counts, [denom]: Number(e.target.value) })}
                        onFocus={(e) => e.target.select()}
                      />
                      <div className="w-32 text-right font-mono text-sm font-medium text-neutral-400">
                        {counts[denom] ? formatCurrency(denom * counts[denom], currency) : '-'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 bg-neutral-900 text-white flex items-center justify-between">
              <div>
                 <p className="text-[10px] text-neutral-500 uppercase font-black tracking-[0.2em] mb-1">Total Physique de la Caisse</p>
                 <p className="text-3xl font-black font-mono tracking-tighter text-blue-400">{formatCurrency(total, currency)}</p>
              </div>
              <button onClick={handleSave} className="btn h-14 px-10 bg-blue-600 hover:bg-blue-700 text-white border-none shadow-xl shadow-blue-900/40 uppercase tracking-[0.2em] font-black text-sm">
                 <Save className="w-5 h-5 mr-2" /> Valider le Comptage
              </button>
            </div>
          </div>
        </div>

        {/* Comparison & History */}
        <div className="space-y-6">
          <div className="card p-6 border-b-4 border-b-blue-600">
             <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-6">Contrôle de Cohérence</h3>
             <div className="space-y-6">
                <div className="flex justify-between items-end border-b border-neutral-100 pb-2">
                   <span className="text-xs font-medium text-neutral-500">Solde théorique (Système)</span>
                   <span className="font-mono font-bold text-neutral-800">{formatCurrency(agencyBalance, currency)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-neutral-100 pb-2">
                   <span className="text-xs font-medium text-neutral-500">Solde physique (Compté)</span>
                   <span className="font-mono font-bold text-neutral-800">{formatCurrency(total, currency)}</span>
                </div>
                <div className="pt-2 flex flex-col items-center justify-center p-6 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200">
                   <p className="text-[10px] uppercase font-black text-neutral-400 mb-2">Écart Constaté</p>
                   <p className={cn(
                     "text-2xl font-black font-mono",
                     difference === 0 ? "text-green-600" : difference < 0 ? "text-red-600" : "text-blue-600"
                   )}>
                     {difference > 0 ? '+' : ''}{formatCurrency(difference, currency)}
                   </p>
                   <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase py-1 px-3 rounded-full bg-white border border-neutral-200">
                      {difference === 0 ? (
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-red-500" />
                      )}
                      {difference === 0 ? "Caisse Équilibrée" : "Écart de Caisse"}
                   </div>
                </div>
             </div>
          </div>

          <div className="card flex flex-col">
             <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Historique</h3>
                <History className="w-4 h-4 text-neutral-400" />
             </div>
             <div className="divide-y divide-neutral-50">
               {pastBilletages?.map(b => (
                 <div key={b.id} className="p-4 hover:bg-neutral-50 transition-colors">
                    <div className="flex justify-between items-center mb-1">
                       <span className="text-[10px] font-mono font-bold text-blue-600">ID #{b.id}</span>
                       <span className="text-[10px] text-neutral-400 italic">{formatDate(b.timestamp)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-medium text-neutral-700 capitalize">{agencies?.find(a => a.id === b.agencyId)?.name || 'Agence'}</span>
                       <span className="text-sm font-black font-mono">{formatCurrency(b.total, b.currency)}</span>
                    </div>
                 </div>
               ))}
               {(!pastBilletages || pastBilletages.length === 0) && (
                 <p className="p-8 text-center text-xs text-neutral-400 italic">Aucun billetage précédent.</p>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
