import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, CheckCircle2, ChevronRight, FileText, AlertTriangle } from 'lucide-react';
import { Regulation } from '../types';
import { RegulationService } from '../services/RegulationService';
import { cn } from '../lib/utils';

interface Props {
  userId: number;
  onAccept: () => void;
}

export default function RegulationModal({ userId, onAccept }: Props) {
  const [regulation, setRegulation] = useState<Regulation | null>(null);
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    RegulationService.getActiveRegulation().then(setRegulation);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      setHasReadToBottom(true);
    }
  };

  const handleAccept = async () => {
    if (!regulation || !hasReadToBottom) return;
    
    setIsSubmitting(true);
    try {
      await RegulationService.acceptRegulation(userId, regulation.id!, regulation.version);
      setAccepted(true);
      setTimeout(onAccept, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!regulation) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 bg-neutral-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight">{regulation.title}</h2>
                <p className="text-[10px] text-neutral-400 font-mono uppercase tracking-widest">Version {regulation.version}.0 • Officiel</p>
              </div>
            </div>
            <div className="px-3 py-1 bg-white/10 rounded-full border border-white/10 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Lecture Requise</span>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="bg-amber-50 border-y border-amber-100 px-6 py-3 flex items-center gap-3 shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              L'accès à l'application est restreint jusqu'à l'acceptation formelle de ce règlement.
            </p>
          </div>

          {/* Content Area */}
          <div 
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar bg-neutral-50/50"
          >
            {regulation.sections.map((section, idx) => (
              <div key={idx} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center text-xs font-black">
                    {(idx + 1).toString().padStart(2, '0')}
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-neutral-800">{section.title}</h3>
                </div>
                <div className="pl-11 pr-4 prose prose-sm prose-neutral max-w-none">
                  <p className="text-neutral-600 leading-relaxed text-sm whitespace-pre-wrap font-medium">
                    {section.content}
                  </p>
                </div>
              </div>
            ))}
            
            <div className="pt-10 pb-4 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-xl border border-neutral-200">
                <FileText className="w-4 h-4 text-neutral-400" />
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Fin du document • Signez ci-dessous</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 bg-white border-t border-neutral-100 shrink-0">
            {!hasReadToBottom && (
              <div className="mb-4 text-center">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest animate-bounce">
                  Faites défiler jusqu'en bas pour activer le bouton d'acceptation
                </p>
              </div>
            )}
            
            <button
              onClick={handleAccept}
              disabled={!hasReadToBottom || isSubmitting || accepted}
              className={cn(
                "w-full h-16 rounded-2xl flex items-center justify-center gap-3 transition-all font-black uppercase tracking-widest text-sm",
                accepted 
                  ? "bg-green-600 text-white shadow-xl shadow-green-500/20" 
                  : !hasReadToBottom
                    ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                    : "bg-blue-600 text-white shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              {accepted ? (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  Règlement Accepté
                </>
              ) : isSubmitting ? (
                "Signature en cours..."
              ) : (
                <>
                  J'accepte le règlement d'ordre intérieur
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="mt-4 text-[9px] text-center text-neutral-400 uppercase font-bold tracking-widest">
              En cliquant, vous confirmez avoir lu, compris et vous engagez à respecter strictement les clauses ci-dessus.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
