"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/layout/Sidebar";
import AppHeader from "@/components/layout/TopBar";
import { cn } from "@/lib/utils";
import React, { useEffect } from 'react';
import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useProject } from "@/hooks/use-project";
import { useFindings } from "@/hooks/use-findings";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ProjectLayoutProps {
  children: React.ReactNode;
}

export default function ProjectLayout({ children }: ProjectLayoutProps) {
  const params = useParams();
  const projectId = params.projectId as string;
  const { user, loading, isGuest, updateLocalProject } = useAuth();
  const router = useRouter();

  const { project } = useProject(projectId);
  const { stats } = useFindings(projectId);

  useEffect(() => {
    if (loading || !project) {
      return;
    }
    // Only update if the calculated score is different from the stored score
    if (project.riskScore !== stats.riskScore) {
      if (isGuest) {
        updateLocalProject(projectId, { riskScore: stats.riskScore });
      } else {
        const projectRef = doc(db, 'projects', projectId);
        updateDoc(projectRef, { riskScore: stats.riskScore, updatedAt: serverTimestamp() })
          .catch(err => console.error("Failed to update risk score: ", err));
      }
    }
  }, [stats.riskScore, project, projectId, isGuest, loading, updateLocalProject]);


  useEffect(() => {
    if (!loading && !user && !isGuest) {
      router.push('/login');
    }
  }, [user, loading, isGuest, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#080A0C]">
        <div className="flex items-center gap-2 text-slate-500">
          <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
          <span className="font-sans text-sm">Authenticating...</span>
        </div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return null; // or a redirect component
  }

  return (
    <SidebarProvider>
      {/*
       * ── SHELL ────────────────────────────────────────────────────────────
       * h-screen + overflow-hidden locks the viewport.
       * Nothing scrolls here — scrolling is handled by <main> only.
       */}
      <div id="project-layout-root" className="flex h-screen w-screen overflow-hidden bg-[#080A0C]">

        {/* ── SIDEBAR ──────────────────────────────────────────────────────
         * Fixed-width, full-height. Never scrolls with content.
         */}
        <AppSidebar projectId={projectId} />

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────────
         * flex-1   : takes all space the sidebar doesn't
         * min-w-0  : critical — prevents flex blowout on wide content
         * flex col : stacks TopBar above Main
         * h-screen : explicitly constrains the column to viewport height
         *            so <main> can flex-1 within a bounded container
         */}
        <div
          id="project-layout-main-wrapper"
          className={cn(
            "relative flex flex-col",
            "flex-1 min-w-0",
            "h-screen",          // ← explicit height so children can use flex-1
            "overflow-hidden",   // ← clip, never scroll the column itself
          )}
        >

          {/* ── AMBIENT BACKGROUND ─────────────────────────────────────────
           * Fixed layers — don't scroll with content, don't intercept clicks.
           * Three layers for depth: glow → grid → vignette
           */}

          {/* Layer 1 — Cyan radial glow bleeding from the top */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-30"
            style={{
              background:
                "radial-gradient(ellipse 90% 45% at 55% -5%, rgba(6,182,212,0.06) 0%, transparent 65%)",
            }}
          />

          {/* Layer 2 — Dot grid that fades toward the bottom */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-20"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(148,163,184,0.3) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              opacity: 0.14,
              maskImage:
                "radial-gradient(ellipse 100% 60% at 50% 0%, black 0%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 100% 60% at 50% 0%, black 0%, transparent 100%)",
            }}
          />

          {/* Layer 3 — Subtle bottom vignette to ground the page */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-48"
            style={{
              background:
                "linear-gradient(to top, rgba(8,10,12,0.6) 0%, transparent 100%)",
            }}
          />

          {/* ── TOPBAR ───────────────────────────────────────────────────────
           * flex-shrink-0 ensures it never compresses — it takes its natural
           * height and gives the remainder to <main>.
           */}
          <AppHeader />

          {/* ── MAIN ─────────────────────────────────────────────────────────
           * This is the ONLY element in the app that scrolls.
           *
           * flex-1       : fills all remaining height after TopBar
           * min-h-0      : allows flex-1 to shrink below content size
           *                (without this, overflow never triggers)
           * overflow-y-auto : scrolls when content is taller than viewport
           * overflow-x-hidden : prevents horizontal bleed from wide content
           * flex flex-col : makes the inner wrapper flex-1-able
           *
           * Padding is applied here, not on children, so every page
           * has consistent inset without needing to repeat it.
           */}
          <main
            id="project-layout-main"
            className={cn(
              "flex flex-col flex-1 min-h-0",
              "overflow-y-auto overflow-x-hidden",
              "px-5 py-6 sm:px-7 lg:px-9 lg:py-7",
              "relative isolate",
              "scrollbar-thin",
            )}
          >
            {/*
             * ── CONTENT WRAPPER ──────────────────────────────────────────
             * mx-auto + max-w    : readable line lengths on ultra-wide screens
             * flex-1 flex-col    : passes height down to children
             * min-h-0            : allows children to shrink / use overflow
             *
             * THIS IS THE KEY: every child page that uses `h-full` or
             * `flex-1` will resolve correctly because this wrapper is a
             * proper bounded flex container.
             */}
            <div
              className={cn(
                "mx-auto w-full max-w-screen-2xl",
                "flex flex-col flex-1 min-h-0",
              )}
            >
              {children}
            </div>
          </main>

        </div>
      </div>
    </SidebarProvider>
  );
}
