import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { db } from '../db';
import { SyncService } from '../services/SyncService';

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('amani_user');
      if (savedUser && savedUser !== 'undefined') {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        SyncService.startSync(parsedUser);
      }
    } catch (err) {
      console.error('Failed to parse saved user:', err);
      localStorage.removeItem('amani_user');
    }
    setIsLoading(false);

    return () => {
      SyncService.stopSync();
    };
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('amani_user', JSON.stringify(userData));
    SyncService.startSync(userData);
  };

  const logout = () => {
    SyncService.stopSync();
    setUser(null);
    localStorage.removeItem('amani_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
