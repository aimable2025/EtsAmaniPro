import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { NotificationManager } from './contexts/NotificationManager';
import React, { useEffect } from 'react';
import { initializeSystem } from './db';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import BilletagePage from './pages/Billetage';
import Users from './pages/Users';
import Agencies from './pages/Agencies';
import Debts from './pages/Debts';
import Reports from './pages/Reports';
import Commissions from './pages/Commissions';
import Chat from './pages/Chat';
import AuditLogs from './pages/AuditLogs';
import Banking from './pages/Banking';
import Operations from './pages/Operations';
import Alerts from './pages/Alerts';
import BackupManager from './pages/BackupManager';
import RegulationPage from './pages/Regulation';
import Layout from './components/Layout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="h-screen w-screen flex items-center justify-center font-mono animate-pulse">Ets Amani Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return <Layout>{children}</Layout>;
}

export default function App() {
  useEffect(() => {
  void initializeSystem().catch((error) => {
    console.error(
      'Ets AMANI initialization error:',
      error
    );
  });
}, []);
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <NotificationManager />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
            <Route path="/billetage" element={<PrivateRoute><BilletagePage /></PrivateRoute>} />
            <Route path="/users" element={<PrivateRoute><Users /></PrivateRoute>} />
            <Route path="/agencies" element={<PrivateRoute><Agencies /></PrivateRoute>} />
            <Route path="/debts" element={<PrivateRoute><Debts /></PrivateRoute>} />
            <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
            <Route path="/commissions" element={<PrivateRoute><Commissions /></PrivateRoute>} />
            <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
            <Route path="/audit" element={<PrivateRoute><AuditLogs /></PrivateRoute>} />
            <Route path="/banking" element={<PrivateRoute><Banking /></PrivateRoute>} />
            <Route path="/operations" element={<PrivateRoute><Operations /></PrivateRoute>} />
            <Route path="/alerts" element={<PrivateRoute><Alerts /></PrivateRoute>} />
            <Route path="/backup" element={<PrivateRoute><BackupManager /></PrivateRoute>} />
            <Route path="/regulation" element={<PrivateRoute><RegulationPage /></PrivateRoute>} />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}
