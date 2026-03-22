
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import {
  LayoutDashboard, Bug, Paperclip, BookText,
  FileText, FileBarChart2, Settings, ArrowLeft,
  ChevronRight, Zap, Shield,
} from "lucide-react";
import {
  Sidebar, SidebarHeader, SidebarContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarFooter, SidebarSeparator, SidebarGroup,
  SidebarGroupLabel, useSidebar, SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useProject }    from "@/hooks/use-project";
import { useCollection } from "@/hooks/use-collection";
import { useAuth }       from "@/context/AuthContext";
import { collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Finding } from "@/lib/types";

interface NavItem {
  href:       string;
  icon:       React.ElementType;
  label:      string;
  showBadge?: boolean;
}

const CORE_NAV: NavItem[] = [
  { href: "", icon: LayoutDashboard, label: "Dashboard"              },
  { href: "/findings",  icon: Bug,             label: "Findings", showBadge: true },
  { href: "/evidence",  icon: Paperclip,       label: "Evidence"               },
  { href: "/notes",     icon: BookText,        label: "Notes"                  },
  { href: "/logs",      icon: FileText,        label: "Logs"                   },
];

const REPORTING_NAV: NavItem[] = [
  { href: "/reports", icon: FileBarChart2, label: "Reports" },
];

const SYSTEM_NAV: NavItem[] = [
  { href: "/settings", icon: Settings, label: "Settings" },
];

