"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
import { useProject } from "@/hooks/use-project";

// ─── Navigation config ────────────────────────────────────────────────────────

interface NavItem {
  href:    string;
  icon:    React.ElementType;
  label:   string;
  badge?:  string;
}

const CORE_NAV: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard"  },
  { href: "/findings",  icon: Bug,             label: "Findings"   },
  { href: "/evidence",  icon: Paperclip,       label: "Evidence"   },
  { href: "/notes",     icon: BookText,        label: "Notes"      },
  { href: "/logs",      icon: FileText,        label: "Logs"       },
];

const REPORTING_NAV: NavItem[] = [
  { href: "/reports", icon: FileBarChart2, label: "Reports", badge: "Soon" },
];

const SYSTEM_NAV: NavItem[] = [
  { href: "/settings", icon: Settings, label: "Settings" },
];

// ─── Single nav item ──────────────────────────────────────────────────────────

function NavItem({
  item,
  projectId,
}: {
  item:      NavItem;
  projectId: string;
}) {
  const pathname  = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const fullPath = `/projects/${projectId}${item.href}`;

  // Match exact path or any sub-path (e.g. /findings/abc is still "findings" active)
  const isActive =
    pathname === fullPath ||
    (item.href !== "/dashboard" && pathname.startsWith(fullPath));

  const Icon = item.icon;

  return (
    <SidebarMenuItem className="relative">
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={{ children: item.label, side: "right" }}
        className={cn(
          "relative flex items-center gap-3 px-3 h-9 rounded-lg w-full",
          "text-[13px] font-sans font-medium transition-all duration-150",
          "focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:outline-none",
          isActive
            ? "bg-cyan-500/10 text-cyan-300"
            : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]",
        )}
      >
        <Link href={fullPath} className="flex items-center gap-3 flex-1 min-w-0">
          {/* Active indicator bar */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                layoutId="sidebar-active-bar"
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-cyan-400"
                style={{ boxShadow: "0 0 8px rgba(6,182,212,0.6)" }}
              />
            )}
          </AnimatePresence>

          {/* Icon */}
          <Icon
            className={cn(
              "flex-shrink-0 transition-colors duration-150",
              collapsed ? "w-4.5 h-4.5" : "w-4 h-4",
              isActive ? "text-cyan-400" : "text-slate-600 group-hover:text-slate-400"
            )}
          />

          {/* Label */}
          {!collapsed && (
            <span className="flex-1 truncate">{item.label}</span>
          )}

          {/* Badge */}
          {!collapsed && item.badge && (
            <span className="text-[9px] font-sans font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-600 border border-slate-700/60">
              {item.badge}
            </span>
          )}

          {/* Active arrow — only in expanded state */}
          {!collapsed && isActive && (
            <ChevronRight className="w-3 h-3 text-cyan-500/50 flex-shrink-0" />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export default function AppSidebar({ projectId }: { projectId: string }) {
  const { state }     = useSidebar();
  const collapsed     = state === "collapsed";
  const { project }   = useProject(projectId);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-slate-800/60 bg-[#0A0B0D]"
    >
      <SidebarRail />
      {/* ── Header — logo + project context ─────────────────────────── */}
      <SidebarHeader className="px-3 py-4 border-b border-slate-800/60">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors",
            "hover:bg-white/[0.04] group"
          )}
        >
          {/* Logo */}
          <div className="relative flex-shrink-0">
            <div className="w-7 h-7 rounded-lg overflow-hidden">
              <Image
                src="/logo.png"
                alt="CipherSuite"
                width={28}
                height={28}
                className="object-cover"
              />
            </div>
            {/* Glow */}
            <div
              className="absolute inset-0 rounded-lg -z-10 blur-md opacity-60"
              style={{ background: "rgba(6,182,212,0.4)" }}
            />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold font-display text-slate-100 leading-none truncate">
                CipherSuite
              </p>
              <p className="text-[9px] font-sans text-slate-700 mt-0.5 tracking-wide">
                by Alcyone Secure
              </p>
            </div>
          )}
        </Link>

        {/* Project context pill — shows below logo when expanded */}
        {!collapsed && project && (
          <div className="mt-2 px-1.5">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03] border border-slate-800/80">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-sans font-semibold text-slate-300 truncate leading-tight">
                  {project.name}
                </p>
                <p className="text-[9px] font-sans text-slate-700 truncate mt-0.5">
                  {project.type}
                </p>
              </div>
            </div>
          </div>
        )}
      </SidebarHeader>

      {/* ── Content — navigation ─────────────────────────────────────── */}
      <SidebarContent className="px-2 py-3 overflow-y-auto scrollbar-thin">

        {/* Core */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[9px] font-sans font-bold uppercase tracking-[0.16em] text-slate-700 px-3 mb-1">
              Workspace
            </SidebarGroupLabel>
          )}
          <SidebarMenu className="space-y-0.5">
            {CORE_NAV.map((item) => (
              <NavItem key={item.href} item={item} projectId={projectId} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator className="my-3 bg-slate-800/60" />

        {/* Reporting */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[9px] font-sans font-bold uppercase tracking-[0.16em] text-slate-700 px-3 mb-1">
              Reporting
            </SidebarGroupLabel>
          )}
          <SidebarMenu className="space-y-0.5">
            {REPORTING_NAV.map((item) => (
              <NavItem key={item.href} item={item} projectId={projectId} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* AI hint chip — only when expanded */}
        {!collapsed && (
          <div className="mx-1 mt-3 px-3 py-2.5 rounded-xl border border-cyan-500/15 bg-cyan-500/[0.04]">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3 h-3 text-cyan-500/60" />
              <span className="text-[9px] font-sans font-bold text-cyan-600 uppercase tracking-wider">AI Assist</span>
            </div>
            <p className="text-[10px] font-sans text-slate-700 leading-relaxed">
              Draft findings and remediation with one click from any finding.
            </p>
          </div>
        )}
      </SidebarContent>

      {/* ── Footer — system nav + back to projects ────────────────────── */}
      <SidebarFooter className="px-2 py-3 border-t border-slate-800/60 space-y-0.5">
        {/* System */}
        <SidebarMenu className="space-y-0.5">
          {SYSTEM_NAV.map((item) => (
            <NavItem key={item.href} item={item} projectId={projectId} />
          ))}
        </SidebarMenu>

        <SidebarSeparator className="my-2 bg-slate-800/60" />

        {/* Back to all projects */}
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            tooltip={{ children: "All Projects", side: "right" }}
            className={cn(
              "flex items-center gap-3 px-3 h-9 rounded-lg w-full",
              "text-[13px] font-sans font-medium transition-all duration-150",
              "text-slate-600 hover:text-slate-300 hover:bg-white/[0.04]",
            )}
          >
            <Link href="/" className="flex items-center gap-3">
              <ArrowLeft className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>All Projects</span>}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {/* Alcyone Secure attribution — only when expanded */}
        {!collapsed && (
          <div className="flex items-center justify-center gap-1.5 pt-3 pb-1">
            <Shield className="w-2.5 h-2.5 text-slate-800" />
            <span className="text-[9px] font-sans text-slate-800 tracking-wide">
              Alcyone Secure
            </span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
