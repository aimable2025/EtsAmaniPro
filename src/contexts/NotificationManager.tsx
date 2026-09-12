import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from './AuthContext';
import { useNotifications, NotificationType } from './NotificationContext';
import { ChatPriority, MessageStatus } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';

export function NotificationManager() {
  const { user } = useAuth();
  const { notify } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const lastProcessedIdRef = useRef<number | undefined>(undefined);

  // Poll for the absolute latest message added to DB
  const latestMessage = useLiveQuery(async () => {
    if (!user) return null;
    return await db.messages.orderBy('id').last();
  }, [user]);

  useEffect(() => {
    if (!latestMessage || !user) return;

    // Check if it's a message for us (group or direct)
    const isForMe = latestMessage.recipientId === user.id || 
                    latestMessage.recipientGroupId ||
                    latestMessage.agencyId === user.agencyId; // Simplified group check
    
    const isNew = latestMessage.id !== lastProcessedIdRef.current;
    const isIncoming = latestMessage.senderId !== user.id;
    const isPendingOrSent = latestMessage.status === MessageStatus.PENDING || latestMessage.status === MessageStatus.SENT || latestMessage.status === MessageStatus.RECEIVED;

    if (isForMe && isNew && isIncoming && isPendingOrSent) {
      lastProcessedIdRef.current = latestMessage.id;

      // Only notify if we are NOT on the chat page
      if (location.pathname !== '/chat') {
        const isUrgent = latestMessage.priority === ChatPriority.URGENT;
        
        notify({
          type: isUrgent ? NotificationType.URGENT : NotificationType.INFO,
          title: isUrgent ? '🚨 MESSAGE URGENT' : 'Nouveau Message',
          message: `${latestMessage.senderName} : ${latestMessage.content.substring(0, 50)}${latestMessage.content.length > 50 ? '...' : ''}`,
          duration: isUrgent ? 10000 : 5000,
          action: {
            label: 'Répondre',
            onClick: () => navigate('/chat')
          }
        });

        // Optional: Browser notification
        if (Notification.permission === 'granted') {
          new Notification(isUrgent ? '🚨 MESSAGE URGENT - ETS AMANI' : 'Nouveau Message - ETS AMANI', {
            body: `${latestMessage.senderName} : ${latestMessage.content}`,
            icon: '/favicon.ico'
          });
        }
      }
    }
  }, [latestMessage, user, notify, navigate, location.pathname]);

  // Request browser notification permission
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return null;
}
