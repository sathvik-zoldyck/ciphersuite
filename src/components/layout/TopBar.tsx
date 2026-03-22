"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Search, ChevronRight } from "lucide-react";
import { useProject } from "@/hooks/use-project";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { UserNav } from "@/components/layout/UserNav";

const ROUTE_LABELS: Record<string, string> = {
  "": "Dashboard", // Handle the root project page
  "dashboard": "Dashboard",
  "findings":  "Findings",
  "evidence":  "Evidence",
  "notes":     "Notes",
  "logs":      "Logs",
  "reports":   "Reports",
  "settings":  "Settings",
};

function getPageLabel(segment: string): string {
  return (
    ROUTE_LABELS[segment.toLowerCase()] ??
    segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
  );
}

export default function AppHeader() {
  const pathname  = usePathname();
  const params    = useParams();
  const projectId = params.projectId as string | undefined;

  const { project, isLoading: projectLoading } = useProject(projectId ?? "");

  const segments = pathname.split("/").filter(Boolean);
  // segments for '/projects/[id]' is ['projects', '[id]'] -> current is 'dashboard'
  // segments for '/projects/[id]/findings' is ['projects', '[id]', 'findings'] -> current is 'findings'
  const currentSegment = segments.length > 2 ? segments[segments.length - 1] : '';
  
  const pageLabel = getPageLabel(currentSegment);

  return (
    <header className={cn(
      "flex h-12 items-center gap-3 flex-shrink-0",
      "border-b border-slate-800/50",
      "bg-[#09090B]/95 backdrop-blur-sm",
      "px-3 sm:px-4",
    )}>

      <SidebarTrigger className="md:hidden -ml-1 text-slate-600 hover:text-slate-300 transition-colors" />

      <nav className="hidden md:flex items-center gap-1.5 text-[12px] font-mono min-w-0 flex-1">
        <Link href="/" className="text-slate-600 hover:text-slate-300 transition-colors shrink-0">
          Workspaces
        </Link>

        {projectId && (
          <>
            <ChevronRight className="w-3 h-3 text-slate-800 shrink-0" strokeWidth={1.75} />

            {projectLoading ? (
              <Skeleton className="h-3.5 w-24 bg-slate-800/80 rounded" />
            ) : (
              <Link
                href={`/projects/${projectId}`}
                className="text-slate-500 hover:text-slate-300 transition-colors max-w-[140px] truncate"
              >
                {project?.name ?? "Project"}
              </Link>
            )}

            <ChevronRight className="w-3 h-3 text-slate-800 shrink-0" strokeWidth={1.75} />
            <span className="text-slate-300 font-medium truncate">{pageLabel}</span>
          </>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">

        <div className="relative hidden md:flex items-center">
          <Search
            className="absolute left-2.5 w-[13px] h-[13px] text-slate-600 pointer-events-none"
            strokeWidth={1.75}
          />
          <input
            placeholder="Search…"
            className={cn(
              "h-[30px] w-36 lg:w-52 pl-7 pr-3",
              "bg-white/[0.03] border border-slate-800/80 rounded-md",
              "font-mono text-[12px] text-slate-300 placeholder:text-slate-700",
              "outline-none transition-all duration-150",
              "focus:bg-white/[0.05] focus:border-slate-700 focus:w-44 lg:focus:w-60",
            )}
          />
        </div>

        <button className="relative flex items-center justify-center w-[30px] h-[30px] rounded-md text-slate-600 hover:text-slate-300 hover:bg-white/[0.04] transition-colors">
          <Bell className="w-[14px] h-[14px]" strokeWidth={1.75} />
        </button>

        <div className="w-px h-4 bg-slate-800/80 mx-0.5" />

        <UserNav />
        
      </div>
    </header>
  );
}
