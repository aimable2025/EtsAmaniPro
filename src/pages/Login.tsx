import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../db';
import { Lock, User as UserIcon, Coins, RefreshCcw, Smartphone, MessageSquare, ShieldCheck, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React from 'react';
import { hashPassword } from '../lib/security';
import { signInWithGoogle, signInWithFacebook, setupRecaptcha, sendSmsCode, db_fs } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ConfirmationResult } from 'firebase/auth';
import { SyncService } from '../services/SyncService';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginMode, setLoginMode] = useState<'standard' | 'phone'>('standard');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    db.users.count().then(setUserCount);
  }, []);

  const handleCloudRecovery = async () => {
    if (!username) {
        setError('Veuillez entrer votre email ou identifiant pour la récupération cloud.');
        return;
    }
    setIsSubmitting(true);
    setError('');
    try {
        const q = query(collection(db_fs, 'users'), where('email', '==', username));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            setError('Aucun compte trouvé dans le cloud pour cet identifiant.');
        } else {
            const userData = snapshot.docs[0].data() as any;
            await db.users.put(userData);
            setError('Compte récupéré du cloud. Veuillez entrer votre mot de passe.');
            setUserCount(1);
        }
    } catch (err) {
        setError('Erreur de récupération cloud: ' + (err as Error).message);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleThirdPartyLogin = async (provider: 'google' | 'facebook') => {
    setError('');
    setIsSubmitting(true);
    try {
      const fbUser = provider === 'google' ? await signInWithGoogle() : await signInWithFacebook();
      if (!fbUser?.email && !fbUser?.phoneNumber) throw new Error('Identifiant non récupéré');

      // Check cloud first using email or phone
      const email = fbUser.email;
      const phoneNum = fbUser.phoneNumber;
      
      let q;
      if (email) {
        q = query(collection(db_fs, 'users'), where('email', '==', email));
      } else {
        q = query(collection(db_fs, 'users'), where('phone', '==', phoneNum));
      }
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data() as any;
        await db.users.put(userData);
        login(userData);
        navigate('/');
      } else {
        setError(`Aucun compte Ets Amani associé à vos infos ${provider}. Veuillez vous inscrire d'abord.`);
      }
    } catch (err) {
      setError(`Erreur ${provider} Auth: ` + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneAuthStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const verifier = setupRecaptcha('recaptcha-container');
      const result = await sendSmsCode(phone, verifier);
      setConfirmationResult(result);
    } catch (err) {
      setError('Erreur d\'envoi SMS: ' + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    
    setError('');
    setIsSubmitting(true);
    try {
      const result = await confirmationResult.confirm(otp);
      const fbUser = result.user;
      
      const q = query(collection(db_fs, 'users'), where('phone', '==', fbUser.phoneNumber));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data() as any;
        await db.users.put(userData);
        login(userData);
        navigate('/');
      } else {
        setError('Aucun compte Ets Amani associé à ce numéro de téléphone.');
      }
    } catch (err) {
      setError('Code incorrect ou expiré.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualResetUsers = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir réinitialiser et supprimer TOUS les comptes utilisateurs ?\nTous les comptes créés seront effacés afin de repartir à zéro.")) {
      setIsSubmitting(true);
      try {
        await SyncService.resetAllUsers();
        setUserCount(0);
        setError('Tous les comptes utilisateurs ont été réinitialisés avec succès. Vous pouvez maintenant créer le nouveau compte Administrateur Principal.');
      } catch (err) {
        setError('Erreur lors de la réinitialisation : ' + (err as Error).message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const user = await db.users
        .where('username').equals(username)
        .or('email').equals(username)
        .or('phone').equals(username)
        .first();

      const hashedSearch = await hashPassword(password);

      if (user && user.password === hashedSearch) {
        if (user.status !== 'active') {
          setError('Votre compte est en attente de validation par un administrateur.');
          setIsSubmitting(false);
          return;
        }
        login(user);
        navigate('/');
      } else {
        setError('Nom d\'utilisateur ou mot de passe incorrect.');
      }
    } catch (err) {
      setError('Une erreur est survenue lors de la connexion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden">
      {/* Recaptcha hidden container */}
      <div id="recaptcha-container"></div>

      {/* Decorative Orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10 border border-white/20"
      >
        <div className="bg-neutral-950 p-6 md:p-8 text-center border-b border-white/10">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-blue-500/40 mb-6 rotate-3 hover:rotate-0 transition-transform duration-500">
            <Coins className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">ETS <span className="text-blue-500">AMANI</span></h1>
          <p className="text-neutral-500 text-[10px] font-mono uppercase tracking-[0.3em]">Infrastructure Financière Sécurisée</p>
          
          <div className="mt-6 flex bg-white/5 p-1 rounded-xl gap-1">
             <button 
                onClick={() => { setLoginMode('standard'); setError(''); }}
                className={cn(
                  "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  loginMode === 'standard' ? "bg-white text-neutral-950 shadow-lg" : "text-neutral-500 hover:text-white"
                )}
             >
               Standard
             </button>
             <button 
                onClick={() => { setLoginMode('phone'); setError(''); }}
                className={cn(
                  "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  loginMode === 'phone' ? "bg-white text-neutral-950 shadow-lg" : "text-neutral-500 hover:text-white"
                )}
             >
               Téléphone / SMS
             </button>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {userCount === 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                Comptes réinitialisés
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Tous les anciens comptes ont été réinitialisés. Veuillez créer le premier compte pour établir l'<strong>Administrateur Principal</strong> d'Ets Amani.
              </p>
              <Link 
                to="/register" 
                className="btn btn-primary w-full h-10 text-xs font-black uppercase tracking-widest rounded-xl inline-flex items-center justify-center gap-2"
              >
                Créer l'Administrateur Principal
              </Link>
            </div>
          )}

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-bold"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {loginMode === 'standard' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Identifiant / Email</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
                  <input 
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input h-14 pl-12 rounded-2xl bg-neutral-50 border-neutral-200 focus:bg-white transition-all shadow-sm"
                    placeholder="Identifiant ou Email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
                  <input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input h-14 pl-12 rounded-2xl bg-neutral-50 border-neutral-200 focus:bg-white transition-all shadow-sm"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="btn btn-primary w-full h-14 text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-600/20"
              >
                {isSubmitting ? 'Authentification...' : 'Se Connecter'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {!confirmationResult ? (
                <form onSubmit={handlePhoneAuthStart} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Numéro de Téléphone</label>
                    <div className="relative">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
                      <input 
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="input h-14 pl-12 rounded-2xl bg-neutral-50 border-neutral-200 focus:bg-white font-mono tracking-widest"
                        placeholder="+243..."
                        required
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="btn btn-primary w-full h-14 text-sm font-black uppercase tracking-widest rounded-2xl"
                  >
                    {isSubmitting ? 'Envoi...' : 'Recevoir le code SMS'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleOtpVerify} className="space-y-4 text-center">
                  <div className="space-y-1 text-center">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Entrez le code reçu</label>
                    <div className="relative flex justify-center">
                      <input 
                        type="text"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full max-w-[200px] h-14 md:h-16 text-center text-2xl md:text-3xl font-black tracking-[0.4em] border-2 border-neutral-200 rounded-2xl focus:border-blue-600 focus:outline-none bg-neutral-50"
                        autoFocus
                        required
                      />
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-2">Code envoyé au {phone}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setConfirmationResult(null); setOtp(''); }} className="btn btn-secondary flex-1 h-14 rounded-2xl">Réessayer</button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="btn btn-primary flex-[2] h-14 text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-600/20"
                    >
                      {isSubmitting ? 'Vérification...' : 'Valider le Code'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
             <button 
                type="button"
                onClick={() => handleThirdPartyLogin('google')}
                className="flex items-center justify-center p-3 rounded-2xl border border-neutral-200 hover:bg-neutral-50 transition-colors gap-2 text-[10px] font-bold text-neutral-700"
             >
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                Google
             </button>
             <button 
                type="button"
                onClick={() => handleThirdPartyLogin('facebook')}
                className="flex items-center justify-center p-3 rounded-2xl border border-neutral-200 hover:bg-neutral-50 transition-colors gap-2 text-[10px] font-bold text-neutral-700 font-sans"
             >
                <div className="w-4 h-4 bg-[#1877F2] rounded flex items-center justify-center text-white font-bold text-[10px]">f</div>
                Facebook
             </button>
          </div>

          <div className="pt-4 flex flex-col items-center gap-4 border-t border-neutral-100">
             <p className="text-xs text-neutral-400">Vous n'avez pas de compte ?</p>
             <Link 
               to="/register" 
               className="btn btn-secondary w-full h-12 text-[10px] uppercase tracking-widest font-black border-neutral-200"
             >
               Créer un compte professionnel
             </Link>
             
             {userCount === 0 ? (
                <button 
                    type="button"
                    onClick={handleCloudRecovery}
                    className="text-[10px] text-blue-600 font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:underline"
                >
                    <RefreshCcw className="w-3 h-3" /> Récupérer mon accès du Cloud
                </button>
             ) : (
                <button 
                    type="button"
                    onClick={handleManualResetUsers}
                    className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors pt-2 border-t border-neutral-100 w-full"
                >
                    <Trash2 className="w-3.5 h-3.5" /> Réinitialiser tous les comptes
                </button>
             )}
          </div>
        </div>

        <div className="p-6 bg-neutral-950 text-white/40 text-center text-[10px] font-mono">
           &copy; 2026 ETS AMANI. <br /> GESTION FINANCIÈRE SÉCURISÉE & SYNCHRONISÉE
        </div>
      </motion.div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
