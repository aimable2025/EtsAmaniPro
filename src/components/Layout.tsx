import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Coins, 
  Users, 
  Building2, 
  Landmark,
  FileText, 
  Zap,
  MessageSquare, 
  ShieldAlert,
  ShieldX,
  ShieldCheck,
  History, 
  LogOut,
  ChevronRight,
  TrendingDown,
  UserCircle,
  Camera,
  Percent,
  Megaphone,
  X,
  Search,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { UserRole, UserStatus, MessageStatus, Regulation } from '../types';
import { db } from '../db';
import RegulationModal from './RegulationModal';
import { RegulationService } from '../services/RegulationService';

const MENU_GROUPS = [
  {
    title: 'Principal',
    items: [
      { path: '/', label: 'Tableau de bord', icon: LayoutDashboard, roles: Object.values(UserRole) },
      { path: '/operations', label: 'Opérations', icon: Zap, roles: Object.values(UserRole) },
      { path: '/transactions', label: 'Journal des Opérations', icon: ArrowLeftRight, roles: Object.values(UserRole) },
    ]
  },
  {
    title: 'Trésorerie',
    items: [
      { path: '/billetage', label: 'Billetage', icon: Coins, roles: [UserRole.ADMIN_PRINCIPAL, UserRole.ADMIN_AGENCE, UserRole.CAISSIER_PRINCIPAL, UserRole.GUICHETIER, UserRole.AGENT_VODAE] },
      { path: '/banking', label: 'Banques', icon: Landmark, roles: [UserRole.ADMIN_PRINCIPAL, UserRole.SUPERVISEUR, UserRole.COMPTABLE] },
      { path: '/debts', label: 'Dettes & Prêts', icon: TrendingDown, roles: [UserRole.ADMIN_PRINCIPAL, UserRole.SUPERVISEUR, UserRole.COMPTABLE, UserRole.ADMIN_AGENCE] },
    ]
  },
  {
    title: 'Administration',
    items: [
      { path: '/users', label: 'Collaborateurs', icon: Users, roles: [UserRole.ADMIN_PRINCIPAL, UserRole.SUPERVISEUR] },
      { path: '/commissions', label: 'Taux Commissions', icon: Percent, roles: [UserRole.SUPERVISEUR, UserRole.ADMIN_PRINCIPAL] },
      { path: '/agencies', label: 'Agences', icon: Building2, roles: [UserRole.ADMIN_PRINCIPAL, UserRole.SUPERVISEUR] },
      { path: '/alerts', label: 'Alertes Fraude', icon: ShieldAlert, roles: [UserRole.ADMIN_PRINCIPAL, UserRole.SUPERVISEUR] },
      { path: '/reports', label: 'Rapports', icon: FileText, roles: [UserRole.ADMIN_PRINCIPAL, UserRole.SUPERVISEUR, UserRole.COMPTABLE, UserRole.ADMIN_AGENCE] },
      { path: '/audit', label: 'Audit Système', icon: History, roles: [UserRole.ADMIN_PRINCIPAL, UserRole.SUPERVISEUR] },
      { path: '/backup', label: 'Sauvegarde', icon: ShieldCheck, roles: [UserRole.ADMIN_PRINCIPAL, UserRole.SUPERVISEUR] },
      { path: '/regulation', label: 'Règlement Intérieur', icon: FileText, roles: Object.values(UserRole) },
    ]
  },
  {
    title: 'Support',
    items: [
      { path: '/chat', label: 'Communication', icon: MessageSquare, roles: Object.values(UserRole) },
    ]
  }
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const needsRegulationAcceptance = useLiveQuery(async () => {
    if (!user?.id) return false;
    const hasAccepted = await RegulationService.hasAcceptedLatest(user.id);
    return !hasAccepted;
  }, [user?.id]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const unreadMessagesCount = useLiveQuery(async () => {
    if (!user) return 0;
    return await db.messages
      .where('status')
      .anyOf([MessageStatus.SENT, MessageStatus.RECEIVED])
      .and(m => m.senderId !== user.id)
      .count();
  }, [user]);

  const activeAlertsCount = useLiveQuery(async () => {
    if (!user) return 0;
    const isAdmin = user.roles.includes(UserRole.ADMIN_PRINCIPAL) || user.roles.includes(UserRole.SUPERVISEUR);
    if (!isAdmin) return 0;
    return await db.alerts.where('status').equals('active').count();
  }, [user]);

  const liveUser = useLiveQuery(async () => {
    if (!user?.id) return null;
    return await db.users.get(user.id);
  }, [user?.id]);

  const profilePhoto = liveUser?.photoUrl || user?.photoUrl;

  const handleProfilePictureUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user?.id) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const photoUrl = reader.result as string;
        await db.users.update(user.id!, { photoUrl });
        login({ ...user, photoUrl });
      };
      reader.readAsDataURL(file);
    }
  };

  const isAdmin = user?.roles.includes(UserRole.ADMIN_PRINCIPAL) || user?.roles.includes(UserRole.SUPERVISEUR);
  const pendingUsersCount = useLiveQuery(async () => {
    if (!isAdmin) return 0;
    return await db.users.where('status').equals(UserStatus.PENDING).count();
  }, [isAdmin]);

  const globalRate = useLiveQuery(async () => {
    const rate = await db.settings.get('exchange_rate');
    return rate?.value || 2850;
  });

  const handleRateUpdate = async () => {
    if (!user?.roles.includes(UserRole.SUPERVISEUR)) return;
    const newRate = prompt("Nouveau taux de change USD/CDF:", String(globalRate));
    if (newRate && !isNaN(Number(newRate))) {
      await db.settings.put({ key: 'exchange_rate', value: Number(newRate) });
    }
  };

  const announcement = useLiveQuery(async () => {
    return await db.settings.get('global_announcement');
  });

  const handleAnnouncementUpdate = async () => {
    if (!user?.roles.includes(UserRole.SUPERVISEUR)) return;
    const current = typeof announcement?.value === 'string' ? announcement.value : (announcement?.value?.message || '');
    const newMessage = prompt("Message d'annonce globale (laisser vide pour supprimer) :", current);
    
    if (newMessage === null) return;
    
    if (newMessage.trim() === '') {
      await db.settings.delete('global_announcement');
    } else {
      await db.settings.put({ 
        key: 'global_announcement', 
        value: {
          message: newMessage,
          updatedAt: Date.now(),
          updatedBy: user.fullName
        }
      });
    }
  };

  // Global Search Logic
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    type: 'user' | 'transaction' | 'report' | 'message' | 'agency';
    id: number | string;
    title: string;
    subtitle: string;
    target: string;
    icon: any;
  }[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      const q = searchQuery.toLowerCase();
      const results: any[] = [];

      // Search Users
      const users = await db.users
        .filter(u => 
          u.fullName.toLowerCase().includes(q) || 
          u.email.toLowerCase().includes(q) ||
          String(u.id).includes(q)
        )
        .limit(5)
        .toArray();
      users.forEach(u => results.push({
        type: 'user',
        id: u.id,
        title: u.fullName,
        subtitle: `Collaborateur • ${u.roles[0].replace('_', ' ')}`,
        target: '/users',
        icon: Users
      }));

      // Search Transactions (Slips)
      const slips = await db.slips
        .filter(s => 
          (s.description?.toLowerCase().includes(q) || false) ||
          String(s.id).includes(q)
        )
        .limit(5)
        .toArray();
      slips.forEach(s => results.push({
        type: 'transaction',
        id: s.id,
        title: `Bordereau #${s.id} - ${s.type.replace(/_/g, ' ').toUpperCase()}`,
        subtitle: `${s.description || 'Pas de description'} • ${s.amount.toLocaleString()} ${s.currency}`,
        target: '/transactions',
        icon: ArrowLeftRight
      }));

      // Search Agencies
      const agencies = await db.agencies
        .filter(a => a.name.toLowerCase().includes(q) || a.location.toLowerCase().includes(q))
        .limit(3)
        .toArray();
      agencies.forEach(a => results.push({
        type: 'agency',
        id: a.id,
        title: a.name,
        subtitle: `Agence • ${a.location}`,
        target: '/agencies',
        icon: Building2
      }));

      // Search Messages
      const messages = await db.messages
        .filter(m => m.content.toLowerCase().includes(q))
        .limit(5)
        .toArray();
      messages.forEach(m => results.push({
        type: 'message',
        id: m.id,
        title: m.content.length > 50 ? m.content.substring(0, 50) + '...' : m.content,
        subtitle: `Message • Envoyé par ${m.senderName}`,
        target: '/chat',
        icon: MessageSquare
      }));

      // Search Reports
      const reports = await db.reports
        .filter(r => r.details.toLowerCase().includes(q) || r.date.includes(q))
        .limit(3)
        .toArray();
      reports.forEach(r => results.push({
        type: 'report',
        id: r.id,
        title: `Rapport du ${r.date}`,
        subtitle: `Audit • Statut: ${r.status.toUpperCase()}`,
        target: '/reports',
        icon: FileText
      }));

      setSearchResults(results);
    };

    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const input = searchContainerRef.current?.querySelector('input');
        input?.focus();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const SidebarContent = () => (
    <>
      <div className="p-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="w-10 h-10 bg-white text-neutral-950 rounded-xl flex items-center justify-center shadow-2xl transition-all duration-500 group-hover:rotate-[10deg]">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-neutral-900 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="font-display font-black text-xl leading-none tracking-tight">Ets Amani</h1>
            <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em] mt-1 font-mono italic">Gestion Financière</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8 custom-scrollbar">
        {MENU_GROUPS.map((group) => {
          const visibleItems = group.items.filter(item => 
            user && item.roles.some(role => user.roles.includes(role))
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="space-y-2">
              <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 font-mono italic">
                {group.title}
              </h3>
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group relative overflow-hidden",
                        isActive 
                          ? "bg-white text-neutral-950 shadow-xl shadow-black/20" 
                          : "text-neutral-500 hover:text-neutral-200 hover:bg-white/5"
                      )}
                    >
                      <Icon className={cn("w-4.5 h-4.5 transition-colors", isActive ? "text-neutral-900" : "group-hover:text-white")} />
                      <span className="font-medium text-sm">{item.label}</span>
                      
                      {item.path === '/chat' && unreadMessagesCount && unreadMessagesCount > 0 ? (
                        <div className="ml-auto px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-lg shadow-lg shadow-red-500/20 animate-pulse">
                          {unreadMessagesCount}
                        </div>
                      ) : item.path === '/alerts' && activeAlertsCount && activeAlertsCount > 0 ? (
                        <div className="ml-auto px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-lg shadow-lg shadow-red-600/20">
                          {activeAlertsCount}
                        </div>
                      ) : item.path === '/users' && pendingUsersCount && pendingUsersCount > 0 ? (
                        <div className="ml-auto px-1.5 py-0.5 bg-blue-500 text-white text-[9px] font-black rounded-lg shadow-lg shadow-blue-500/20">
                          {pendingUsersCount}
                        </div>
                      ) : isActive && (
                        <div className="ml-auto">
                          <div className="w-1 h-1 bg-current rounded-full" />
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-4 bg-neutral-950/50 border-t border-white/5">
        <div className="group relative bg-neutral-900 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-all">
           <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center border border-white/5 overflow-hidden ring-2 ring-white/0 group-hover:ring-white/10 transition-all">
                  {profilePhoto ? (
                    <img 
                      src={profilePhoto} 
                      alt={user?.fullName} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <UserCircle 
                    className={cn(
                      "w-6 h-6 text-neutral-500",
                      profilePhoto ? "hidden" : "flex"
                    )} 
                  />
                </div>
                <label className="absolute -top-1 -right-1 w-5 h-5 bg-white text-neutral-900 rounded-lg flex items-center justify-center border-2 border-neutral-900 cursor-pointer shadow-xl opacity-0 group-hover:opacity-100 transition-all">
                  <Camera className="w-3 h-3" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfilePictureUpdate} />
                </label>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate group-hover:text-blue-400 transition-colors uppercase tracking-tight">{user?.fullName}</p>
                <p className="text-[9px] text-neutral-600 font-mono truncate uppercase tracking-widest mt-0.5">{user?.roles?.[0]?.replace('_', ' ')}</p>
              </div>
           </div>
           <button 
              onClick={handleLogout}
              className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-neutral-500 hover:text-white hover:bg-white/5 transition-all font-bold text-[10px] uppercase tracking-widest"
            >
              <LogOut className="w-3 h-3" />
              Déconnexion
            </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-neutral-50 selection:bg-blue-100 selection:text-blue-900">
      {/* Regulation Modal (Mandatory) */}
      {needsRegulationAcceptance && user?.id && (
        <RegulationModal 
          userId={user.id} 
          onAccept={() => {}} 
        />
      )}

      {/* Mobile Menu Backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-[100] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 bg-neutral-900 text-white flex-col sticky top-0 h-screen shrink-0 border-r border-white/5">
        <SidebarContent />
      </aside>

      {/* Sidebar - Mobile Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 w-[280px] bg-neutral-900 text-white flex flex-col z-[110] lg:hidden border-r border-white/5 shadow-2xl"
          >
            <div className="absolute top-4 right-4 lg:hidden">
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-neutral-200 px-4 md:px-8 flex items-center justify-between shrink-0 sticky top-0 z-[50]">
          <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
            {/* Mobile Toggle */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-neutral-100 text-neutral-500 transition-all"
            >
              <LayoutDashboard className="w-6 h-6" />
            </button>

            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-neutral-500 shrink-0">
              <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-neutral-100 rounded-full border border-neutral-200">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>Offline Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-neutral-400">1 USD =</span>
                <button 
                  onClick={handleRateUpdate}
                  disabled={!user?.roles.includes(UserRole.SUPERVISEUR)}
                  className={cn(
                    "text-neutral-900 font-bold px-2 py-0.5 rounded transition-all",
                    user?.roles.includes(UserRole.SUPERVISEUR) ? "hover:bg-blue-50 hover:text-blue-600 cursor-pointer" : "cursor-default"
                  )}
                >
                  {globalRate?.toLocaleString()} CDF
                </button>
              </div>
            </div>

            {/* Global Search Bar */}
            <div ref={searchContainerRef} className="flex-1 max-w-lg relative">
              <div className={cn(
                "flex items-center gap-3 px-3 md:px-4 py-2 bg-neutral-50 border transition-all duration-300",
                isSearchOpen ? "rounded-t-2xl border-blue-200 bg-white shadow-lg" : "rounded-2xl border-neutral-100"
              )}>
                <Search className={cn("w-4 h-4 transition-colors", isSearchOpen ? "text-blue-600" : "text-neutral-400")} />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder="Recherche... (Ctrl+K)"
                  className="bg-transparent border-none outline-none text-[11px] md:text-xs w-full font-medium placeholder:text-neutral-400"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-neutral-100 rounded-lg transition-colors">
                    <X className="w-3 h-3 text-neutral-400" />
                  </button>
                )}
              </div>

              <AnimatePresence>
                {isSearchOpen && (searchQuery.length >= 2 || searchResults.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 bg-white border-x border-b border-blue-100 rounded-b-2xl shadow-2xl z-[100] max-h-[70vh] overflow-y-auto custom-scrollbar overflow-hidden"
                  >
                    <div className="p-2 space-y-1">
                      {searchResults.length > 0 ? (
                        <>
                          <p className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 italic">Résultats trouvés</p>
                          {searchResults.map((result, idx) => (
                            <button
                              key={`${result.type}-${result.id}-${idx}`}
                              onClick={() => {
                                navigate(result.target);
                                setIsSearchOpen(false);
                                setSearchQuery('');
                              }}
                              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-all group text-left"
                            >
                              <div className="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center group-hover:bg-white shrink-0 shadow-sm border border-neutral-100">
                                <result.icon className="w-5 h-5 text-neutral-400 group-hover:text-blue-600 transition-colors" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-neutral-900 group-hover:text-blue-900 truncate">{result.title}</p>
                                <p className="text-[10px] text-neutral-500 font-medium truncate">{result.subtitle}</p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-neutral-300 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="py-8 text-center space-y-3">
                           <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
                              <Search className="w-6 h-6 text-neutral-200" />
                           </div>
                           <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest italic">Aucun résultat pour "{searchQuery}"</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
             {user?.roles.includes(UserRole.SUPERVISEUR) && (
               <button 
                 onClick={handleAnnouncementUpdate}
                 className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                 title="Gérer l'annonce globale"
               >
                 <Megaphone className="w-5 h-5" />
               </button>
             )}
             <div className="hidden sm:flex flex-col items-end mr-4">
                <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">État Global</span>
                <span className="text-sm font-mono font-bold text-green-600">+12,450.00 USD</span>
             </div>
          </div>
        </header>

        {/* Global Announcement */}
        <AnimatePresence>
          {announcement?.value && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-blue-600 text-white overflow-hidden shrink-0 border-b border-blue-700"
            >
              <div className="px-4 md:px-8 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                    <Megaphone className="w-4 h-4 fill-current" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-100 opacity-60">Annonce Officielle</p>
                    <p className="text-xs font-bold truncate leading-tight">
                      {typeof announcement.value === 'string' ? announcement.value : announcement.value?.message}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 shrink-0">
                  <div className="hidden sm:block text-right">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-200">Diffusé par</p>
                    <p className="text-[10px] font-bold italic">
                      {(typeof announcement.value === 'object' ? announcement.value?.updatedBy : null) || 'Système'}
                    </p>
                  </div>
                  {user?.roles.includes(UserRole.SUPERVISEUR) && (
                    <button 
                      onClick={async () => {
                        if (confirm("Supprimer l'annonce pour tous les utilisateurs ?")) {
                          await db.settings.delete('global_announcement');
                        }
                      }}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all font-mono"
                      title="Supprimer l'annonce"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
           <motion.div
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.3 }}
             className="max-w-7xl mx-auto w-full"
           >
            {children}
           </motion.div>
        </div>
      </main>
    </div>
  );
}
