"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months:   "flex flex-col sm:flex-row gap-4",
        month:    "space-y-3",

        caption:       "flex justify-center pt-1 relative items-center",
        caption_label: "text-[11px] font-sans font-bold text-slate-300 uppercase tracking-[0.12em]",

        nav:              "flex items-center gap-1",
        nav_button:       cn(
          "h-6 w-6 rounded-lg border border-slate-800 bg-[#0D0F12]",
          "text-slate-600 hover:text-slate-200 hover:border-slate-700",
          "flex items-center justify-center transition-colors duration-100",
          "absolute top-0"
        ),
        nav_button_previous: "left-1",
        nav_button_next:     "right-1",

        table:    "w-full border-collapse",
        head_row: "flex",
        head_cell:"text-slate-700 rounded-md w-8 font-sans font-semibold text-[10px] uppercase tracking-wider text-center",

        row:  "flex w-full mt-1",
        cell: cn(
          "h-8 w-8 text-center p-0 relative text-[11px] font-sans",
          "focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-violet-500/10 [&:has([aria-selected])]:rounded-md",
          "[&:has([aria-selected].day-outside)]:bg-violet-500/[0.05]",
          "first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
        ),
        day: cn(
          "h-8 w-8 p-0 font-sans text-[11px] text-slate-400",
        ),
        day_button: cn(
          "h-full w-full rounded-lg flex items-center justify-center outline-none",
          "hover:bg-slate-800 hover:text-slate-200 transition-colors duration-100",
          "aria-selected:opacity-100 focus-visible:outline-none",
          "focus-visible:ring-1 focus-visible:ring-violet-500/50",
        ),
        day_range_end:    "day-range-end",
        day_selected:
          "bg-violet-500 text-white hover:bg-violet-400 hover:text-white focus:bg-violet-500 focus:text-white font-bold",
        day_today:
          "bg-slate-800 text-slate-100 font-bold",
        day_outside:
          "day-outside text-slate-800 aria-selected:bg-violet-500/[0.07] aria-selected:text-slate-600",
        day_disabled:  "text-slate-800 opacity-40 cursor-not-allowed pointer-events-none",
        day_range_middle:
          "aria-selected:bg-violet-500/10 aria-selected:text-violet-300 rounded-none",
        day_hidden:    "invisible",
        ...classNames,
      }}
      components={{
        Chevron: (props: any) => {
          if (props.orientation === "left") return <ChevronLeft className="h-3.5 w-3.5" {...props} />;
          return <ChevronRight className="h-3.5 w-3.5" {...props} />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
