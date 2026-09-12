import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, UserStatus } from '../types';
import { formatDate, cn } from '../lib/utils';
import { 
  Users as UsersIcon, 
  UserPlus, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  Search,
  Filter,
  UserCircle,
  ArrowUpRight,
  Pencil,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SyncService } from '../services/SyncService';

export default function Users() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  
  const users = useLiveQuery(() => db.users.toArray());
  const agencies = useLiveQuery(() => db.agencies.toArray());

  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    roles: [UserRole.GUICHETIER] as UserRole[],
    agencyId: 0,
    photoUrl: ''
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // 500KB limit for IndexedDB storage
        alert("L'image est trop volumineuse. Veuillez choisir une image de moins de 500 Ko.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleEditClick = (user: any) => {
    setEditingUserId(user.id);
    setFormData({
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      password: '', // Keep empty for editing unless changed
      roles: user.roles,
      agencyId: user.agencyId,
      photoUrl: user.photoUrl
    });
    setIsModalOpen(true);
  };

  const isAdminPrincipal = currentUser?.roles.includes(UserRole.ADMIN_PRINCIPAL);
  const isSuperAdmin = currentUser?.roles.includes(UserRole.SUPERVISEUR) || currentUser?.roles.includes(UserRole.ADMIN_PRINCIPAL);

  const filteredUsers = users?.filter(u => 
    u.fullName.toLowerCase().includes(search.toLowerCase()) || 
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUserId) {
      const updateData: any = {
        ...formData,
      };
      // Only update password if provided
      if (!formData.password) {
        delete updateData.password;
      }
      
      await db.users.update(editingUserId, updateData);
      
      await db.auditLogs.add({
        userId: currentUser?.id!,
        action: 'EDITION_UTILISATEUR',
        details: `Modification du compte ${formData.username}`,
        timestamp: Date.now()
      });
    } else {
      await db.users.add({
        ...formData,
        status: UserStatus.PENDING,
        createdAt: Date.now()
      });
      
      await db.auditLogs.add({
        userId: currentUser?.id!,
        action: 'CREATION_UTILISATEUR',
        details: `Création du compte ${formData.username}`,
        timestamp: Date.now()
      });
    }

    handleCloseModal();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
    setFormData({
      username: '', fullName: '', email: '', phone: '', password: '', roles: [UserRole.GUICHETIER], agencyId: 0, photoUrl: ''
    });
  };

  const handleStatusChange = async (userId: number, status: UserStatus) => {
    await db.users.update(userId, { status });
    await db.auditLogs.add({
      userId: currentUser?.id!,
      action: 'CHANGEMENT_STATUT_UTILISATEUR',
      details: `Statut utilisateur #${userId} mis à jour vers ${status}`,
      timestamp: Date.now()
    });
  };

  const handleDeleteUser = async (userId: number) => {
    if (userId === currentUser?.id) return alert("Vous ne pouvez pas supprimer votre propre compte administrateur.");
    
    await db.users.delete(userId);
    await db.auditLogs.add({
      userId: currentUser?.id!,
      action: 'SUPPRESSION_UTILISATEUR',
      details: `Suppression du compte utilisateur #${userId}`,
      timestamp: Date.now()
    });
    setDeleteConfirmId(null);
  };

  const [isResettingAll, setIsResettingAll] = useState(false);
  const handleResetAllUsers = async () => {
    if (window.confirm("ACTION CRITIQUE :\nVoulez-vous vraiment supprimer et réinitialiser TOUS les comptes utilisateurs d'Ets Amani ?\nCette opération effacera tous les comptes enregistrés et vous redirigera vers l'inscription pour établir le nouvel Administrateur Principal.")) {
      setIsResettingAll(true);
      try {
        await SyncService.resetAllUsers();
        window.location.href = '/register';
      } catch (err) {
        alert("Erreur lors de la réinitialisation : " + (err as Error).message);
        setIsResettingAll(false);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 font-serif italic">Gestion du Personnel</h1>
          <p className="text-neutral-500 italic">Contrôle des accès, rôles et validations système Ets Amani.</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdminPrincipal && (
            <button 
              onClick={handleResetAllUsers}
              disabled={isResettingAll}
              className="btn bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 h-12 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
              title="Supprimer tous les comptes utilisateurs pour réinitialiser le système"
            >
              <Trash2 className="w-4 h-4" />
              {isResettingAll ? "Réinitialisation..." : "Réinitialiser tous les comptes"}
            </button>
          )}
          <button 
            onClick={() => setIsModalOpen(true)} 
            className={cn(
              "btn btn-primary h-12 shadow-lg shadow-blue-600/20",
              !isAdminPrincipal && "opacity-50 cursor-not-allowed pointer-events-none"
            )}
            disabled={!isAdminPrincipal}
          >
            <UserPlus className="w-5 h-5" />
            Nouveau Collaborateur
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
           <input 
             type="text" 
             placeholder="Rechercher par nom ou identifiant..." 
             className="input pl-10"
             value={search}
             onChange={(e) => setSearch(e.target.value)}
           />
        </div>
        <div className="flex gap-2 text-xs font-bold font-mono text-neutral-400 uppercase tracking-widest">
           <span className="px-3 py-1 bg-neutral-100 rounded-full border border-neutral-200 text-neutral-700">Total: {users?.length || 0}</span>
           <span className="px-3 py-1 bg-yellow-50 rounded-full border border-yellow-100 text-yellow-700">En attente: {users?.filter(u => u.status === UserStatus.PENDING).length || 0}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {filteredUsers?.map((user) => (
          <div key={user.id} className="card group hover:border-blue-500/50 transition-all">
            <div className="p-6">
               <div className="flex items-start gap-4 mb-6">
                 <div className="w-16 h-16 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center relative shadow-sm">
                    {user.photoUrl ? (
                      <img src={user.photoUrl} alt="" className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      <UserCircle className="w-10 h-10 text-neutral-300" />
                    )}
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center",
                      user.status === UserStatus.ACTIVE ? "bg-green-500" : user.status === UserStatus.PENDING ? "bg-yellow-500" : "bg-red-500"
                    )}>
                       {user.status === UserStatus.ACTIVE ? <CheckCircle className="w-3 h-3 text-white" /> : <ShieldAlert className="w-3 h-3 text-white" />}
                    </div>
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                       <h3 className="font-bold text-lg text-neutral-900 truncate">{user.fullName}</h3>
                       {isAdminPrincipal && (
                         <button 
                           onClick={() => handleEditClick(user)}
                           className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                           title="Modifier"
                         >
                           <Pencil className="w-4 h-4" />
                         </button>
                       )}
                    </div>
                    <p className="text-xs text-neutral-400 font-mono italic">@{user.username}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {user.roles.map(role => (
                        <span key={role} className="text-[9px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-bold uppercase tracking-widest border border-blue-100">
                          {role.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                 </div>
               </div>

               <div className="space-y-3 py-4 border-y border-neutral-50 mb-4">
                  <div className="flex items-center justify-between text-xs">
                     <span className="text-neutral-400 font-medium">Agence</span>
                     <span className="font-bold text-neutral-700">{agencies?.find(a => a.id === user.agencyId)?.name || 'Non assigné'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                     <span className="text-neutral-400 font-medium">Contact</span>
                     <span className="font-mono">{user.phone}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                     <span className="text-neutral-400 font-medium">Inscrit le</span>
                     <span className="text-neutral-500 font-mono italic">{formatDate(user.createdAt)}</span>
                  </div>
               </div>

                <div className="flex gap-2">
                  {user.status === UserStatus.PENDING && isAdminPrincipal && (
                    <>
                     <button 
                       onClick={() => handleStatusChange(user.id!, UserStatus.ACTIVE)}
                       className="flex-1 btn bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 text-xs py-2 shadow-sm shadow-green-100"
                     >
                       <ShieldCheck className="w-4 h-4" /> Autoriser
                     </button>
                     <button 
                       onClick={() => setDeleteConfirmId(user.id!)}
                       className="flex-1 btn bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs py-2 shadow-sm shadow-red-100"
                     >
                       <XCircle className="w-4 h-4" /> Supprimer
                     </button>
                    </>
                  )}
                  {user.status === UserStatus.ACTIVE && isAdminPrincipal && user.id !== currentUser?.id && (
                     <div className="flex w-full gap-2">
                        <button 
                          onClick={() => handleStatusChange(user.id!, UserStatus.PENDING)}
                          className="flex-1 btn btn-secondary text-xs text-neutral-400 hover:text-yellow-600 transition-all py-2"
                        >
                          Suspendre
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmId(user.id!)}
                          className="flex-1 btn btn-secondary text-xs text-neutral-400 hover:text-red-600 transition-all py-2"
                        >
                          Supprimer
                        </button>
                     </div>
                  )}
               </div>
            </div>
          </div>
        ))}
        {(!filteredUsers || filteredUsers.length === 0) && (
          <div className="col-span-full p-12 card border-dashed border-2 text-center text-neutral-400">
             <UsersIcon className="w-12 h-12 mx-auto mb-4 opacity-10" />
             <p className="italic font-serif">Aucun utilisateur correspondant à votre recherche.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleCloseModal} className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
               <div className="bg-neutral-950 p-6 text-white text-center border-b border-white/10">
                  <h2 className="text-xl font-bold font-serif italic">{editingUserId ? 'Modifier' : 'Nouveau'} Collaborateur</h2>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">Enregistrement système</p>
               </div>
               
               <form onSubmit={handleCreateUser} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                 <div className="flex flex-col items-center gap-4 py-4 border-b border-neutral-50 mb-4">
                    <div className="w-24 h-24 rounded-2xl bg-neutral-100 border-2 border-dashed border-neutral-300 flex items-center justify-center relative overflow-hidden group">
                       {formData.photoUrl ? (
                         <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                       ) : (
                         <UserCircle className="w-12 h-12 text-neutral-300" />
                       )}
                       <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <span className="text-[10px] text-white font-bold uppercase tracking-widest">Changer</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                       </label>
                    </div>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Photo de Profil (Optionnelle)</p>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-neutral-400 uppercase">Pseudo unique</label>
                       <input type="text" className="input" placeholder="Ex: agent_01" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-neutral-400 uppercase">Nom Complet</label>
                       <input type="text" className="input" placeholder="Ex: Jean Dupont" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-neutral-400 uppercase">Téléphone</label>
                       <input type="tel" className="input" placeholder="+243..." required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-neutral-400 uppercase">Rôles (Multiple possible)</label>
                       <div className="grid grid-cols-2 gap-2 h-32 overflow-y-auto border border-neutral-100 p-2 rounded-lg">
                          {Object.values(UserRole).map(role => (
                            <label key={role} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-neutral-50 p-1 rounded">
                              <input 
                                type="checkbox" 
                                checked={formData.roles.includes(role)} 
                                onChange={(e) => {
                                  const newRoles = e.target.checked 
                                    ? [...formData.roles, role]
                                    : formData.roles.filter(r => r !== role);
                                  setFormData({...formData, roles: newRoles});
                                }} 
                              />
                              {role.replace('_', ' ').toUpperCase()}
                            </label>
                          ))}
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-neutral-400 uppercase">Agence Affectée</label>
                       <select className="input" value={formData.agencyId} onChange={e => setFormData({...formData, agencyId: Number(e.target.value)})}>
                          <option value="0">Toutes (Admin only)</option>
                          {agencies?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-neutral-400 uppercase">Mot de passe {editingUserId ? '(Laisser vide pour ne pas changer)' : 'initial'}</label>
                       <input type="password" placeholder="••••••••" className="input" required={!editingUserId} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                    </div>
                 </div>

                 {!editingUserId && (
                   <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-xs text-yellow-800 italic">
                      Note: Le compte sera créé avec le statut "En attente". Un Administrateur devra valider les informations avant que l'accès ne soit accordé.
                   </div>
                 )}

                 <div className="flex gap-4 pt-4 border-t border-neutral-100">
                    <button type="button" onClick={handleCloseModal} className="btn btn-secondary flex-1 h-12 uppercase tracking-widest text-xs font-bold">Annuler</button>
                    <button type="submit" className="btn btn-primary flex-1 h-12 shadow-lg shadow-blue-600/20 uppercase tracking-[0.2em] text-xs font-black">
                      {editingUserId ? 'Mettre à jour' : 'Créer le Profil'}
                    </button>
                 </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmId(null)} className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden p-8 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldAlert className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900 mb-2">Confirmer la suppression</h2>
              <p className="text-neutral-500 text-sm mb-8">
                Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ? Cette action est irréversible et supprimera tous les accès associés.
              </p>
              <div className="flex gap-4">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 btn btn-secondary py-3 uppercase tracking-widest text-xs font-bold">Annuler</button>
                <button onClick={() => handleDeleteUser(deleteConfirmId)} className="flex-1 btn bg-red-600 text-white hover:bg-red-700 py-3 uppercase tracking-widest text-xs font-bold shadow-lg shadow-red-600/20">Supprimer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
