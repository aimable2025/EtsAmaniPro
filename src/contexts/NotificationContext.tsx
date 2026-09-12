import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Info, AlertTriangle, AlertCircle, CheckCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  URGENT = 'urgent'
}

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextType {
  notify: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = { ...notification, id };
    
    setNotifications((prev) => [...prev, newNotification]);

    if (notification.duration !== 0) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration || 5000);
    }
  }, [removeNotification]);

  return (
    <NotificationContext.Provider value={{ notify, removeNotification }}>
      {children}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-4 w-full max-w-sm pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={cn(
                "pointer-events-auto p-4 rounded-[1.5rem] shadow-2xl border flex gap-4 items-start relative group overflow-hidden",
                n.type === NotificationType.INFO && "bg-white border-neutral-100 text-neutral-900",
                n.type === NotificationType.SUCCESS && "bg-green-50 border-green-100 text-green-900",
                n.type === NotificationType.WARNING && "bg-amber-50 border-amber-100 text-amber-900",
                n.type === NotificationType.ERROR && "bg-red-50 border-red-100 text-red-900",
                n.type === NotificationType.URGENT && "bg-red-600 border-red-700 text-white shadow-red-500/30"
              )}
            >
              {n.type === NotificationType.URGENT && (
                <div className="absolute top-0 left-0 w-1 h-full bg-white/20" />
              )}
              
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                n.type === NotificationType.INFO && "bg-blue-50 text-blue-600",
                n.type === NotificationType.SUCCESS && "bg-white text-green-600",
                n.type === NotificationType.WARNING && "bg-white text-amber-600",
                n.type === NotificationType.ERROR && "bg-white text-red-600",
                n.type === NotificationType.URGENT && "bg-white/10 text-white"
              )}>
                {n.type === NotificationType.INFO && <Info className="w-5 h-5" />}
                {n.type === NotificationType.SUCCESS && <CheckCircle className="w-5 h-5" />}
                {n.type === NotificationType.WARNING && <AlertTriangle className="w-5 h-5" />}
                {n.type === NotificationType.ERROR && <AlertCircle className="w-5 h-5" />}
                {n.type === NotificationType.URGENT && <AlertCircle className="w-5 h-5" />}
              </div>

              <div className="flex-1 min-w-0 pr-6">
                <p className="text-xs font-black uppercase tracking-widest">{n.title}</p>
                <p className="text-[11px] font-medium leading-relaxed mt-1 opacity-80">{n.message}</p>
                
                {n.action && (
                  <button
                    onClick={() => {
                      n.action?.onClick();
                      removeNotification(n.id);
                    }}
                    className={cn(
                      "mt-3 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      n.type === NotificationType.URGENT 
                        ? "bg-white text-red-600 hover:bg-red-50" 
                        : "bg-neutral-900 text-white hover:bg-neutral-800"
                    )}
                  >
                    {n.action.label}
                  </button>
                )}
              </div>

              <button
                onClick={() => removeNotification(n.id)}
                className="absolute top-4 right-4 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/5"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
