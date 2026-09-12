import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../db';
import { UserRole, UserStatus } from '../types';
import { UserPlus, ArrowLeft, Coins, Smartphone, CheckCircle2, MessageSquare, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { hashPassword } from '../lib/security';
import { setupRecaptcha, sendSmsCode, signInWithGoogle, signInWithFacebook } from '../lib/firebase';
import { ConfirmationResult } from 'firebase/auth';

export default function Register() {
  const { login } = useAuth();
  const [step, setStep] = useState(1); // 1: Details, 2: Verification
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    roles: [UserRole.GUICHETIER],
    photoUrl: ''
  });

  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const navigate = useNavigate();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) {
        setMessage({ type: 'error', text: "L'image est trop volumineuse. Veuillez choisir une image de moins de 500 Ko." });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThirdPartyRegister = async (provider: 'google' | 'facebook') => {
     setMessage(null);
     setIsSubmitting(true);
     try {
        const fbUser = provider === 'google' ? await signInWithGoogle() : await signInWithFacebook();
        setFormData({
           ...formData,
           fullName: fbUser.displayName || '',
           email: fbUser.email || '',
           phone: fbUser.phoneNumber || '',
           photoUrl: fbUser.photoURL || '',
           username: (fbUser.email?.split('@')[0] || fbUser.uid.substring(0, 8))
        });
        setMessage({ type: 'success', text: `Informations ${provider} importées. Veuillez compléter votre inscription.` });
     } catch (err) {
        setMessage({ type: 'error', text: `Erreur ${provider}: ` + (err as Error).message });
     } finally {
        setIsSubmitting(false);
     }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    
    setIsSubmitting(true);
    setMessage(null);
    try {
      const verifier = setupRecaptcha('recaptcha-container-reg');
      const result = await sendSmsCode(formData.phone, verifier);
      setConfirmationResult(result);
      setStep(2);
    } catch (err) {
      setMessage({ type: 'error', text: "Erreur d'envoi du code: " + (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      // 1. Verify SMS Code
      await confirmationResult.confirm(verificationCode);

      // 2. Check if username exists locally
      const existing = await db.users.where('username').equals(formData.username).first();
      if (existing) {
        setMessage({ type: 'error', text: 'Ce nom d\'utilisateur est déjà pris.' });
        setIsSubmitting(false);
        setStep(1);
        return;
      }

      const totalUsers = await db.users.count();
      const isFirstUser = totalUsers === 0;
      const status = isFirstUser ? UserStatus.ACTIVE : UserStatus.PENDING;
      const roles = isFirstUser ? [UserRole.ADMIN_PRINCIPAL, UserRole.SUPERVISEUR] : formData.roles;

      const { confirmPassword, ...userData } = formData;
      const hashedPassword = await hashPassword(userData.password);

      const newUser = {
        ...userData,
        password: hashedPassword,
        roles,
        status,
        createdAt: Date.now()
      };

      await db.users.add(newUser);

      if (isFirstUser) {
        setMessage({ type: 'success', text: `VOTRE COMPTE ADMINISTRATEUR PRINCIPAL EST ÉTABLI ! Votre identifiant est : ${formData.username}. Redirection vers la connexion...` });
        setTimeout(() => navigate('/login'), 4000);
      } else {
        setMessage({ type: 'success', text: `Compte vérifié et créé ! Votre identifiant est : ${formData.username}. En attente de validation par l'administration.` });
        setTimeout(() => navigate('/login'), 5000);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Code de validation incorrect ou erreur de création.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden">
      <div id="recaptcha-container-reg"></div>
      
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10 border border-white/20"
      >
        <div className="bg-neutral-950 p-6 text-center border-b border-white/10">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
             <Coins className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-black text-white mb-1 uppercase tracking-tighter">Inscription Ets Amani</h1>
          <p className="text-neutral-500 text-[10px] font-mono uppercase tracking-widest">Étape {step} sur 2 • Sécurisation par SMS</p>
        </div>

        <div className="p-6 md:p-8">
          {message && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className={cn(
                "p-4 mb-6 rounded-2xl text-xs font-bold border",
                message.type === 'success' ? "bg-green-50 border-green-100 text-green-700" : "bg-red-50 border-red-100 text-red-700"
              )}
            >
              {message.text}
            </motion.div>
          )}

          {step === 1 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 mb-2">
                 <button 
                    onClick={() => handleThirdPartyRegister('google')}
                    className="flex items-center justify-center p-3 rounded-xl border border-neutral-100 hover:bg-neutral-50 transition-colors gap-2 text-[10px] font-bold text-neutral-600"
                 >
                    <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                    Google
                 </button>
                 <button 
                    onClick={() => handleThirdPartyRegister('facebook')}
                    className="flex items-center justify-center p-3 rounded-xl border border-neutral-100 hover:bg-neutral-50 transition-colors gap-2 text-[10px] font-bold text-neutral-600"
                 >
                    <div className="w-4 h-4 bg-[#1877F2] rounded flex items-center justify-center text-white font-bold text-[10px]">f</div>
                    Facebook
                 </button>
              </div>

              <div className="relative flex items-center justify-center">
                 <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-100"></div></div>
                 <span className="relative bg-white px-4 text-[9px] font-black text-neutral-300 uppercase tracking-widest">Ou saisie manuelle</span>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="flex flex-col items-center gap-4 pb-4">
                  <div className="w-24 h-24 rounded-2xl bg-neutral-50 border-2 border-dashed border-neutral-200 flex items-center justify-center relative overflow-hidden group transition-all hover:border-blue-500">
                    {formData.photoUrl ? (
                      <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <UserPlus className="w-8 h-8 text-neutral-200" />
                    )}
                    <label className="absolute inset-0 bg-neutral-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <span className="text-[10px] text-white font-bold uppercase tracking-widest">Choisir</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider ml-1">Identifiant</label>
                    <input type="text" className="input h-12 rounded-xl" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider ml-1">Nom Complet</label>
                    <input type="text" className="input h-12 rounded-xl" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider ml-1">E-mail Professionnel</label>
                  <input type="email" className="input h-12 rounded-xl" required placeholder="nom@amani.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider ml-1">Téléphone (Format International)</label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input type="tel" className="input h-12 rounded-xl pl-10 font-mono" required placeholder="+243..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1">
                   <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider ml-1">Rôle Demandé</label>
                   <select className="input h-12 rounded-xl text-sm font-bold bg-neutral-50" value={formData.roles[0]} onChange={e => setFormData({...formData, roles: [e.target.value as UserRole]})}>
                     {Object.values(UserRole).map(role => (
                       <option key={role} value={role}>{role.replace('_', ' ').toUpperCase()}</option>
                     ))}
                   </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider ml-1">Mot de passe</label>
                    <input type="password" placeholder="••••••••" className="input h-12 rounded-xl" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider ml-1">Confirmation</label>
                    <input type="password" placeholder="••••••••" className="input h-12 rounded-xl" required value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full h-14 uppercase tracking-widest font-black text-xs shadow-xl shadow-blue-600/20 rounded-2xl">
                  {isSubmitting ? 'Préparation SMS...' : 'Envoyer le code de vérification'}
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="text-center space-y-4">
                 <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600">
                    <MessageSquare className="w-8 h-8" />
                 </div>
                 <div className="space-y-1">
                  <h3 className="text-lg font-bold text-neutral-800">Vérification SMS</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Un code à 6 chiffres a été envoyé au <span className="font-bold text-neutral-900">{formData.phone}</span>. 
                    Veuillez le saisir ci-dessous pour confirmer votre identité.
                  </p>
                 </div>
              </div>

              <div className="flex justify-center gap-2">
                 <input 
                   type="text" 
                   maxLength={6} 
                   className="w-48 h-16 text-center text-3xl font-black tracking-[0.4em] border-2 border-neutral-200 rounded-2xl focus:border-blue-600 focus:outline-none bg-neutral-50"
                   value={verificationCode}
                   onChange={e => setVerificationCode(e.target.value)}
                   autoFocus
                   required
                 />
              </div>

              <div className="flex gap-3">
                 <button type="button" onClick={() => setStep(1)} className="btn btn-secondary flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest">Retour</button>
                 <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20">
                   {isSubmitting ? 'Vérification...' : 'Confirmer Registration'}
                 </button>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-green-600 text-[10px] font-bold uppercase tracking-widest">
                 <ShieldCheck className="w-4 h-4" />
                 Protégé par Firebase Auth
              </div>
            </form>
          )}

          <div className="text-center pt-8 mt-8 border-t border-neutral-50">
             <Link to="/login" className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest hover:text-blue-600 transition-colors flex items-center justify-center gap-2">
                <ArrowLeft className="w-3 h-3" /> Retour à la connexion
             </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
