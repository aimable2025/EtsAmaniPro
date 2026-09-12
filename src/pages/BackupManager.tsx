import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SyncService } from '../services/SyncService';
import { db } from '../db';
import { 
  Database, 
  Download, 
  Upload, 
  Cloud, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle,
  History,
  CheckCircle2,
  FileJson,
  Lock
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatDate, formatCurrency } from '../lib/utils';
import { UserRole } from '../types';

export default function BackupManager() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const isAdmin = user?.roles.includes(UserRole.ADMIN_PRINCIPAL) || user?.roles.includes(UserRole.SUPERVISEUR);

  useEffect(() => {
    // Check for last backup in local storage
    const saved = localStorage.getItem('amani_last_backup');
    if (saved) setLastBackup(parseInt(saved));
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);
    try {
      const data = await SyncService.exportToBackup();
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `amani_backup_${new Date().toISOString().split('T')[0]}.backup`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      const now = Date.now();
      setLastBackup(now);
      localStorage.setItem('amani_last_backup', now.toString());
      
      await db.auditLogs.add({
        userId: user!.id!,
        action: 'BACKUP_EXPORT',
        details: 'Exportation manuelle des données vers fichier backup',
        timestamp: now
      });

      setMessage({ type: 'success', text: 'Sauvegarde locale effectuée avec succès.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de l\'exportation: ' + (err as Error).message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Attention: La restauration remplacera toutes les données locales par celles du fichier. Continuer ?')) {
      return;
    }

    setIsImporting(true);
    setMessage(null);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          await SyncService.importFromBackup(content);
          
          await db.auditLogs.add({
            userId: user!.id!,
            action: 'RESTORE_IMPORT',
            details: `Restauration manuelle depuis le fichier: ${file.name}`,
            timestamp: Date.now()
          });

          setMessage({ type: 'success', text: 'Restauration terminée. L\'application va se recharger.' });
          setTimeout(() => window.location.reload(), 2000);
        } catch (err) {
          setMessage({ type: 'error', text: 'Erreur de lecture du fichier: ' + (err as Error).message });
          setIsImporting(false);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de l\'importation: ' + (err as Error).message });
      setIsImporting(false);
    }
  };

  const handleCloudSync = async () => {
    if (!user) return;
    if (!window.confirm('Ceci remplacera vos données locales par les données stockées dans le Cloud. Continuer ?')) return;
    
    setIsSyncing(true);
    setMessage(null);
    try {
      await SyncService.triggerCloudRecovery(user);
      setMessage({ type: 'success', text: 'Restauration depuis le Cloud réussie.' });
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur synchronisation cloud: ' + (err as Error).message });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <Database className="w-8 h-8 text-blue-600" />
            Sauvegarde et Restauration
          </h1>
          <p className="text-neutral-500 mt-1">Gérez la sécurité et l'intégrité de vos données.</p>
        </div>
        
        {lastBackup && (
          <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-lg text-blue-700 text-sm border border-blue-100">
            <History className="w-4 h-4" />
            Dernière sauvegarde: <strong>{formatDate(lastBackup)}</strong>
          </div>
        )}
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-xl flex items-start gap-3",
            message.type === 'success' ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
          )}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <AlertTriangle className="w-5 h-5 mt-0.5" />}
          <p className="text-sm font-medium">{message.text}</p>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Section Sauvegarde */}
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Download className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-neutral-800">Sauvegarde Locale</h2>
          </div>
          
          <p className="text-neutral-600 text-sm mb-8 leading-relaxed">
            Exportez l'intégralité de vos données locales vers un fichier de sauvegarde (.backup) sécurisé. 
            Ce fichier pourra être utilisé pour restaurer votre application sur un autre appareil, même sans connexion internet.
          </p>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full btn btn-primary h-12 gap-2 text-sm font-bold shadow-lg shadow-blue-200"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {isExporting ? 'Génération du fichier...' : 'Lancer une sauvegarde maintenant'}
          </button>
          
          <p className="mt-4 text-[10px] text-neutral-400 text-center uppercase tracking-widest font-medium">
            Format: JSON Chiffré • Compatible Hors-ligne
          </p>
        </section>

        {/* Section Restauration */}
        <section className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Upload className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-bold text-neutral-800">Restauration Locale</h2>
          </div>
          
          <p className="text-neutral-600 text-sm mb-8 leading-relaxed">
            Sélectionnez un fichier .backup pour restaurer vos données. 
            <span className="font-bold text-red-600 block mt-2 underline">Attention: Cette action effacera vos données locales actuelles.</span>
          </p>

          <div className="relative">
            <input
              type="file"
              accept=".backup"
              onChange={handleImport}
              disabled={isImporting}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="w-full h-12 border-2 border-dashed border-neutral-300 rounded-xl flex items-center justify-center gap-2 text-neutral-500 hover:border-blue-500 hover:text-blue-500 transition-colors bg-neutral-50">
              {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
              <span className="text-sm font-bold">Sélectionner un fichier de secours</span>
            </div>
          </div>

          <p className="mt-4 text-[10px] text-neutral-400 text-center uppercase tracking-widest font-medium">
            Verification d'intégrité automatique lors de l'import
          </p>
        </section>

        {/* Section Cloud */}
        <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 shadow-xl text-white md:col-span-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                  <Cloud className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold">Synchronisation Cloud Intelligente</h2>
              </div>
              <p className="text-blue-100 text-sm max-w-2xl leading-relaxed">
                Vos données sont synchronisées en temps réel vers notre plateforme sécurisée. 
                Utilisez cette option pour récupérer vos données sur un nouvel appareil via votre compte utilisateur.
              </p>
            </div>

            <button
              onClick={handleCloudSync}
              disabled={isSyncing}
              className="btn bg-white text-blue-700 hover:bg-blue-50 h-14 px-8 border-none shadow-xl gap-2 font-bold whitespace-nowrap"
            >
              <RefreshCw className={cn("w-5 h-5", isSyncing && "animate-spin")} />
              {isSyncing ? 'Synchronisation...' : 'Forcer la synchronisation cloud'}
            </button>
          </div>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-white/10 pt-6">
            <div className="flex items-center gap-2 text-blue-100 italic">
              <Lock className="w-3 h-3" />
              <span className="text-xs">Chiffrement de bout en bout</span>
            </div>
            <div className="flex items-center gap-2 text-blue-100 italic">
              <History className="w-3 h-3" />
              <span className="text-xs">Historique des modifications</span>
            </div>
            <div className="flex items-center gap-2 text-blue-100 italic">
              <RefreshCw className="w-3 h-3" />
              <span className="text-xs">Sync Multi-agences</span>
            </div>
            <div className="flex items-center gap-2 text-blue-100 italic">
              <CheckCircle2 className="w-3 h-3" />
              <span className="text-xs">Disponibilité 99.9%</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
