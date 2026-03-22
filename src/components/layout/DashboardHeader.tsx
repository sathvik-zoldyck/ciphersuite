"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { StickyNote, Plus } from "lucide-react";
import { UserNav } from "@/components/layout/UserNav";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

interface DashboardHeaderProps {
  projects: Project[];
  isGuest: boolean;
  onNewProject: () => void;
}

export function DashboardHeader({ projects, isGuest, onNewProject }: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <Image src="/logo.png" alt="CipherSuite" width={32} height={32} className="rounded-lg" />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-display text-slate-100">CipherSuite</span>
            {isGuest && (
              <span className="text-[9px] font-mono text-amber-500/70 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 uppercase tracking-wider">
                Guest
              </span>
            )}
          </div>
          <span className="text-[9px] font-mono text-slate-700">by Alcyone Secure</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {projects.length > 0 && (
          <>
            <Link href="/notes">
              <button className={cn(
                "flex items-center gap-2 h-8 px-3 rounded-lg border transition-colors",
                "border-slate-800 bg-transparent text-slate-500 hover:text-violet-400 hover:border-violet-500/30 hover:bg-violet-500/[0.04]",
                "text-[11px] font-mono"
              )}>
                <StickyNote className="w-3.5 h-3.5" />
                Notes
              </button>
            </Link>
            <button onClick={onNewProject} className="btn-primary h-8 px-4 gap-2 text-[11px]">
              <Plus className="w-3.5 h-3.5" />
              New Project
            </button>
          </>
        )}
        <UserNav />
      </div>
    </div>
  );
}
