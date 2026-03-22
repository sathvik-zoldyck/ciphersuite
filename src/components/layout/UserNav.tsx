"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserNav() {
  const { user, isGuest, logout } = useAuth();

  const avatarLabel = isGuest
    ? "G"
    : (user?.displayName?.[0] ?? user?.email?.[0] ?? "U").toUpperCase();

  const displayName = isGuest
    ? "Guest"
    : (user?.displayName ?? user?.email ?? "User");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          "flex items-center gap-2 px-2 h-[30px] rounded-md",
          "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]",
          "transition-colors duration-120 outline-none",
        )}>
          <span className={cn(
            "flex items-center justify-center w-5 h-5 rounded-[5px]",
            "text-[10px] font-mono font-bold",
            isGuest
              ? "bg-slate-800 text-slate-500 border border-slate-700/60"
              : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20",
          )}>
            {avatarLabel}
          </span>
          <span className="hidden lg:block text-[12px] font-mono max-w-[120px] truncate">
            {displayName}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className={cn(
          "w-52 rounded-xl p-1",
          "bg-[#0D0E10]/95 backdrop-blur-sm",
          "border border-slate-800/70",
          "shadow-xl shadow-black/50",
        )}
      >
        <div className="px-2.5 py-2 mb-0.5">
          <p className="text-[9px] font-mono font-semibold text-slate-700 uppercase tracking-[0.18em] mb-1">
            Account
          </p>
          <div className="flex items-center gap-2">
            <span className={cn(
              "flex items-center justify-center w-6 h-6 rounded-[6px] flex-shrink-0",
              "text-[11px] font-mono font-bold",
              isGuest
                ? "bg-slate-800 text-slate-500 border border-slate-700/60"
                : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20",
            )}>
              {avatarLabel}
            </span>
            <p className="text-[12px] font-mono text-slate-300 truncate">
              {isGuest ? "Guest Mode" : (user?.email ?? "User")}
            </p>
          </div>
          {isGuest && (
            <p className="text-[10px] font-mono text-amber-500/50 mt-1.5">
              Local data only — not synced
            </p>
          )}
        </div>

        <div className="h-px bg-slate-800/60 my-1 mx-1" />

        <DropdownMenuItem
          onClick={() => void logout()}
          className={cn(
            "flex items-center gap-2 px-2.5 py-2 rounded-lg mx-0.5",
            "text-[12px] font-mono text-slate-500 cursor-pointer transition-colors",
            "hover:bg-red-500/[0.07] hover:text-red-400",
            "focus:bg-red-500/[0.07] focus:text-red-400",
          )}
        >
          <LogOut className="w-[13px] h-[13px] flex-shrink-0" strokeWidth={1.75} />
          <span>{isGuest ? "Exit Guest Session" : "Sign out"}</span>
        </DropdownMenuItem>

        <div className="flex items-center justify-center gap-1.5 pt-2 pb-1 mt-0.5">
          <Shield className="w-[9px] h-[9px] text-slate-800" strokeWidth={1.5} />
          <span className="text-[9px] font-mono text-slate-800 tracking-wide">Alcyone Secure</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
