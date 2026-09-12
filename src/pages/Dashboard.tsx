import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownLeft,
  Clock,
  History,
  Building2,
  User as UserIcon,
  ShieldAlert,
  FileText,
  DollarSign,
  Briefcase,
  Users,
  ChevronRight,
  Filter,
  ArrowRightLeft,
  ArrowRight,
  AlertTriangle,
  Zap,
  CheckCircle2,
  XCircle,
  Eye,
  BarChart3,
  Plus
} from 'lucide-react';
import { UserRole, UserStatus, ReportStatus, Currency, TransactionType, SlipStatus, SlipType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  Cell
} from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const isSupervisor = user?.roles.includes(UserRole.SUPERVISEUR) || user?.roles.includes(UserRole.ADMIN_PRINCIPAL);
  const isAdmin = user?.roles.includes(UserRole.ADMIN_PRINCIPAL) || user?.roles.includes(UserRole.SUPERVISEUR);
  const isCFO = user?.roles.includes(UserRole.COMPTABLE);
  
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterAgencyId, setFilterAgencyId] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const agencies = useLiveQuery(() => db.agencies.toArray());
  const allUsers = useLiveQuery(() => db.users.toArray());
  const allDebts = useLiveQuery(() => db.debts.toArray());
  const allReports = useLiveQuery(() => db.reports.toArray());
  const allBilletages = useLiveQuery(() => db.billetages.toArray());
  const transactions = useLiveQuery(async () => {
    let q = db.transactions.toCollection();
    
    // Applying basic filters if any (though useLiveQuery usually reacts to deps)
    return await q.toArray();
  }, []);

  const pendingSlips = useLiveQuery(() => db.slips.where('status').notEqual(SlipStatus.COMPLETED).toArray());

  const globalRate = useLiveQuery(async () => {
    const setting = await db.settings.get('exchange_rate');
    return setting?.value || 2850;
  });

  const stats = useMemo(() => {
    if (!transactions) return null;

    const todayStart = new Date(filterDate).setHours(0, 0, 0, 0);
    const todayEnd = new Date(filterDate).setHours(23, 59, 59, 999);

    const filtered = transactions.filter(t => {
      const matchesDate = t.timestamp >= todayStart && t.timestamp <= todayEnd;
      const matchesAgency = filterAgencyId === 'all' || t.agencyId === Number(filterAgencyId);
      const matchesType = filterType === 'all' || t.type === filterType;
      return matchesDate && matchesAgency && matchesType;
    });

    const usdIn = filtered.filter(t => t.currency === Currency.USD && t.type === TransactionType.DEPOT).reduce((sum, t) => sum + t.amount, 0);
    const usdOut = filtered.filter(t => t.currency === Currency.USD && t.type === TransactionType.RETRAIT).reduce((sum, t) => sum + t.amount, 0);
    const cdfIn = filtered.filter(t => t.currency === Currency.CDF && t.type === TransactionType.DEPOT).reduce((sum, t) => sum + t.amount, 0);
    const cdfOut = filtered.filter(t => t.currency === Currency.CDF && t.type === TransactionType.RETRAIT).reduce((sum, t) => sum + t.amount, 0);

    const totalOps = filtered.length;
    const activeAgencies = agencies?.length || 0;

    return { usdIn, usdOut, cdfIn, cdfOut, totalOps, activeAgencies };
  }, [transactions, filterDate, filterAgencyId, filterType, agencies]);

  const globalTreasury = useMemo(() => {
    if (!agencies) return { usd: 0, cdf: 0 };
    return agencies.reduce((acc, curr) => ({
      usd: acc.usd + curr.currentBalances.USD,
      cdf: acc.cdf + curr.currentBalances.CDF
    }), { usd: 0, cdf: 0 });
  }, [agencies]);

  const alerts = useMemo(() => {
    const list: any[] = [];
    if (!transactions || !agencies || !allBilletages || !allUsers) return list;

    // 1. Overdue debts
    allDebts?.filter(d => d.status !== 'paid' && Date.now() > d.dueDate).forEach(d => {
       const agency = agencies.find(a => a.id === d.agencyId);
       list.push({
         type: 'CRITIQUE',
         title: 'Dette en retard importante',
         description: `${d.debtorName} doit ${formatCurrency(d.amount, d.currency)}`,
         agency: agency?.name || 'Inconnue',
         category: 'Dette'
       });
    });

    // 2. Suspect Agents (Simple heuristic: > 5 withdrawals in an hour)
    const oneHourAgo = Date.now() - 3600000;
    const recentTx = transactions.filter(t => t.timestamp > oneHourAgo && t.type === TransactionType.RETRAIT);
    const agentCounts: Record<number, number> = {};
    recentTx.forEach(t => {
      agentCounts[t.userId] = (agentCounts[t.userId] || 0) + 1;
    });
    Object.entries(agentCounts).forEach(([userId, count]) => {
      if (count > 5) {
        const user = allUsers.find(u => u.id === Number(userId));
        const agency = agencies.find(a => a.id === user?.agencyId);
        list.push({
           type: 'ALERTE',
           title: 'Agent suspect (Fréquence)',
           description: `${user?.fullName} a effectué ${count} retraits en 1h`,
           agency: agency?.name || 'Inconnue',
           agent: user?.fullName,
           category: 'Anti-fraude'
        });
      }
    });

    // 3. Reports missing (If user has NO report for filterDate)
    allUsers.filter(u => u.roles.includes(UserRole.GUICHETIER)).forEach(u => {
      const hasReport = allReports?.some(r => r.userId === u.id && r.date === filterDate);
      if (!hasReport) {
        const agency = agencies.find(a => a.id === u.agencyId);
        list.push({
           type: 'ATTENTION',
           title: 'Rapport manquant',
           description: `Rapport journalier non envoyé par ${u.fullName}`,
           agency: agency?.name || 'Inconnue',
           agent: u.fullName,
           category: 'Rapport'
        });
      }
    });

    // 4. Billetage Discrepancy
    agencies.forEach(agency => {
      const lastBilletage = allBilletages
        .filter(b => b.agencyId === agency.id)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      
      if (lastBilletage) {
        // Compare lastBilletage.total with agency.currentBalances[lastBilletage.currency]
        const expected = agency.currentBalances[lastBilletage.currency as keyof typeof agency.currentBalances] || 0;
        const diff = Math.abs(lastBilletage.total - expected);
        if (diff > 0) {
          list.push({
            type: 'CRITIQUE',
            title: 'Écart de caisse détecté',
            description: `Écart de ${formatCurrency(diff, lastBilletage.currency)} à l'agence ${agency.name}`,
            agency: agency.name,
            category: 'Finance'
          });
        }
      }
    });

    return list;
  }, [transactions, agencies, allDebts, allReports, allUsers, allBilletages, filterDate]);

  const agencyPerformance = useMemo(() => {
    if (!agencies || !transactions) return [];
    
    return agencies.map(a => {
      const agencyTx = transactions.filter(t => t.agencyId === a.id);
      const usdIn = agencyTx.filter(t => t.currency === Currency.USD && t.type === TransactionType.DEPOT).reduce((sum, t) => sum + t.amount, 0);
      const usdOut = agencyTx.filter(t => t.currency === Currency.USD && t.type === TransactionType.RETRAIT).reduce((sum, t) => sum + t.amount, 0);
      const profit = usdIn - usdOut;
      
      let status = 'OK';
      if (profit < 0) status = 'CRITIQUE';
      else if (profit < 500) status = 'ATTENTION';

      return {
        id: a.id,
        name: a.name,
        totalIn: usdIn,
        totalOut: usdOut,
        result: profit,
        status
      };
    }).sort((a, b) => b.result - a.result);
  }, [agencies, transactions]);

  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  const updateReportStatus = async (id: number, status: ReportStatus) => {
    if (!isSupervisor) return;
    await db.reports.update(id, { status });
  };

  const reportDetails = useMemo(() => {
    if (!selectedReportId || !allReports) return null;
    const report = allReports.find(r => r.id === selectedReportId);
    if (!report) return null;
    const agent = allUsers?.find(u => u.id === report.userId);
    const agency = agencies?.find(a => a.id === report.agencyId);
    return { ...report, agent, agency };
  }, [selectedReportId, allReports, allUsers, agencies]);

  const dailyReportStats = useMemo(() => {
    // Current date logic is linked to filterDate
    if (!allUsers || !allReports || !agencies) return { received: 0, missing: 0, receivedList: [], missingList: [] };

    const guichetiers = allUsers.filter(u => u.roles.includes(UserRole.GUICHETIER));
    const reportsToday = allReports.filter(r => r.date === filterDate);
    
    const list = guichetiers.map(u => {
      const report = reportsToday.find(r => r.userId === u.id);
      const agency = agencies.find(a => a.id === u.agencyId);
      return {
        user: u,
        agency,
        report,
        status: report ? report.status : 'MISSING'
      };
    });

    return {
      received: reportsToday.length,
      missing: guichetiers.length - reportsToday.length,
      receivedList: list.filter(item => item.report),
      missingList: list.filter(item => !item.report)
    };
  }, [allUsers, allReports, agencies, filterDate]);

  if (!isSupervisor && !isCFO) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-3xl shadow-xl border border-neutral-100">
        <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-10 h-10 text-neutral-400" />
        </div>
        <h2 className="text-2xl font-bold font-serif italic mb-2">Accès Restreint</h2>
        <p className="text-neutral-500 max-w-md mx-auto">
          Ce tableau de bord est réservé aux superviseurs et à la direction pour une vue d'ensemble de l'activité.
        </p>
        <Link to="/transactions" className="btn btn-primary mt-8 px-8">
          Aller à mes transactions
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Report Details Modal */}
      <AnimatePresence>
        {reportDetails && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedReportId(null)} className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }} 
               animate={{ opacity: 1, scale: 1, y: 0 }} 
               exit={{ opacity: 0, scale: 0.95, y: 20 }} 
               className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
               <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                     </div>
                     <div>
                        <h3 className="font-bold text-lg text-neutral-900">Détails du Rapport</h3>
                        <p className="text-[10px] text-neutral-400 uppercase font-black">{reportDetails.agency?.name} • {reportDetails.date}</p>
                     </div>
                  </div>
                  <button onClick={() => setSelectedReportId(null)} className="text-neutral-400 hover:text-neutral-600">
                     <XCircle className="w-5 h-5" />
                  </button>
               </div>
               
               <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                     <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-neutral-100">
                        {reportDetails.agent?.photoUrl ? <img src={reportDetails.agent.photoUrl} className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6 m-auto mt-2.5 text-neutral-300" />}
                     </div>
                     <div>
                        <p className="text-sm font-bold text-neutral-900">{reportDetails.agent?.fullName}</p>
                        <p className="text-[10px] text-neutral-400 uppercase tracking-widest">{reportDetails.agent?.roles.join(', ')}</p>
                     </div>
                     <div className={cn(
                        "ml-auto px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                        reportDetails.status === ReportStatus.VALIDATED ? "bg-green-100 text-green-700" :
                        reportDetails.status === ReportStatus.PENDING ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                     )}>
                        {reportDetails.status}
                     </div>
                  </div>

                  <div className="bg-neutral-50 rounded-2xl p-6 italic text-sm text-neutral-700 leading-relaxed border border-neutral-100 min-h-[120px]">
                     "{reportDetails.details}"
                  </div>

                  {reportDetails.status === ReportStatus.PENDING && (
                    <div className="flex gap-4 mt-8">
                       <button onClick={() => { updateReportStatus(reportDetails.id!, ReportStatus.REJECTED); setSelectedReportId(null); }} className="flex-1 btn bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-100 h-12 font-bold transition-all uppercase tracking-widest text-[10px]">
                          Rejeter
                       </button>
                       <button onClick={() => { updateReportStatus(reportDetails.id!, ReportStatus.VALIDATED); setSelectedReportId(null); }} className="flex-1 btn btn-primary h-12 font-bold shadow-lg shadow-blue-500/20 uppercase tracking-widest text-[10px]">
                          Valider le Rapport
                       </button>
                    </div>
                  )}
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header & Global Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
           <div className="flex items-center gap-3 mb-1">
              <Zap className="w-5 h-5 text-blue-600 fill-blue-600" />
              <h1 className="text-4xl font-black tracking-tight text-neutral-900 font-serif italic">Ets Amani Intelligence</h1>
           </div>
           <p className="text-neutral-500 font-medium">Vue stratégique du réseau en temps réel</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3 p-2 bg-white rounded-2xl shadow-sm border border-neutral-100">
           <div className="relative flex-1 sm:flex-initial">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
              <input 
                type="date" 
                className="input pl-9 h-10 text-xs md:text-sm border-none bg-neutral-50 w-full" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
           </div>
           <select 
             className="input h-10 text-xs md:text-sm border-none bg-neutral-50 flex-1 sm:flex-initial"
             value={filterAgencyId}
             onChange={(e) => setFilterAgencyId(e.target.value)}
           >
              <option value="all">Agences</option>
              {agencies?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
           </select>
           <select 
             className="input h-10 text-xs md:text-sm border-none bg-neutral-50 flex-1 sm:flex-initial"
             value={filterType}
             onChange={(e) => setFilterType(e.target.value)}
           >
              <option value="all">Types</option>
              <option value={TransactionType.DEPOT}>Dépôts</option>
              <option value={TransactionType.RETRAIT}>Retraits</option>
              <option value={TransactionType.CHANGE}>Change</option>
           </select>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-4">
        {isAdmin && (
          <Link to="/users" className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 hover:bg-blue-100 transition-all font-bold text-xs uppercase tracking-widest">
            <Users className="w-4 h-4" /> Gérer Equipe
          </Link>
        )}
        <Link to="/operations" className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl border border-green-100 hover:bg-green-100 transition-all font-bold text-xs uppercase tracking-widest">
          <Plus className="w-4 h-4" /> Nouveau Bordereau
        </Link>
        <Link to="/reports" className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-xl border border-neutral-200 hover:bg-neutral-200 transition-all font-bold text-xs uppercase tracking-widest">
          <FileText className="w-4 h-4" /> Rapports Journaliers
        </Link>
      </div>

      {/* Operational Workflow Section */}
      <AnimatePresence>
        {pendingSlips && pendingSlips.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <div className="w-1.5 h-6 bg-red-500 rounded-full" />
                 <h2 className="text-xl font-display font-black text-neutral-800 uppercase tracking-tighter">Bordereaux en cours</h2>
               </div>
               <Link to="/operations" className="text-[10px] font-black uppercase text-blue-600 hover:underline flex items-center gap-1 group">
                 Voir tout le flux <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
               </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
               {pendingSlips.slice(0, 4).map(slip => (
                 <Link key={slip.id} to="/operations" className="card p-5 group relative overflow-hidden border-2 border-transparent hover:border-blue-500/10">
                    <div className="flex items-center justify-between mb-4">
                       <span className="text-[9px] font-mono font-bold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">#BOR-{slip.id}</span>
                       <div className={cn(
                         "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest",
                         slip.status === SlipStatus.PENDING_VALIDATION ? "bg-amber-100 text-amber-700" :
                         slip.status === SlipStatus.VALIDATED ? "bg-blue-100 text-blue-700" : "bg-neutral-100 text-neutral-500"
                       )}>
                         {slip.status.replace('EN_ATTENTE_', '').replace('_', ' ')}
                       </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest italic">{slip.type.replace('_', ' ')}</p>
                      <div className="flex items-baseline gap-1 text-xl font-display font-black tracking-tighter text-neutral-900 group-hover:text-blue-600 transition-colors">
                        {formatCurrency(slip.amount, slip.currency)}
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between">
                       <span className="text-[9px] font-mono text-neutral-400 italic">{formatDate(slip.timestamp)}</span>
                       <ArrowRight className="w-3 h-3 text-neutral-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </div>
                 </Link>
               ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Taux de Change & Résumé Global */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
         <motion.div 
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           className="card p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-xl shadow-blue-500/20 flex flex-col justify-between overflow-hidden relative group"
         >
            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:rotate-12 transition-transform">
               <ArrowRightLeft className="w-12 h-12" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-blue-100/60 mb-1">Taux de Change Actuel</p>
               <h3 className="text-3xl font-display font-black tracking-tighter">
                  1 USD <span className="text-blue-200">=</span>
               </h3>
            </div>
            <div className="mt-4">
               <div className="text-4xl font-mono font-black text-white drop-shadow-md">
                  {globalRate?.toLocaleString()}
               </div>
               <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">Franc Congolais (CDF)</p>
            </div>
            <div className="absolute -bottom-2 -left-2 w-16 h-16 bg-white/5 rounded-full blur-2xl" />
         </motion.div>

         <SummaryCard 
           title="Trésorerie Totale"
           mainValue={formatCurrency(globalTreasury.usd, 'USD')}
           secondaryValue={formatCurrency(globalTreasury.cdf, 'CDF')}
           icon={DollarSign}
           color="blue"
           trend="+0.5%"
         />
         <SummaryCard 
           title="Résultat du Jour"
           mainValue={formatCurrency(stats?.usdIn! - stats?.usdOut!, 'USD')}
           secondaryValue={`${stats?.totalOps} Opérations`}
           icon={stats?.usdIn! - stats?.usdOut! >= 0 ? TrendingUp : TrendingDown}
           color={stats?.usdIn! - stats?.usdOut! >= 0 ? 'green' : 'red'}
           trend="Aujourd'hui"
         />
         <SummaryCard 
           title="Agences Actives"
           mainValue={stats?.activeAgencies.toString() || '0'}
           secondaryValue="Sur tout le réseau"
           icon={Building2}
           color="neutral"
           trend="Local"
         />
         <SummaryCard 
           title="Alertes Actives"
           mainValue={alerts.length.toString()}
           secondaryValue="Niveau critique: 0"
           icon={AlertCircle}
           color={alerts.length > 0 ? 'red' : 'green'}
           trend="Action requise"
         />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         {/* 2. Performance & Alerts */}
         <div className="lg:col-span-8 space-y-8">
            {/* Alerts Section */}
            {alerts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold font-serif italic text-neutral-800">Alertes Prioritaires</h2>
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase">Urgent</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {alerts.slice(0, 4).map((alert, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-4 rounded-2xl border-l-4 shadow-sm bg-white flex items-start gap-4 transition-all hover:shadow-md",
                        alert.type === 'CRITIQUE' ? "border-red-500" : "border-amber-500"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        alert.type === 'CRITIQUE' ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"
                      )}>
                        {alert.type === 'CRITIQUE' ? <AlertCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase font-black text-neutral-400">{alert.category}</span>
                          <span className="text-[10px] font-bold text-neutral-900">{alert.agency}</span>
                        </div>
                        <h3 className="font-bold text-sm text-neutral-900 mb-1 truncate">{alert.title}</h3>
                        <p className="text-xs text-neutral-500 line-clamp-1">{alert.description}</p>
                      </div>
                      <button className="p-2 hover:bg-neutral-50 rounded-lg text-neutral-400 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Performance Widget */}
            <div className="card p-6 bg-white overflow-hidden">
               <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-xl font-bold font-serif italic text-neutral-800">Performance par Agence</h2>
                    <p className="text-xs text-neutral-400 font-mono tracking-widest uppercase">Résultat opérationnel</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">Live</span>
                  </div>
               </div>
               
               <div className="overflow-x-auto">
                 <table className="w-full">
                    <thead>
                       <tr className="text-left text-[10px] uppercase font-black text-neutral-400 tracking-widest border-b border-neutral-100 pb-3">
                          <th className="pb-4">Agence</th>
                          <th className="pb-4">Entrées</th>
                          <th className="pb-4">Sorties</th>
                          <th className="pb-4">Résultat</th>
                          <th className="pb-4 text-right">Statut</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                       {agencyPerformance.map((agency) => (
                          <tr key={agency.id} className="group hover:bg-neutral-50/50 transition-colors">
                             <td className="py-4">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-500 font-bold text-xs uppercase">
                                      {agency.name.substring(0, 2)}
                                   </div>
                                   <span className="font-bold text-sm text-neutral-800">{agency.name}</span>
                                </div>
                             </td>
                             <td className="py-4 text-sm font-mono font-bold text-neutral-600">{formatCurrency(agency.totalIn, 'USD')}</td>
                             <td className="py-4 text-sm font-mono font-bold text-neutral-400">{formatCurrency(agency.totalOut, 'USD')}</td>
                             <td className="py-4">
                                <span className={cn(
                                   "font-bold text-sm font-mono",
                                   agency.result >= 0 ? "text-green-600" : "text-red-500"
                                )}>
                                   {agency.result >= 0 ? '+' : ''}{formatCurrency(agency.result, 'USD')}
                                </span>
                             </td>
                             <td className="py-4 text-right">
                                <span className={cn(
                                   "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                                   agency.status === 'OK' ? "bg-green-100 text-green-700" : 
                                   agency.status === 'ATTENTION' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                )}>
                                   {agency.status}
                                </span>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
               </div>
            </div>

            {/* Visual Treasury Progress */}
            <div className="card p-6 bg-neutral-950 border-none text-white overflow-hidden relative">
               <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
               <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                     <div>
                        <h2 className="text-xl font-bold font-serif italic text-white/90">Progression Trésorerie</h2>
                        <p className="text-xs text-neutral-500 font-mono tracking-widest uppercase">Évolution des flux (USD)</p>
                     </div>
                     <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                           <div className="w-3 h-3 bg-blue-500 rounded-full" />
                           <span className="text-[10px] font-bold text-neutral-400 uppercase">Entrées</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="w-3 h-3 bg-neutral-700 rounded-full" />
                           <span className="text-[10px] font-bold text-neutral-400 uppercase">Sorties</span>
                        </div>
                     </div>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={chartData}>
                          <defs>
                             <linearGradient id="colorUsd" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.1} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#666' }} />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#171717', border: 'none', borderRadius: '12px', color: '#fff' }}
                            itemStyle={{ fontSize: '10px' }}
                          />
                          <Area type="monotone" dataKey="usd" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorUsd)" />
                          <Area type="monotone" dataKey="cdf" stroke="#444" strokeWidth={2} fill="transparent" />
                       </AreaChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </div>
         </div>

         {/* 3. Reports & Debts Sidebar */}
         <div className="lg:col-span-4 space-y-8">
            {/* Reports Tracker */}
            <div className="card p-6 bg-white">
               <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold font-serif italic text-neutral-800">Rapports Journaliers</h2>
                  <FileText className="w-5 h-5 text-neutral-400" />
               </div>
               
               <div className="flex gap-2 mb-6">
                  <div className="flex-1 p-3 rounded-2xl bg-neutral-50 text-center">
                     <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Reçus</p>
                     <p className="text-xl font-black text-neutral-800">{dailyReportStats.received}</p>
                  </div>
                  <div className="flex-1 p-3 rounded-2xl bg-amber-50 text-center border border-amber-100">
                     <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Manquants</p>
                     <p className="text-xl font-black text-amber-600">
                        {dailyReportStats.missing}
                     </p>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2 px-1">
                       <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                       <h4 className="text-[10px] uppercase font-black text-neutral-400 tracking-widest">Rapports reçus aujourd’hui</h4>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
                       {dailyReportStats.receivedList.length === 0 ? (
                         <div className="p-4 rounded-xl border border-dashed border-neutral-100 text-center text-[10px] text-neutral-400 italic">
                            Aucun rapport reçu
                         </div>
                       ) : dailyReportStats.receivedList.map((item, idx) => (
                          <ReportItemRow 
                            key={idx} 
                            item={item} 
                            onSelect={setSelectedReportId} 
                            onUpdate={updateReportStatus} 
                          />
                       ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2 px-1">
                       <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                       <h4 className="text-[10px] uppercase font-black text-neutral-400 tracking-widest">Rapports manquants aujourd’hui</h4>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
                       {dailyReportStats.missingList.length === 0 ? (
                         <div className="p-4 rounded-xl border border-dashed border-neutral-100 text-center text-[10px] text-neutral-400 italic">
                            Tous les rapports sont reçus
                         </div>
                       ) : dailyReportStats.missingList.map((item, idx) => (
                          <ReportItemRow 
                            key={idx} 
                            item={item} 
                            onSelect={setSelectedReportId} 
                            onUpdate={updateReportStatus} 
                          />
                       ))}
                    </div>
                  </div>

                  <Link to="/reports" className="btn btn-secondary w-full py-3 text-[10px] uppercase tracking-widest font-black mt-2">
                     Voir tous les Rapports
                  </Link>
               </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-3">
               <QuickActionButton icon={ArrowRightLeft} label="Transactions" color="blue" path="/transactions" />
               <QuickActionButton icon={Users} label="Utilisateurs" color="purple" path="/users" />
               <QuickActionButton icon={Briefcase} label="Dettes" color="orange" path="/debts" />
               <QuickActionButton icon={FileText} label="Rapports" color="green" path="/reports" />
               <QuickActionButton icon={ShieldAlert} label="Alertes" color="red" path="/" />
               <QuickActionButton icon={BarChart3} label="Audit Logs" color="neutral" path="/audit" />
            </div>

            {/* Dettes Quick Look */}
            <div className="card p-6 bg-white">
               <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold font-serif italic">Vue Dettes</h2>
                  <Briefcase className="w-5 h-5 text-neutral-400" />
               </div>
               
               <div className="p-4 rounded-2xl bg-neutral-900 text-white mb-6">
                  <p className="text-[10px] uppercase font-bold text-neutral-500 mb-1">Encours Global</p>
                  <p className="text-2xl font-black font-mono">
                    {formatCurrency(allDebts?.filter(d => d.status !== 'paid').reduce((sum, d) => sum + d.amount, 0) || 0, 'USD')}
                  </p>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                     <span className="text-neutral-500 font-medium">Clients Débiteurs</span>
                     <span className="font-bold text-neutral-800">{allDebts?.filter(d => d.type === 'client' && d.status !== 'paid').length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                     <span className="text-neutral-500 font-medium">Agents Endettés</span>
                     <span className="font-bold text-neutral-800">{allDebts?.filter(d => d.type === 'agent' && d.status !== 'paid').length}</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                     <div 
                       className="h-full bg-red-500" 
                       style={{ width: `${(allDebts?.filter(d => d.status !== 'paid' && Date.now() > d.dueDate).length || 0) / (allDebts?.length || 1) * 100}%` }} 
                     />
                  </div>
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-tight">
                    {(allDebts?.filter(d => d.status !== 'paid' && Date.now() > d.dueDate).length || 0)} dossiers en retard critique
                  </p>
               </div>
            </div>
         </div>
      </div>

      {/* 4. Activité Récente (Consolidée) */}
      <div className="card bg-white mt-12 overflow-hidden">
         <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
            <div>
               <h2 className="text-xl font-bold font-serif italic text-neutral-800">Journal d'Activité Global</h2>
               <p className="text-xs text-neutral-400 font-mono tracking-widest uppercase italic">Audit unifié du réseau</p>
            </div>
            <History className="w-5 h-5 text-neutral-400" />
         </div>
         <div className="overflow-x-auto">
           <table className="w-full">
              <thead>
                 <tr className="text-left text-[10px] uppercase font-black text-neutral-400 tracking-widest bg-neutral-50/50">
                    <th className="px-6 py-4">Utilisateur</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Agence</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Détails</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                 {transactions?.slice(0, 10).map((tx, idx) => {
                    const agent = allUsers?.find(u => u.id === tx.userId);
                    const agency = agencies?.find(a => a.id === tx.agencyId);
                    return (
                       <tr key={idx} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                                   {agent?.username.substring(0, 1).toUpperCase()}
                                </div>
                                <span className="text-xs font-bold text-neutral-800">{agent?.fullName}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-2">
                                <span className={cn(
                                   "w-2 h-2 rounded-full",
                                   tx.type === TransactionType.DEPOT ? "bg-green-500" : "bg-red-500"
                                )} />
                                <span className="text-xs font-medium capitalize">{tx.type}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4 text-xs text-neutral-500">{agency?.name}</td>
                          <td className="px-6 py-4 text-xs text-neutral-400 font-mono">{formatDate(tx.timestamp)}</td>
                          <td className="px-6 py-4 text-right">
                             <span className="text-[10px] font-bold text-neutral-900 font-mono">
                                {formatCurrency(tx.amount, tx.currency)}
                             </span>
                          </td>
                       </tr>
                    );
                 })}
              </tbody>
           </table>
         </div>
      </div>
    </div>
  );
}

function ReportItemRow({ item, onSelect, onUpdate }: any) {
  return (
    <div className="p-3 rounded-xl border border-neutral-100 hover:border-blue-200 transition-all bg-neutral-50/30 group relative">
       {/* Hover Preview Tooltip */}
       {item.report && item.report.details && (
         <div className="absolute right-full mr-4 top-0 z-50 w-48 p-3 bg-white border border-blue-100 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none translate-x-2 group-hover:translate-x-0 hidden md:block">
            <div className="absolute right-0 top-4 translate-x-1/2 w-2 h-2 bg-white border-t border-r border-blue-100 rotate-45" />
            <p className="text-[9px] font-black uppercase text-blue-500 tracking-widest mb-1">Aperçu du Rapport</p>
            <p className="text-[10px] text-neutral-600 italic leading-relaxed line-clamp-6">
               "{item.report.details}"
            </p>
         </div>
       )}

       <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
             <div className="w-7 h-7 rounded-lg bg-white shadow-sm border border-neutral-100 flex items-center justify-center overflow-hidden">
                {item.user.photoUrl ? <img src={item.user.photoUrl} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-3.5 h-3.5 text-neutral-400" />}
             </div>
             <div className="min-w-0">
                <p className="text-xs font-bold text-neutral-800 truncate">{item.user.fullName}</p>
                <p className="text-[9px] text-neutral-400 uppercase font-black truncate">{item.agency?.name}</p>
             </div>
          </div>
          <span className={cn(
             "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
             item.status === ReportStatus.PENDING ? "bg-amber-100 text-amber-700" :
             item.status === ReportStatus.VALIDATED ? "bg-green-100 text-green-700" : 
             item.status === ReportStatus.REJECTED ? "bg-red-100 text-red-700" : "bg-neutral-200 text-neutral-500"
          )}>
             {item.status.replace('_', ' ')}
          </span>
       </div>
       
       <div className="flex items-center justify-end gap-1">
          {item.report && (
            <>
              <button 
                onClick={() => onSelect(item.report!.id!)}
                className="p-1.5 hover:bg-white rounded-lg text-neutral-400 hover:text-blue-600 transition-all border border-transparent hover:border-blue-100"
                title="Détails"
              >
                 <Eye className="w-3.5 h-3.5" />
              </button>
              {item.status === ReportStatus.PENDING && (
                <>
                  <button 
                    onClick={() => onUpdate(item.report!.id!, ReportStatus.VALIDATED)}
                    className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg transition-all border border-transparent hover:border-green-100"
                    title="Valider"
                  >
                     <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => onUpdate(item.report!.id!, ReportStatus.REJECTED)}
                    className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-all border border-transparent hover:border-red-100"
                    title="Rejeter"
                  >
                     <XCircle className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </>
          )}
       </div>
    </div>
  );
}

function SummaryCard({ title, mainValue, secondaryValue, icon: Icon, color, trend }: any) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    red: "bg-red-50 text-red-600 border-red-200",
    neutral: "bg-neutral-50 text-neutral-600 border-neutral-200"
  };

  return (
    <div className="card p-6 bg-white border border-neutral-100 hover:border-blue-300 transition-all hover:shadow-lg group">
       <div className="flex items-center justify-between mb-4">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110", colors[color as keyof typeof colors])}>
             <Icon className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-black uppercase text-neutral-400 tracking-tighter">{trend}</span>
       </div>
       <div>
          <p className="text-[10px] uppercase font-black text-neutral-400 tracking-widest mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
             <h3 className="text-3xl font-black text-neutral-900 font-mono tracking-tighter">{mainValue}</h3>
          </div>
          <p className="text-xs text-neutral-500 italic mt-1">{secondaryValue}</p>
       </div>
    </div>
  );
}
function QuickActionButton({ icon: Icon, label, color, path }: any) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white",
    purple: "bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white",
    orange: "bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white",
    green: "bg-green-50 text-green-600 hover:bg-green-600 hover:text-white",
    red: "bg-red-50 text-red-600 hover:bg-red-600 hover:text-white",
    neutral: "bg-neutral-50 text-neutral-600 hover:bg-neutral-600 hover:text-white"
  };

  return (
    <Link to={path} className={cn(
      "flex flex-col items-center justify-center aspect-square rounded-3xl transition-all shadow-sm border border-neutral-100 group",
      colors[color as keyof typeof colors]
    )}>
       <Icon className="w-6 h-6 mb-2 transition-transform group-hover:scale-110" />
       <span className="text-[10px] font-black uppercase tracking-tighter text-center">{label}</span>
    </Link>
  );
}

const chartData = [
  { name: 'Lun', usd: 12000, cdf: 8000 },
  { name: 'Mar', usd: 15600, cdf: 9000 },
  { name: 'Mer', usd: 14000, cdf: 12000 },
  { name: 'Jeu', usd: 18000, cdf: 11000 },
  { name: 'Ven', usd: 22000, cdf: 15000 },
  { name: 'Sam', usd: 21000, cdf: 14000 },
  { name: 'Dim', usd: 19000, cdf: 12000 },
];
