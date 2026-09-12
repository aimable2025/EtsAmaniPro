import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  FileText, 
  Plus, 
  History, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  Save, 
  Trash2,
  AlertCircle,
  Eye,
  Settings,
  ShieldCheck,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RegulationService } from '../services/RegulationService';
import { Regulation, RegulationAcceptance, UserRole } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function RegulationPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'tracking' | 'editor'>('current');
  const [isNewSectionModalOpen, setIsNewSectionModalOpen] = useState(false);
  const [editingRegulation, setEditingRegulation] = useState<{
    title: string;
    sections: { title: string; content: string }[];
  }>({
    title: "RÈGLEMENT D'ORDRE INTÉRIEUR - ETS AMANI",
    sections: [
      { title: "Discipline Générale", content: "" },
      { title: "Gestion de la Caisse", content: "" },
      { title: "Sécurité & Confidentialité", content: "" },
      { title: "Sanctions", content: "" }
    ]
  });

  const activeRegulation = useLiveQuery(() => RegulationService.getActiveRegulation());
  const allVersions = useLiveQuery(() => RegulationService.getAllVersions());
  const allUsers = useLiveQuery(() => db.users.toArray());
  const allAcceptances = useLiveQuery(() => db.regulationAcceptances.toArray());

  const isAdminPrincipal = user?.roles.includes(UserRole.ADMIN_PRINCIPAL);

  const handleCreateVersion = async () => {
    if (!user?.id || !isAdminPrincipal) return;
    if (editingRegulation.sections.some(s => !s.content.trim())) {
      alert("Veuillez remplir toutes les sections.");
      return;
    }

    if (confirm("La création d'une nouvelle version forcera TOUS les utilisateurs à relire et accepter le règlement dès leur prochaine action. Continuer ?")) {
      await RegulationService.createNewVersion(editingRegulation.title, editingRegulation.sections, user.id);
      setActiveTab('current');
    }
  };

  const getAcceptanceStatus = (userId: number, regId: number, version: number) => {
    const acceptance = allAcceptances?.find(a => a.userId === userId && a.regulationId === regId && a.version === version);
    return acceptance ? { accepted: true, date: acceptance.acceptedAt } : { accepted: false };
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 font-serif italic">Règlement d'Ordre Intérieur</h1>
          <p className="text-neutral-500 italic">Cadre légal et disciplinaire d'Ets Amani.</p>
        </div>
        {isAdminPrincipal && (
          <button 
            onClick={() => setActiveTab('editor')}
            className="btn btn-primary h-12 px-6 shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-5 h-5" />
            Nouvelle Version
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-neutral-200/50 rounded-2xl w-fit">
        <TabButton 
          active={activeTab === 'current'} 
          onClick={() => setActiveTab('current')} 
          icon={ShieldCheck} 
          label="Version Active" 
        />
        <TabButton 
          active={activeTab === 'history'} 
          onClick={() => setActiveTab('history')} 
          icon={History} 
          label="Historique" 
        />
        {isAdminPrincipal && (
          <TabButton 
            active={activeTab === 'tracking'} 
            onClick={() => setActiveTab('tracking')} 
            icon={UserCheck} 
            label="Suivi Signatures" 
          />
        )}
        {isAdminPrincipal && activeTab === 'editor' && (
          <TabButton 
            active={activeTab === 'editor'} 
            onClick={() => setActiveTab('editor')} 
            icon={Settings} 
            label="Éditeur" 
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'current' && (
            <div className="bg-white rounded-3xl shadow-xl border border-neutral-100 overflow-hidden">
              {activeRegulation ? (
                <div className="flex flex-col h-full">
                  <div className="p-8 border-b border-neutral-100 bg-neutral-900 text-white">
                    <div className="flex items-center justify-between mb-4">
                      <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full border border-green-500/20 text-[10px] font-black uppercase tracking-widest">
                        Document Officiel Actif
                      </div>
                      <span className="text-xs font-mono text-neutral-400">v{activeRegulation.version}.0</span>
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">{activeRegulation.title}</h2>
                    <p className="text-sm text-neutral-400 mt-2 italic">Dernière mise à jour : {format(activeRegulation.createdAt, "dd MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
                  </div>
                  <div className="p-8 space-y-8 max-h-[600px] overflow-y-auto custom-scrollbar">
                    {activeRegulation.sections.map((section, idx) => (
                      <div key={idx} className="space-y-4">
                        <h3 className="text-lg font-black text-neutral-900 flex items-center gap-3">
                          <span className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-xs">{(idx+1).toString().padStart(2, '0')}</span>
                          {section.title}
                        </h3>
                        <p className="pl-11 text-neutral-600 leading-relaxed whitespace-pre-wrap font-medium">
                          {section.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-10 h-10 text-neutral-300" />
                  </div>
                  <div className="max-w-xs mx-auto">
                    <h3 className="text-lg font-bold">Aucun règlement actif</h3>
                    <p className="text-sm text-neutral-500 mt-2">L'administrateur n'a pas encore publié de règlement officiel.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {allVersions?.map(version => (
                <div key={version.id} className="card p-6 flex items-center justify-between group hover:border-blue-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all",
                      version.isActive ? "bg-green-600 text-white shadow-green-500/20" : "bg-neutral-100 text-neutral-400"
                    )}>
                      {version.isActive ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-neutral-900">v{version.version}.0 - {version.title}</h3>
                      <p className="text-xs text-neutral-500">Publié le {format(version.createdAt, 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                  </div>
                  <button className="p-2 rounded-xl bg-neutral-50 text-neutral-400 hover:bg-neutral-900 hover:text-white transition-all">
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tracking' && activeRegulation && (
            <div className="card overflow-hidden">
               <div className="p-4 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input type="text" placeholder="Rechercher un collaborateur..." className="input pl-10 h-10 text-xs" />
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-green-500" /> Signé
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-red-500" /> En attente
                    </div>
                  </div>
               </div>
               <table className="w-full text-left">
                 <thead>
                   <tr className="bg-neutral-50 text-[10px] uppercase font-bold text-neutral-500 border-b border-neutral-100">
                     <th className="px-6 py-3">Collaborateur</th>
                     <th className="px-6 py-3">Statut Signature</th>
                     <th className="px-6 py-3">Date d'Acceptation</th>
                     <th className="px-6 py-3 text-right">Détails</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-neutral-50">
                   {allUsers?.filter(u => u.roles[0] !== UserRole.ADMIN_PRINCIPAL).map(u => {
                      const status = getAcceptanceStatus(u.id!, activeRegulation.id!, activeRegulation.version);
                      return (
                        <tr key={u.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center font-bold text-xs uppercase">
                                {u.username.substring(0, 2)}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-neutral-900">{u.fullName}</p>
                                <p className="text-[10px] text-neutral-500 uppercase tracking-tighter">{u.roles[0]}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {status.accepted ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold border border-green-100">
                                <CheckCircle2 className="w-3 h-3" /> SIGNÉ
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-[10px] font-bold border border-red-100">
                                <Clock className="w-3 h-3" /> EN ATTENTE
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-mono text-neutral-500">
                              {status.date ? format(status.date, 'dd/MM/yyyy HH:mm') : '---'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <button className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">Savoir plus</button>
                          </td>
                        </tr>
                      );
                   })}
                 </tbody>
               </table>
            </div>
          )}

          {activeTab === 'editor' && isAdminPrincipal && (
            <div className="bg-white rounded-3xl shadow-xl border border-neutral-100 overflow-hidden flex flex-col h-[700px]">
               <div className="p-6 bg-neutral-900 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                      <Save className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-black uppercase tracking-tight">Configuration Nouveau Règlement</h2>
                  </div>
                  <button onClick={handleCreateVersion} className="btn h-10 bg-white text-neutral-900 hover:bg-neutral-100 uppercase tracking-widest text-[10px] font-black">
                     Publier v{(allVersions?.length || 0) + 1}.0
                  </button>
               </div>
               
               <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-neutral-50/30">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Titre du Document</label>
                    <input 
                      type="text" 
                      className="input h-14 rounded-2xl text-lg font-bold" 
                      value={editingRegulation.title}
                      onChange={e => setEditingRegulation({...editingRegulation, title: e.target.value})}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Sections du Règlement</label>
                      <button 
                        onClick={() => {
                          const newSections = [...editingRegulation.sections, { title: "Nouvelle Section", content: "" }];
                          setEditingRegulation({...editingRegulation, sections: newSections});
                        }}
                        className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                      >
                        + Ajouter Section
                      </button>
                    </div>

                    <div className="space-y-6">
                      {editingRegulation.sections.map((section, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={idx} 
                          className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm space-y-3 relative group"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 bg-neutral-900 text-white rounded flex items-center justify-center text-[10px] font-black">{idx + 1}</span>
                            <input 
                              type="text" 
                              className="bg-transparent border-none outline-none font-bold text-neutral-800 flex-1 uppercase tracking-wider" 
                              value={section.title}
                              onChange={e => {
                                const s = [...editingRegulation.sections];
                                s[idx].title = e.target.value;
                                setEditingRegulation({...editingRegulation, sections: s});
                              }}
                            />
                            <button 
                              onClick={() => {
                                const s = editingRegulation.sections.filter((_, i) => i !== idx);
                                setEditingRegulation({...editingRegulation, sections: s});
                              }}
                              className="p-1.5 text-neutral-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <textarea 
                            className="input min-h-[150px] rounded-xl text-sm font-medium leading-relaxed resize-none pt-4 bg-neutral-50/50 border-none focus:bg-white"
                            placeholder="Contenu de la section..."
                            value={section.content}
                            onChange={e => {
                              const s = [...editingRegulation.sections];
                              s[idx].content = e.target.value;
                              setEditingRegulation({...editingRegulation, sections: s});
                            }}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="card p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white overflow-hidden relative">
            <ShieldCheck className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 rotate-12" />
            <div className="relative z-10 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest opacity-80">Résumé signatures</h3>
              <div className="flex items-end gap-3">
                 <div className="text-4xl font-black">
                   {allAcceptances?.filter(a => a.regulationId === activeRegulation?.id).length || 0}
                 </div>
                 <div className="mb-1 text-xs opacity-60">Signatures collectées</div>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-1000" 
                  style={{ width: `${(allAcceptances?.filter(a => a.regulationId === activeRegulation?.id).length || 0) / (allUsers?.length || 1) * 100}%` }}
                />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                Couverture : {Math.round(((allAcceptances?.filter(a => a.regulationId === activeRegulation?.id).length || 0) / (allUsers?.length || 1)) * 100)}% du réseau
              </p>
            </div>
          </div>

          <div className="card p-6 space-y-6">
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 font-mono italic flex items-center gap-2">
               <AlertCircle className="w-3 h-3" /> Rappels Importants
             </h3>
             <ul className="space-y-4">
               <li className="flex gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                 <p className="text-xs text-neutral-600 leading-relaxed">
                   Toute nouvelle version annule la validité de la précédente et bloque les accès jusqu'à nouvelle signature.
                 </p>
               </li>
               <li className="flex gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                 <p className="text-xs text-neutral-600 leading-relaxed">
                   Le règlement est stocké dans la base <b>IndexedDB</b> locale pour une consultation permanente, même hors-ligne.
                 </p>
               </li>
               <li className="flex gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                 <p className="text-xs text-neutral-600 leading-relaxed">
                   Les signatures sont horodatées et incluent l'agent utilisateur (navigateur/appareil) pour une traçabilité juridique.
                 </p>
               </li>
             </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
        active 
          ? "bg-white text-neutral-900 shadow-md" 
          : "text-neutral-500 hover:text-neutral-700"
      )}
    >
      <Icon className={cn("w-4 h-4", active ? "text-blue-600" : "text-neutral-400")} />
      {label}
    </button>
  );
}
