import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, cn, formatCurrency } from '../lib/utils';
import { ChatService } from '../services/chatService';
import { 
  MessageSquare, 
  Send, 
  Paperclip, 
  User, 
  Search, 
  ImageIcon, 
  FileIcon, 
  Download,
  AlertCircle,
  MoreVertical,
  CheckCheck,
  Check,
  Clock,
  ShieldCheck,
  Globe,
  MapPin,
  Briefcase,
  Users as UsersIcon,
  PlusCircle,
  Hash,
  Box,
  ChevronLeft,
  Filter,
  Share2,
  Archive,
  Inbox,
  Copy,
  Smile,
  ShieldAlert,
  Info,
  ExternalLink,
  ShieldX
} from 'lucide-react';
import { AlertSeverity, AlertType, Alert } from '../types';

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '✅'];
import { 
  UserRole, 
  MessageType, 
  ChatMessage, 
  ChatGroup, 
  MessageStatus, 
  ChatPriority, 
  ServiceType 
} from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications, NotificationType } from '../contexts/NotificationContext';

export default function Chat() {
  const { user: currentUser } = useAuth();
  const { notify } = useNotifications();
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<ChatPriority>(ChatPriority.NORMAL);
  const [search, setSearch] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>('global');
  const [sharingTxId, setSharingTxId] = useState<number | null>(null);
  const [isMobileListOpen, setIsMobileListOpen] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'groups' | 'direct'>('all');
  const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Data fetching
  // Keep allMessages for sidebar previews, but we should ideally optimize this too later if needed.
  // For now, satisfy the "load N messages" by paginating the active view.
  const allMessages = useLiveQuery(() => db.messages.orderBy('timestamp').toArray());
  
  const activeMessages = useLiveQuery(async () => {
    if (!currentUser) return [];
    
    if (selectedGroupId) {
      const msgs = await db.messages
        .where('recipientGroupId')
        .equals(selectedGroupId)
        .reverse()
        .limit(visibleCount)
        .toArray();
      return msgs.reverse();
    }
    
    if (selectedRecipientId) {
      // In Dexie, querying direct messages (A to B or B to A) efficiently:
      // We can use anyOf on recipientId and filter, or two separate queries.
      // Given the index recipientId, we can get all sent to X or all sent to ME.
      const msgs = await db.messages
        .where('recipientId')
        .anyOf([currentUser.id!, selectedRecipientId])
        .filter(m => 
          (m.senderId === currentUser.id && m.recipientId === selectedRecipientId) ||
          (m.senderId === selectedRecipientId && m.recipientId === currentUser.id)
        )
        .reverse()
        .limit(visibleCount)
        .toArray();
      // Since filter() is applied BEFORE reverse().limit() in Dexie chaining might be weird or unsupported depending on version.
      // Actually .reverse().limit() on a Collection (from filter) works but is less efficient.
      // However, for single conversation "long" messages, this is better than loading ALL.
      return msgs.reverse();
    }
    
    return [];
  }, [selectedGroupId, selectedRecipientId, visibleCount, currentUser?.id]);

  const users = useLiveQuery(() => db.users.toArray());
  const archivedKeys = useLiveQuery(async () => {
    const setting = await db.settings.get('archived_conversations');
    return (setting?.value as string[]) || [];
  }, []) || [];

  const toggleArchive = async (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    const current = [...archivedKeys];
    const index = current.indexOf(key);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(key);
      // Deselect if archiving current chat
      if (selectedGroupId && `group_${selectedGroupId}` === key) setSelectedGroupId(null);
      if (selectedRecipientId && `user_${selectedRecipientId}` === key) setSelectedRecipientId(null);
    }
    await db.settings.put({ key: 'archived_conversations', value: current });
  };
  const agencies = useLiveQuery(() => db.agencies.toArray());
  const [autoGroups, setAutoGroups] = useState<ChatGroup[]>([]);

  useEffect(() => {
    if (currentUser?.agencyId) {
      ChatService.getAutoGroups(currentUser.agencyId, currentUser.roles).then(setAutoGroups);
    }
  }, [currentUser]);

  const lastMessages = useMemo(() => {
    if (!allMessages || !currentUser) return {};
    
    const map: Record<string, { lastMsg: ChatMessage, unreadCount: number }> = {};
    
    allMessages.forEach(m => {
      let key = '';
      if (m.recipientGroupId) {
        key = `group_${m.recipientGroupId}`;
      } else if (m.recipientId) {
        const otherId = m.senderId === currentUser.id ? m.recipientId : m.senderId;
        key = `user_${otherId}`;
      }
      
      if (key) {
        if (!map[key]) map[key] = { lastMsg: m, unreadCount: 0 };
        map[key].lastMsg = m;
        if (m.senderId !== currentUser.id && m.status !== MessageStatus.READ) {
          map[key].unreadCount++;
        }
      }
    });
    
    return map;
  }, [allMessages, currentUser]);

  const userMap = useMemo(() => {
    if (!users) return {};
    return users.reduce((acc, u) => {
      acc[u.id!] = u;
      return acc;
    }, {} as Record<number, any>);
  }, [users]);

  // Mark as read logic is now handled by IntersectionObserver in MessageRow component

  // Scroll to bottom only if we just loaded the chat or sent a message
  // If we loaded more older messages, we should probably maintain scroll position, but for simplicity
  // and standard chat behavior, we'll just scroll to bottom on new messages if near bottom.
  useEffect(() => {
    if (scrollRef.current && visibleCount === 30) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages, selectedGroupId, selectedRecipientId, visibleCount]);

  const handleSendMessage = async (e?: React.FormEvent, type: MessageType = MessageType.TEXT, fileData?: { url: string, name: string }) => {
    e?.preventDefault();
    if (!message.trim() && type === MessageType.TEXT) return;
    if (!currentUser) return;

    await ChatService.sendMessage({
      senderId: currentUser.id!,
      senderName: currentUser.fullName,
      senderCode: `AGN-${currentUser.id}`, // Example code simulation
      agencyId: currentUser.agencyId || 0,
      content: message,
      type,
      recipientId: selectedRecipientId || undefined,
      recipientGroupId: selectedGroupId || undefined,
      priority,
      fileUrl: fileData?.url,
      fileName: fileData?.name
    });

    setMessage('');
    setPriority(ChatPriority.NORMAL);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2000000) { // 2MB limit for local DB robustness
      alert("Fichier trop volumineux. Limite 2MB pour assurer la performance offline.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const type = file.type.startsWith('image/') ? MessageType.IMAGE : MessageType.FILE;
      handleSendMessage(undefined, type, { url: reader.result as string, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(u => 
      u.id !== currentUser?.id && 
      u.fullName.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search, currentUser]);

  const filteredGroupsList = useMemo(() => {
    return autoGroups.filter(g => {
      const key = `group_${g.id}`;
      const isArchived = archivedKeys.includes(key);
      const info = lastMessages[key];
      
      const matchesArchive = showArchived ? isArchived : !isArchived;
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'groups') ||
                           (statusFilter === 'unread' && info && info.unreadCount > 0);
      const matchesAgency = !selectedAgencyId || g.agencyId === selectedAgencyId;
      const matchesService = !selectedService || (g.type === 'service' && g.id === `service-${selectedService}`);
      
      return matchesArchive && matchesStatus && matchesAgency && matchesService;
    });
  }, [autoGroups, archivedKeys, lastMessages, showArchived, statusFilter, selectedAgencyId, selectedService]);

  const filteredUsersList = useMemo(() => {
    return filteredUsers.filter(u => {
      const key = `user_${u.id}`;
      const isArchived = archivedKeys.includes(key);
      const info = lastMessages[key];

      const matchesArchive = showArchived ? isArchived : !isArchived;
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'direct') ||
                           (statusFilter === 'unread' && info && info.unreadCount > 0);
      const matchesAgency = !selectedAgencyId || u.agencyId === selectedAgencyId;
      
      const roleToService: Record<string, ServiceType> = {
        [UserRole.COMPTABLE]: ServiceType.COMPTABILITE,
        [UserRole.CAISSIER_PRINCIPAL]: ServiceType.CAISSE,
        [UserRole.GUICHETIER]: ServiceType.GUICHET,
        [UserRole.AGENT_VIRTUEL]: ServiceType.VIRTUEL,
        [UserRole.AGENT_VODAE]: ServiceType.VODAE,
        [UserRole.AGENT_CHANGE]: ServiceType.CHANGE,
      };

      const userServices = u.roles.map(r => roleToService[r]).filter(Boolean);
      const matchesService = !selectedService || userServices.includes(selectedService);
      
      return matchesArchive && matchesStatus && matchesAgency && matchesService;
    });
  }, [filteredUsers, archivedKeys, lastMessages, showArchived, statusFilter, selectedAgencyId, selectedService]);

  const activeTitle = useMemo(() => {
    if (selectedGroupId) {
      const g = autoGroups.find(g => g.id === selectedGroupId);
      return g?.name || 'Groupe';
    }
    if (selectedRecipientId) {
       const u = users?.find(u => u.id === selectedRecipientId);
       return u?.fullName || 'Utilisateur';
    }
    return 'Messagerie';
  }, [selectedGroupId, selectedRecipientId, autoGroups, users]);

  const [hasMore, setHasMore] = useState(false);
  const [totalMessageCount, setTotalMessageCount] = useState(0);
  
  useLiveQuery(async () => {
    if (!currentUser) return;
    let count = 0;
    if (selectedGroupId) {
      count = await db.messages.where('recipientGroupId').equals(selectedGroupId).count();
    } else if (selectedRecipientId) {
      count = await db.messages.where('recipientId').anyOf([currentUser.id!, selectedRecipientId])
        .filter(m => 
          (m.senderId === currentUser.id && m.recipientId === selectedRecipientId) ||
          (m.senderId === selectedRecipientId && m.recipientId === currentUser.id)
        ).count();
    }
    setTotalMessageCount(count);
    setHasMore(count > visibleCount);
  }, [selectedGroupId, selectedRecipientId, visibleCount, currentUser]);

  useEffect(() => {
    setVisibleCount(30);
  }, [selectedGroupId, selectedRecipientId]);

  const selectChat = (type: 'group' | 'user', id: string | number) => {
    if (type === 'group') {
      setSelectedGroupId(id as string);
      setSelectedRecipientId(null);
    } else {
      setSelectedRecipientId(id as number);
      setSelectedGroupId(null);
    }
    if (window.innerWidth < 1024) setIsMobileListOpen(false);
  };

  return (
    <div className="h-[calc(100vh-10rem)] flex bg-white border border-neutral-100 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-neutral-200/50 relative">
      
      {/* Sidebar List */}
      <div className={cn(
        "w-full lg:w-96 flex flex-col border-r border-neutral-50 bg-neutral-50/30 transition-all duration-300",
        !isMobileListOpen && "hidden lg:flex"
      )}>
        <div className="p-6 space-y-4">
           <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black italic font-serif text-neutral-900 tracking-tighter">Ets Amani Chat</h1>
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                 <MessageSquare className="w-4 h-4" />
              </div>
           </div>
           
           <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Rechercher une conversation..." 
                className="input pl-10 h-11 bg-white border-none shadow-sm focus:ring-4 focus:ring-blue-50 transition-all text-xs"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
           </div>

           <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
              {[
                { id: 'all', label: 'Toutes', icon: MessageSquare },
                { id: 'unread', label: 'Non lues', icon: Clock },
                { id: 'groups', label: 'Groupes', icon: UsersIcon },
                { id: 'direct', label: 'Direct', icon: User }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id as any)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shrink-0",
                    statusFilter === f.id 
                      ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200" 
                      : "bg-white border-neutral-100 text-neutral-400 hover:border-neutral-200"
                  )}
                >
                  <f.icon className="w-3 h-3" /> {f.label}
                </button>
              ))}
           </div>

           {agencies && agencies.length > 0 && (
             <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
                <button
                  onClick={() => setSelectedAgencyId(null)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shrink-0",
                    selectedAgencyId === null 
                      ? "bg-neutral-900 border-neutral-900 text-white shadow-lg" 
                      : "bg-white border-neutral-100 text-neutral-400 hover:border-neutral-200"
                  )}
                >
                  <Globe className="w-3 h-3" /> Toutes les agences
                </button>
                {agencies.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAgencyId(a.id!)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shrink-0",
                      selectedAgencyId === a.id 
                        ? "bg-blue-600 border-blue-600 text-white shadow-lg" 
                        : "bg-white border-neutral-100 text-neutral-400 hover:border-neutral-200"
                    )}
                  >
                    <MapPin className="w-3 h-3" /> {a.name}
                  </button>
                ))}
             </div>
           )}

           <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
              <button
                onClick={() => setSelectedService(null)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shrink-0",
                  selectedService === null 
                    ? "bg-neutral-900 border-neutral-900 text-white shadow-lg" 
                    : "bg-white border-neutral-100 text-neutral-400 hover:border-neutral-200"
                )}
              >
                <Briefcase className="w-3 h-3" /> Tous les services
              </button>
              {Object.values(ServiceType).filter(s => s !== ServiceType.GENERAL).map(s => (
                <button
                  key={s}
                  onClick={() => setSelectedService(s)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shrink-0",
                    selectedService === s 
                      ? "bg-blue-600 border-blue-600 text-white shadow-lg" 
                      : "bg-white border-neutral-100 text-neutral-400 hover:border-neutral-200"
                  )}
                >
                  <Hash className="w-3 h-3" /> {s}
                </button>
              ))}
           </div>

           <div className="flex p-1 bg-white rounded-2xl border border-neutral-100 shadow-sm">
              <button 
                onClick={() => setShowArchived(false)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  !showArchived ? "bg-neutral-900 text-white shadow-lg" : "text-neutral-400 hover:bg-neutral-50"
                )}
              >
                <Inbox className="w-3 h-3" /> Inbox
              </button>
              <button 
                onClick={() => setShowArchived(true)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  showArchived ? "bg-neutral-900 text-white shadow-lg" : "text-neutral-400 hover:bg-neutral-50"
                )}
              >
                <Archive className="w-3 h-3" /> Archivées
              </button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6 custom-scrollbar">
           {/* Section Groupes */}
           {filteredGroupsList.length > 0 && (
             <div className="space-y-2">
                <p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 italic flex items-center gap-2">
                  <Globe className="w-3 h-3" /> Canaux d'Entreprise
                </p>
                {filteredGroupsList.map(g => {
                  const key = `group_${g.id}`;
                  const info = lastMessages[key];
                  return (
                    <div key={g.id} className="relative group/item">
                      <button 
                        onClick={() => selectChat('group', g.id)}
                        className={cn(
                          "w-full p-4 rounded-3xl flex items-center gap-4 transition-all group relative",
                          selectedGroupId === g.id 
                            ? "bg-blue-600 text-white shadow-xl shadow-blue-500/30 -translate-y-0.5" 
                            : "bg-white border border-neutral-100 hover:border-blue-200 text-neutral-600"
                        )}
                      >
                         <div className={cn(
                           "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-colors",
                           selectedGroupId === g.id ? "bg-white/20" : "bg-neutral-50 text-neutral-400 group-hover:bg-blue-50 group-hover:text-blue-500"
                         )}>
                            {g.type === 'global' ? <Globe className="w-5 h-5" /> : 
                             g.type === 'agency' ? <MapPin className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
                         </div>
                         <div className="text-left min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-black uppercase tracking-tight truncate">{g.name}</p>
                              {info && info.unreadCount > 0 && (
                                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-red-500/20">
                                  {info.unreadCount}
                                </span>
                              )}
                            </div>
                            <p className={cn(
                              "text-[10px] truncate italic", 
                              selectedGroupId === g.id ? "text-white/80" : "text-neutral-400",
                              info && info.unreadCount > 0 && "font-bold text-neutral-900"
                            )}>
                              {info ? `${info.lastMsg.senderName.split(' ')[0]} : ${info.lastMsg.content}` : g.description}
                            </p>
                         </div>
                      </button>
                      <button 
                        onClick={(e) => toggleArchive(e, key)}
                        className={cn(
                          "absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-all z-10",
                          selectedGroupId === g.id ? "bg-white/20 text-white hover:bg-white/30" : "bg-white text-neutral-400 hover:text-blue-600 shadow-lg border border-neutral-100"
                        )}
                        title={showArchived ? "Désarchiver" : "Archiver"}
                      >
                        {showArchived ? <Inbox className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                      </button>
                    </div>
                  );
                })}
             </div>
           )}

           {/* Section Contacts */}
           {filteredUsersList.length > 0 && (
             <div className="space-y-2">
                <p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 italic flex items-center gap-2">
                  <UsersIcon className="w-3 h-3" /> Contacts Directs
                </p>
                {filteredUsersList.map(u => {
                  const key = `user_${u.id}`;
                  const info = lastMessages[key];
                  return (
                    <div key={u.id} className="relative group/item">
                      <button 
                        onClick={() => selectChat('user', u.id!)}
                        className={cn(
                          "w-full p-4 rounded-3xl flex items-center gap-4 transition-all group relative",
                          selectedRecipientId === u.id 
                            ? "bg-white border-blue-500 shadow-xl shadow-neutral-200/50 ring-4 ring-blue-50" 
                            : "bg-white border border-neutral-100 hover:border-neutral-200 text-neutral-600"
                        )}
                      >
                         <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-2xl bg-neutral-100 flex items-center justify-center overflow-hidden border border-neutral-200">
                               {u.photoUrl ? <img src={u.photoUrl} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-neutral-400" />}
                            </div>
                            <div className={cn(
                              "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-4 border-white",
                              u.status === 'active' ? "bg-green-500" : "bg-neutral-300"
                            )} />
                         </div>
                         <div className="text-left min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-black text-neutral-900 group-hover:text-blue-600 transition-colors truncate">{u.fullName}</p>
                              {info && info.unreadCount > 0 && (
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-blue-500/20">
                                  {info.unreadCount}
                                </span>
                              )}
                            </div>
                            <p className={cn(
                              "text-[10px] truncate transition-colors",
                              info && info.unreadCount > 0 ? "text-neutral-900 font-bold" : "text-neutral-400"
                            )}>
                              {info ? info.lastMsg.content : u.roles[0]?.replace('_', ' ')}
                            </p>
                         </div>
                      </button>
                      <button 
                        onClick={(e) => toggleArchive(e, key)}
                        className={cn(
                          "absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-all z-10 shadow-lg border border-neutral-100 bg-white",
                          selectedRecipientId === u.id ? "text-blue-600 border-blue-100" : "text-neutral-400 hover:text-blue-600"
                        )}
                        title={showArchived ? "Désarchiver" : "Archiver"}
                      >
                        {showArchived ? <Inbox className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                      </button>
                    </div>
                  );
                })}
             </div>
           )}

           {filteredGroupsList.length === 0 && filteredUsersList.length === 0 && (
             <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
                   <Search className="w-8 h-8 text-neutral-300" />
                </div>
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest italic">Aucune conversation trouvée</p>
             </div>
           )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-white relative",
        isMobileListOpen && "hidden lg:flex"
      )}>
        {/* Header */}
        <header className="px-8 py-4 border-b border-neutral-50 flex items-center justify-between bg-white/80 backdrop-blur-xl z-20 sticky top-0">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsMobileListOpen(true)}
                className="lg:hidden p-2 hover:bg-neutral-100 rounded-full text-neutral-400"
              >
                 <ChevronLeft className="w-6 h-6" />
              </button>
              
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center text-white shadow-lg shrink-0">
                   {selectedGroupId ? <Hash className="w-6 h-6" /> : <User className="w-6 h-6" />}
                 </div>
                 <div>
                    <h2 className="text-sm font-black text-neutral-900 uppercase tracking-widest">{activeTitle}</h2>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                       <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-tighter italic">Opérationnel / Synchronisé</p>
                    </div>
                 </div>
              </div>
           </div>
           
           <div className="flex items-center gap-2">
              <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-neutral-50 text-[10px] font-black uppercase tracking-widest text-neutral-400 rounded-full border border-neutral-100">
                 <Filter className="w-3 h-3" /> Filtrer
              </button>
              <button className="p-3 hover:bg-neutral-50 rounded-2xl text-neutral-400 transition-all">
                 <MoreVertical className="w-5 h-5" />
              </button>
           </div>
        </header>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar bg-neutral-50/20"
        >
           {(!activeMessages || activeMessages.length === 0) ? (
             <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl shadow-neutral-200 border border-neutral-50 animate-bounce">
                   <MessageSquare className="w-10 h-10 text-blue-600" />
                </div>
                <div className="max-w-xs space-y-2">
                   <h3 className="font-serif italic font-black text-neutral-900 underline decoration-blue-500 decoration-4">Nouvelle Conversation</h3>
                   <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-[0.2em] leading-relaxed">
                     Entrez votre message ci-dessous. Les communications sont cryptées et journalisées localement.
                   </p>
                </div>
             </div>
           ) : (
             <div className="space-y-6">
                {hasMore && (
                  <div className="flex justify-center pb-4">
                    <button 
                      onClick={() => setVisibleCount(prev => prev + 30)}
                      className="px-6 py-2 bg-white border border-neutral-100 rounded-full text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm active:scale-95"
                    >
                      Charger les messages précédents
                    </button>
                  </div>
                )}
                {activeMessages.map((msg, idx) => {
                  const isMine = msg.senderId === currentUser?.id;
                  const showSender = !isMine && (idx === 0 || activeMessages[idx-1].senderId !== msg.senderId);
                  
                  return (
                    <MessageRow
                      key={msg.localId || msg.id}
                      msg={msg}
                      isMine={isMine}
                      showSender={showSender}
                      currentUser={currentUser!}
                      userMap={userMap}
                      onVisible={(id) => {
                        if (!isMine && msg.status !== MessageStatus.READ) {
                          db.messages.update(id, { status: MessageStatus.READ });
                        }
                      }}
                      onShare={(txId) => setSharingTxId(txId)}
                    />
                  )
                })}
             </div>
           )}
        </div>

        {/* Footer Area */}
        <footer className="p-8 bg-white border-t border-neutral-50 space-y-4">
           {priority === ChatPriority.URGENT && (
             <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 animate-pulse">
                <AlertCircle className="w-4 h-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">Mode Urgent Activé : Ce message sera mis en évidence</p>
                <button onClick={() => setPriority(ChatPriority.NORMAL)} className="ml-auto text-xs font-bold underline">Annuler</button>
             </div>
           )}

           <div className="flex gap-4 items-end">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileUpload}
                accept="image/*,.pdf,.doc,.docx"
              />
              <div className="flex flex-col gap-2 shrink-0">
                 <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-12 h-12 rounded-2xl bg-neutral-50 text-neutral-400 hover:bg-blue-50 hover:text-blue-600 border border-neutral-100 transition-all flex items-center justify-center active:scale-95"
                  title="Attacher un fichier"
                >
                   <Paperclip className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setPriority(priority === ChatPriority.NORMAL ? ChatPriority.URGENT : ChatPriority.NORMAL)}
                  className={cn(
                    "w-12 h-12 rounded-2xl transition-all flex items-center justify-center border active:scale-95",
                    priority === ChatPriority.URGENT ? "bg-red-600 border-red-600 text-white" : "bg-neutral-50 border-neutral-100 text-neutral-400 hover:text-red-500"
                  )}
                  title="Priorité Urgente"
                >
                   <AlertCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSendMessage} className="flex-1 relative group bg-neutral-50 rounded-[2rem] border border-neutral-100 focus-within:ring-8 focus-within:ring-blue-50 focus-within:border-blue-400 transition-all">
                 <textarea 
                   rows={1}
                   value={message}
                   onChange={e => setMessage(e.target.value)}
                   onKeyDown={e => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       handleSendMessage();
                     }
                   }}
                   placeholder="Rédigez votre message ici..." 
                   className="w-full bg-transparent border-none focus:ring-0 px-6 py-4 text-xs font-medium text-neutral-800 placeholder:text-neutral-400 max-h-32 resize-none custom-scrollbar outline-none"
                 />
                 <div className="absolute right-3 bottom-3 flex items-center gap-2">
                    <button 
                      type="submit"
                      disabled={!message.trim()}
                      className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-90 disabled:grayscale disabled:opacity-50"
                    >
                       <Send className="w-4 h-4" />
                    </button>
                 </div>
              </form>
           </div>
        </footer>
      </div>

      {/* Info Side Panel - Tablet+ only */}
      <div className="hidden xl:flex w-72 border-l border-neutral-50 flex-col overflow-y-auto">
         <div className="p-8 space-y-8">
            <div className="flex flex-col items-center text-center space-y-4">
               <div className="w-24 h-24 rounded-[2.5rem] bg-neutral-900 flex items-center justify-center text-white shadow-2xl shrink-0 overflow-hidden">
                  {selectedGroupId ? <Hash className="w-10 h-10" /> : <User className="w-10 h-10" />}
               </div>
               <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-neutral-900">{activeTitle}</h3>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest italic">{selectedGroupId ? 'Salon de discussion' : 'Personnel Agence'}</p>
               </div>
            </div>

            <div className="p-6 rounded-[2rem] bg-blue-600 text-white shadow-xl shadow-blue-200 space-y-3 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-12 -translate-y-12 blur-3xl group-hover:scale-150 transition-all duration-1000" />
               <ShieldCheck className="w-6 h-6 opacity-60" />
               <h4 className="text-[10px] font-black uppercase tracking-[0.2em] relative z-10">Cyber Sécurité</h4>
               <p className="text-[9px] leading-relaxed opacity-60 italic relative z-10">Discussion privée et cryptée. Les données restent confidentielles.</p>
            </div>

            <div className="space-y-4 pt-4">
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 italic">Journal d'Audit</p>
               <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] bg-neutral-50 p-3 rounded-2xl border border-neutral-100">
                     <span className="text-neutral-400 font-bold uppercase tracking-widest">Messages</span>
                     <span className="text-neutral-900 font-mono font-black">{totalMessageCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] bg-neutral-50 p-3 rounded-2xl border border-neutral-100">
                     <span className="text-neutral-400 font-bold uppercase tracking-widest">Statut</span>
                     <span className="text-green-600 font-black uppercase italic animate-pulse">Sync OK</span>
                  </div>
               </div>
            </div>
         </div>
      </div>

      <AnimatePresence>
        {sharingTxId && (
          <ShareTransactionModal 
            txId={sharingTxId} 
            onClose={() => setSharingTxId(null)}
            groups={autoGroups}
            users={users || []}
            currentUser={currentUser!}
            notify={notify}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageRow({ 
  msg, 
  isMine, 
  showSender, 
  currentUser, 
  userMap,
  onVisible,
  onShare 
}: { 
  msg: ChatMessage, 
  isMine: boolean, 
  showSender: boolean, 
  currentUser: any,
  userMap: any,
  onVisible: (id: number) => void,
  onShare: (txId: number) => void
}) {
  const { notify } = useNotifications();
  const [copied, setCopied] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isUrgent = msg.priority === ChatPriority.URGENT;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      notify({
        type: NotificationType.SUCCESS,
        title: 'Copié',
        message: 'Message copié dans le presse-papiers.'
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      notify({
        type: NotificationType.ERROR,
        title: 'Erreur',
        message: 'Impossible de copier le message.'
      });
    }
  };

  const handleToggleReaction = async (emoji: string) => {
    if (!msg.id || !currentUser.id) return;
    
    const reactions = { ...(msg.reactions || {}) };
    const userIds = [...(reactions[emoji] || [])];
    const index = userIds.indexOf(currentUser.id);

    if (index > -1) {
      userIds.splice(index, 1);
      if (userIds.length === 0) delete reactions[emoji];
      else reactions[emoji] = userIds;
    } else {
      userIds.push(currentUser.id);
      reactions[emoji] = userIds;
    }

    await db.messages.update(msg.id, { reactions });
    setShowReactionPicker(false);
  };

  useEffect(() => {
    if (!ref.current || isMine || msg.status === MessageStatus.READ) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && msg.id) {
        onVisible(msg.id);
        observer.disconnect();
      }
    }, { threshold: 0.5 });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [msg.id, msg.status, isMine, onVisible]);

  return (
    <motion.div 
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3",
        isMine ? "flex-row-reverse" : "flex-row"
      )}
    >
        {isMine ? (
          <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 border border-blue-200 mt-1 overflow-hidden">
             {currentUser.photoUrl ? (
               <img src={currentUser.photoUrl} alt="" className="w-full h-full object-cover" />
             ) : (
               <User className="w-4 h-4 text-blue-600" />
             )}
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 border border-neutral-200 mt-1 overflow-hidden">
             {userMap[msg.senderId]?.photoUrl ? (
               <img 
                 src={userMap[msg.senderId]?.photoUrl} 
                 alt="" 
                 className="w-full h-full object-cover" 
               />
             ) : (
               <User className="w-4 h-4 text-neutral-400" />
             )}
          </div>
        )}

       <div className={cn(
        "max-w-[70%] space-y-1",
        isMine ? "items-end" : "items-start"
       )}>
          {showSender && (
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">{msg.senderName} • {msg.senderCode}</p>
          )}
          
          <div className={cn(
            "relative group px-4 py-3 rounded-[2rem] text-xs shadow-sm",
            isMine 
              ? "bg-blue-600 text-white rounded-tr-none" 
              : "bg-white text-neutral-800 rounded-tl-none border border-neutral-100",
            isUrgent && "ring-2 ring-red-500 !bg-red-600 !text-white"
          )}>
             <div className={cn(
                "absolute -top-2 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 z-10",
                isMine ? "right-0" : "left-0"
             )}>
                <button 
                    onClick={handleCopy}
                    className={cn(
                      "p-1.5 rounded-lg shadow-lg border",
                      isMine 
                        ? "bg-blue-700 border-blue-500 text-white" 
                        : "bg-white border-neutral-100 text-neutral-400 hover:text-blue-600"
                    )}
                    title="Copier le message"
                >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
                <div className="relative">
                  <button 
                      onClick={() => setShowReactionPicker(!showReactionPicker)}
                      className={cn(
                        "p-1.5 rounded-lg shadow-lg border",
                        isMine 
                          ? "bg-blue-700 border-blue-500 text-white" 
                          : "bg-white border-neutral-100 text-neutral-400 hover:text-blue-600"
                      )}
                      title="Réagir"
                  >
                      <Smile className="w-3 h-3" />
                  </button>
                  
                  <AnimatePresence>
                    {showReactionPicker && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                        className={cn(
                          "absolute bottom-full mb-2 p-1 bg-white rounded-xl shadow-xl border border-neutral-100 flex gap-1 z-20",
                          isMine ? "right-0" : "left-0"
                        )}
                      >
                         {COMMON_EMOJIS.map(emoji => (
                           <button 
                             key={emoji}
                             onClick={() => handleToggleReaction(emoji)}
                             className="w-8 h-8 flex items-center justify-center hover:bg-neutral-50 rounded-lg transition-colors text-sm"
                           >
                             {emoji}
                           </button>
                         ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
             </div>

             {isUrgent && (
               <div className="flex items-center gap-1 mb-2 text-[8px] font-black uppercase tracking-widest text-red-100">
                  <AlertCircle className="w-3 h-3 text-white" /> Urgent
               </div>
             )}

             {msg.type === MessageType.TEXT && <p className="leading-relaxed font-medium">{msg.content}</p>}
             
             {msg.type === MessageType.IMAGE && (
               <div className="space-y-2">
                  <img src={msg.fileUrl} alt="Attachement" className="rounded-2xl max-h-80 object-cover cursor-pointer hover:scale-[1.02] transition-transform" />
                  {msg.content && <p className="text-[11px] opacity-90">{msg.content}</p>}
               </div>
             )}

             {msg.type === MessageType.FILE && (
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl border border-white/20">
                   <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <FileIcon className="w-5 h-5 text-white" />
                   </div>
                   <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold truncate">{msg.fileName}</p>
                      <p className="text-[8px] opacity-60 uppercase font-black tracking-widest">Document / PDF</p>
                   </div>
                   <a href={msg.fileUrl} download={msg.fileName} className="p-2 hover:bg-white/20 rounded-xl transition-all">
                      <Download className="w-4 h-4 text-white" />
                   </a>
                </div>
             )}

             {msg.type === MessageType.SYSTEM && msg.metadata?.txId && (
                <div className={cn(
                   "p-4 rounded-2xl border space-y-3",
                   isMine 
                     ? "bg-white/10 border-white/20" 
                     : "bg-neutral-50 border-neutral-100"
                )}>
                   <div className="flex items-center gap-3">
                      <div className={cn(
                         "w-8 h-8 rounded-lg flex items-center justify-center",
                         isMine ? "bg-white/20" : "bg-white shadow-sm"
                      )}>
                         <Box className={cn("w-4 h-4", isMine ? "text-blue-100" : "text-blue-600")} />
                      </div>
                      <div>
                         <p className={cn("text-[8px] font-black uppercase tracking-widest opacity-60")}>Référence Transaction</p>
                         <p className="text-[10px] font-bold font-mono">#TX-{String(msg.metadata.txId).padStart(4, '0')}</p>
                      </div>
                   </div>
                   <p className="text-[11px] leading-relaxed opacity-90">{msg.content}</p>
                   <div className="flex gap-2">
                      <button className={cn(
                         "flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-colors shadow-sm",
                         isMine ? "bg-white text-blue-600 hover:bg-blue-50" : "bg-blue-600 text-white hover:bg-blue-700"
                      )}>
                         Détails
                      </button>
                      <button 
                        onClick={() => onShare(msg.metadata!.txId!)}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm",
                          isMine ? "bg-white/20 text-white hover:bg-white/30" : "bg-white text-neutral-400 hover:text-blue-600"
                        )}
                      >
                         <Share2 className="w-4 h-4" />
                      </button>
                   </div>
                </div>
             )}

             {msg.type === MessageType.ALERT && (
                <div className={cn(
                  "p-5 rounded-[2rem] border-2 space-y-4 shadow-xl",
                  msg.content.includes(AlertSeverity.CRITICAL) ? "bg-red-50 border-red-200 text-red-900" :
                  msg.content.includes(AlertSeverity.WARNING) ? "bg-amber-50 border-amber-200 text-amber-900" :
                  "bg-blue-50 border-blue-200 text-blue-900"
                )}>
                   <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                          msg.content.includes(AlertSeverity.CRITICAL) ? "bg-red-600 text-white" :
                          msg.content.includes(AlertSeverity.WARNING) ? "bg-amber-500 text-white" :
                          "bg-blue-600 text-white"
                        )}>
                           {msg.content.includes(AlertSeverity.CRITICAL) ? <ShieldX className="w-6 h-6" /> : 
                            msg.content.includes(AlertSeverity.WARNING) ? <ShieldAlert className="w-6 h-6" /> : 
                            <Info className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Alerte IA • {msg.senderName}</p>
                          <h4 className="text-sm font-black tracking-tight mt-0.5">{msg.content.split('\n')[0]}</h4>
                        </div>
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                        msg.content.includes(AlertSeverity.CRITICAL) ? "bg-red-100 text-red-600" :
                        msg.content.includes(AlertSeverity.WARNING) ? "bg-amber-100 text-amber-600" :
                        "bg-blue-100 text-blue-600"
                      )}>
                        {msg.content.includes(AlertSeverity.CRITICAL) ? 'Critique' : 
                         msg.content.includes(AlertSeverity.WARNING) ? 'Attention' : 'Info'}
                      </div>
                   </div>

                   <div className="p-3 bg-white/40 rounded-2xl border border-white/60 backdrop-blur-sm">
                      <p className="text-[11px] leading-relaxed font-medium">
                        {msg.content.split('\n').slice(1).join('\n')}
                      </p>
                   </div>

                   <div className="flex gap-2">
                      <button className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all shadow-sm active:scale-95",
                        msg.content.includes(AlertSeverity.CRITICAL) ? "bg-red-600 text-white hover:bg-red-700" :
                        msg.content.includes(AlertSeverity.WARNING) ? "bg-amber-500 text-white hover:bg-amber-600" :
                        "bg-blue-600 text-white hover:bg-blue-700"
                      )}>
                        <ExternalLink className="w-3.5 h-3.5" /> Voir détail
                      </button>
                      <button className="px-4 py-2.5 rounded-2xl bg-white border border-neutral-100 text-[10px] font-black uppercase text-neutral-400 hover:text-neutral-600 transition-all active:scale-95">
                        Ignorer
                      </button>
                   </div>
                </div>
             )}

             {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                <div className={cn(
                   "flex flex-wrap gap-1 mt-2",
                   isMine ? "justify-end" : "justify-start"
                )}>
                   {Object.entries(msg.reactions).map(([emoji, uids]) => (
                     <button
                       key={emoji}
                       onClick={() => handleToggleReaction(emoji)}
                       className={cn(
                         "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all border",
                         uids.includes(currentUser.id) 
                           ? (isMine ? "bg-white/20 border-white/40 text-white" : "bg-blue-50 border-blue-200 text-blue-600")
                           : (isMine ? "bg-black/10 border-white/10 text-white/60" : "bg-neutral-50 border-neutral-100 text-neutral-400")
                       )}
                     >
                       <span>{emoji}</span>
                       <span className="text-[8px]">{uids.length}</span>
                     </button>
                   ))}
                </div>
             )}

             <div className={cn(
               "flex items-center gap-1.5 mt-2 opacity-60",
               isMine ? "justify-end" : "justify-start"
             )}>
                <span className="text-[8px] font-mono italic">{formatDate(msg.timestamp)}</span>
                {isMine && (
                  msg.status === MessageStatus.PENDING ? <Clock className="w-3 h-3 animate-spin text-white/50" /> :
                  msg.status === MessageStatus.SENT ? <Check className="w-3 h-3" /> :
                  msg.status === MessageStatus.RECEIVED ? <CheckCheck className="w-3 h-3" /> :
                  <CheckCheck className="w-3 h-3 text-blue-300" />
                )}
             </div>
          </div>
       </div>
    </motion.div>
  );
}