function NavRow({
  item, projectId, openCount,
}: {
  item:       NavItem;
  projectId:  string;
  openCount?: number;
}) {
  const pathname  = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const fullPath = `/projects/${projectId}${item.href}`;
  
  const isDashboard = item.href === "";
  const isActive = isDashboard
    ? pathname === fullPath // Exact match for dashboard
    : pathname.startsWith(fullPath); // Prefix match for all others

  const Icon      = item.icon;
  const showCount = item.showBadge && openCount !== undefined && openCount > 0;

  return (
    <SidebarMenuItem className="relative">
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={{ children: item.label, side: "right" }}
        className={cn(
          "relative flex items-center gap-3 px-3 h-9 rounded-lg w-full",
          "text-[13px] font-mono font-medium transition-all duration-150",
          "focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:outline-none",
          isActive
            ? "bg-cyan-500/10 text-cyan-300"
            : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]",
        )}
      >
        <Link href={fullPath} className="flex items-center gap-3 flex-1 min-w-0">
          <AnimatePresence>
            {isActive && (
              <motion.div
                layoutId="sidebar-active-bar"
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{   opacity: 0, scaleY: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-cyan-400"
                style={{ boxShadow: "0 0 8px rgba(6,182,212,0.6)" }}
              />
            )}
          </AnimatePresence>

          <Icon
            className={cn(
              "flex-shrink-0 w-4 h-4 transition-colors duration-150",
              isActive ? "text-cyan-400" : "text-slate-600"
            )}
          />

          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}

          {/* Live open-findings badge */}
          {!collapsed && showCount && (
            <span className={cn(
              "ml-auto flex items-center justify-center min-w-[18px] h-[16px] px-1",
              "rounded-[4px] text-[9px] font-mono font-bold",
              isActive
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/25"
                : "bg-red-500/10 text-red-400 border border-red-500/20",
            )}>
              {openCount! > 99 ? "99+" : openCount}
            </span>
          )}

          {collapsed && showCount && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-400" />
          )}

          {!collapsed && isActive && !showCount && (
            <ChevronRight className="w-3 h-3 text-cyan-500/50 flex-shrink-0" />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export default function AppSidebar({ projectId }: { projectId: string }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { project }  = useProject(projectId);
  const { isGuest }  = useAuth();

  // No ownerId filter — Finding type no longer has ownerId field.
  // Firestore rules (ownsProject) already scope results to the project owner.
  const findingsRef = useMemo(() => {
    if (!projectId || isGuest) return null;
    return query(
      collection(db, "projects", projectId, "findings"),
      where("status", "==", "Open")
    );
  }, [projectId, isGuest]);

  const { count: openCount } = useCollection<Finding>(findingsRef);

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-800/60 bg-[#0A0B0D]">
      <SidebarRail />

      <SidebarHeader className="px-3 py-4 border-b border-slate-800/60">
        <Link href="/" className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/[0.04]">
          <div className="relative flex-shrink-0">
            <div className="w-7 h-7 rounded-lg overflow-hidden">
              <Image src="/logo.png" alt="CipherSuite" width={28} height={28} className="object-cover" />
            </div>
            <div className="absolute inset-0 rounded-lg -z-10 blur-md opacity-60" style={{ background: "rgba(6,182,212,0.4)" }} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold font-display text-slate-100 leading-none truncate">CipherSuite</p>
              <p className="text-[9px] font-mono text-slate-700 mt-0.5 tracking-wide">by Alcyone Secure</p>
            </div>
          )}
        </Link>

        {!collapsed && project && (
          <div className="mt-2 px-1.5">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03] border border-slate-800/80">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full flex-shrink-0",
                project.status === "Active"  ? "bg-emerald-400 animate-pulse" :
                project.status === "On Hold" ? "bg-amber-400" : "bg-slate-500"
              )} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-mono font-semibold text-slate-300 truncate leading-tight">{project.name}</p>
                <p className="text-[9px] font-mono text-slate-700 truncate mt-0.5">{project.type}</p>
              </div>
            </div>
          </div>
        )}
        {!collapsed && !project && (
          <div className="mt-2 px-1.5">
            <div className="h-10 rounded-lg skeleton" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 overflow-y-auto scrollbar-thin">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-slate-700 px-3 mb-1">
              Workspace
            </SidebarGroupLabel>
          )}
          <SidebarMenu className="space-y-0.5">
            {CORE_NAV.map((item) => (
              <NavRow key={item.href} item={item} projectId={projectId} openCount={item.showBadge ? openCount : undefined} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator className="my-3 bg-slate-800/60" />

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-slate-700 px-3 mb-1">
              Reporting
            </SidebarGroupLabel>
          )}
          <SidebarMenu className="space-y-0.5">
            {REPORTING_NAV.map((item) => (
              <NavRow key={item.href} item={item} projectId={projectId} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {!collapsed && (
          <div className="mx-1 mt-3 px-3 py-2.5 rounded-xl border border-cyan-500/15 bg-cyan-500/[0.04]">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3 h-3 text-cyan-500/60" />
              <span className="text-[9px] font-mono font-bold text-cyan-600 uppercase tracking-wider">AI Assist</span>
            </div>
            <p className="text-[10px] font-mono text-slate-700 leading-relaxed">
              Draft findings and remediation with one click from any finding.
            </p>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="px-2 py-3 border-t border-slate-800/60 space-y-0.5">
        <SidebarMenu className="space-y-0.5">
          {SYSTEM_NAV.map((item) => (
            <NavRow key={item.href} item={item} projectId={projectId} />
          ))}
        </SidebarMenu>

        <SidebarSeparator className="my-2 bg-slate-800/60" />

        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            tooltip={{ children: "All Projects", side: "right" }}
            className="flex items-center gap-3 px-3 h-9 rounded-lg w-full text-[13px] font-mono font-medium transition-all text-slate-600 hover:text-slate-300 hover:bg-white/[0.04]"
          >
            <Link href="/" className="flex items-center gap-3">
              <ArrowLeft className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>All Projects</span>}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {!collapsed && (
          <div className="flex items-center justify-center gap-1.5 pt-3 pb-1">
            <Shield className="w-2.5 h-2.5 text-slate-800" />
            <span className="text-[9px] font-mono text-slate-800 tracking-wide">Alcyone Secure</span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
