
'use client';

import { ShieldAlert, BarChart, CheckCircle, Clock } from 'lucide-react';
import type { Finding, FindingSeverity, FindingStatus } from '@/lib/types';
import { motion } from 'framer-motion';
import { Progress } from '../ui/progress';
import { cn } from '@/lib/utils';
import { SEVERITY_CONFIG, STATUSES_ORDERED } from '@/lib/types';


interface FindingsStatsProps {
  findings: Finding[];
  riskScore: number;
  severityCounts: Record<FindingSeverity, number>;
  statusCounts: Record<FindingStatus, number>;
}

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.3,
      ease: "easeOut"
    }
  })
};

export function FindingsStats({ riskScore, severityCounts, statusCounts }: FindingsStatsProps) {
  const getRiskColor = (score: number) => {
    if (score > 75) return 'text-red-400';
    if (score > 50) return 'text-orange-400';
    if (score > 25) return 'text-yellow-400';
    return 'text-cyan-400';
  };
  
  const getRiskIndicatorColor = (score: number) => {
    if (score > 75) return 'bg-red-400';
    if (score > 50) return 'bg-orange-400';
    if (score > 25) return 'bg-yellow-400';
    return 'bg-cyan-400';
  }

  const totalFindings = Object.values(severityCounts).reduce((a, b) => a + b, 0) + statusCounts.Accepted + statusCounts.Fixed + statusCounts.Verified;
  const openFindings = statusCounts.Open || 0;
  const remediatedCount = (statusCounts.Fixed || 0) + (statusCounts.Verified || 0);
  const remediationRate = totalFindings > 0 ? (remediatedCount / totalFindings) * 100 : 0;
  
  const severityOrder: FindingSeverity[] = ['Critical', 'High', 'Medium', 'Low', 'Informational'];
  const maxSeverityCount = Math.max(...Object.values(severityCounts), 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<ShieldAlert className={getRiskColor(riskScore)} />}
        title="Risk Score"
        value={riskScore}
        footer="Weighted score of open findings"
        index={0}
      >
        <Progress value={riskScore} className="h-1 mt-2" indicatorClassName={getRiskIndicatorColor(riskScore)} />
      </StatCard>

      <StatCard
        icon={<BarChart className="text-cyan-400" />}
        title="Open Findings"
        value={openFindings}
        index={1}
      >
        <div className="space-y-1.5 mt-2">
          {severityOrder.map(sev => (
            <div key={sev} className="flex items-center gap-2">
              <span className="text-[9px] font-sans text-slate-500 w-12">{sev.slice(0,4)}</span>
              <div className="flex-1 bg-slate-800/50 rounded-full h-1">
                  <motion.div 
                    className={cn("h-1 rounded-full", SEVERITY_CONFIG[sev].dot)}
                    initial={{ width: 0 }}
                    animate={{ width: `${(severityCounts[sev] / maxSeverityCount) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                  />
              </div>
              <span className="text-xs font-sans text-slate-400 w-4 text-right">{severityCounts[sev] || 0}</span>
            </div>
          ))}
        </div>
      </StatCard>

      <StatCard
        icon={<Clock className="text-orange-400" />}
        title="Finding Status"
        value={totalFindings}
        footer='Total Findings'
        index={2}
      >
        <div className="space-y-1 mt-2 text-xs font-sans">
            {STATUSES_ORDERED.map(status => (
              <div key={status} className="flex justify-between items-center">
                <span className="text-slate-500">{status}</span>
                <span className="text-slate-300">{statusCounts[status] || 0}</span>
              </div>
            ))}
        </div>
      </StatCard>

      <StatCard
        icon={<CheckCircle className="text-emerald-400" />}
        title="Remediation"
        value={remediationRate}
        suffix="%"
        footer={`${remediatedCount} of ${totalFindings} issues`}
        index={3}
      >
        <Progress value={remediationRate} className="h-1 mt-2" indicatorClassName="bg-emerald-500" />
      </StatCard>
    </div>
  );
}

function StatCard({ icon, title, value, footer, suffix, index, children }: { icon: React.ReactNode, title: string, value: number, footer?: string, suffix?: string, index: number, children?: React.ReactNode }) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={index}
      className="bg-[#0D0F12]/60 border border-slate-800/50 rounded-xl p-5 flex flex-col"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center bg-slate-800/50 rounded-lg">
          {icon}
        </div>
        <h3 className="text-[10px] font-sans text-slate-500 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="flex items-baseline gap-1.5 mt-3">
        <p className="text-3xl font-bold font-sans text-slate-100">{value.toFixed(0)}</p>
        {suffix && <span className="text-lg font-sans text-slate-600 -ml-1">{suffix}</span>}
      </div>
       {footer && <p className="text-[10px] font-sans text-slate-600 mt-1 h-4">{footer}</p>}
      <div className="flex-grow flex flex-col justify-end">
        {children}
      </div>
    </motion.div>
  );
}