function ShareTransactionModal({ 
  txId, 
  onClose, 
  groups, 
  users, 
  currentUser,
  notify
}: { 
  txId: number, 
  onClose: () => void, 
  groups: ChatGroup[], 
  users: any[],
  currentUser: any,
  notify: any
}) {
  const handleShare = async (target: { recipientId?: number, recipientGroupId?: string }) => {
    try {
      await ChatService.shareTransaction(txId, {
        senderId: currentUser.id!,
        senderName: currentUser.fullName,
        senderCode: `AGN-${currentUser.id}`,
        agencyId: currentUser.agencyId || 0
      }, target);
      
      notify({
        type: NotificationType.SUCCESS,
        title: 'Transaction Partagée',
        message: 'La transaction a été re-partagée avec succès.'
      });
    } catch (error) {
      notify({
        type: NotificationType.ERROR,
        title: 'Erreur de partage',
        message: 'Impossible de partager la transaction.'
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
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
        className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
           <div>
              <h3 className="font-bold text-lg">Transférer Transaction</h3>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Choisir une destination</p>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full text-neutral-400">
              <PlusCircle className="w-6 h-6 rotate-45" />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
           <div className="space-y-2">
              <p className="px-3 text-[10px] font-black uppercase text-neutral-400 italic">Canaux</p>
              {groups.map(g => (
                <button 
                  key={g.id}
                  onClick={() => handleShare({ recipientGroupId: g.id })}
                  className="w-full p-4 bg-neutral-50 hover:bg-blue-50 border border-neutral-100 rounded-2xl flex items-center gap-4 transition-all group"
                >
                   <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-neutral-400 group-hover:text-blue-600 shadow-sm">
                      <Hash className="w-5 h-5" />
                   </div>
                   <div className="text-left">
                      <p className="text-xs font-bold text-neutral-900">{g.name}</p>
                      <p className="text-[10px] text-neutral-400">{g.description}</p>
                   </div>
                </button>
              ))}
           </div>

           <div className="space-y-2">
              <p className="px-3 text-[10px] font-black uppercase text-neutral-400 italic">Contacts</p>
              {users.filter(u => u.id !== currentUser.id).map(u => (
                <button 
                  key={u.id}
                  onClick={() => handleShare({ recipientId: u.id! })}
                  className="w-full p-4 bg-neutral-50 hover:bg-blue-50 border border-neutral-100 rounded-2xl flex items-center gap-4 transition-all group"
                >
                   <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-neutral-400 group-hover:text-blue-600 shadow-sm">
                      <User className="w-5 h-5" />
                   </div>
                   <div className="text-left">
                      <p className="text-xs font-bold text-neutral-900">{u.fullName}</p>
                      <p className="text-[10px] text-neutral-400">{u.roles?.[0]}</p>
                   </div>
                </button>
              ))}
           </div>
        </div>
      </motion.div>
    </div>
  );
}
