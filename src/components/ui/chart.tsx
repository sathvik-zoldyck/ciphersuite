"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?:  React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = { config: ChartConfig };

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within <ChartContainer />");
  return ctx;
}

// ─── Container ────────────────────────────────────────────────────────────────

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config:   ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uid     = React.useId();
  const chartId = `chart-${id ?? uid.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs",
          // Recharts SVG overrides — scoped to dark theme colours
          "[&_.recharts-cartesian-axis-tick_text]:fill-slate-600",
          "[&_.recharts-cartesian-axis-tick_text]:font-mono",
          "[&_.recharts-cartesian-grid_line]:stroke-slate-800/60",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-slate-700",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-layer]:outline-none",
          "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-white/[0.03]",
          "[&_.recharts-sector]:outline-none",
          "[&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "ChartContainer";

// ─── CSS variable injection ───────────────────────────────────────────────────

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, c]) => c.theme || c.color
  );

  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(([theme, prefix]) =>
            `${prefix} [data-chart=${id}] {\n` +
            colorConfig
              .map(([key, item]) => {
                const color =
                  item.theme?.[theme as keyof typeof item.theme] ?? item.color;
                return color ? `  --color-${key}: ${color};` : null;
              })
              .filter(Boolean)
              .join("\n") +
            "\n}"
          )
          .join("\n"),
      }}
    />
  );
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div"> & {
      hideLabel?:     boolean;
      hideIndicator?: boolean;
      indicator?:     "line" | "dot" | "dashed";
      nameKey?:       string;
      labelKey?:      string;
    }
>(({
  active, payload, className,
  indicator    = "dot",
  hideLabel    = false,
  hideIndicator = false,
  label, labelFormatter, labelClassName,
  formatter, color, nameKey, labelKey,
}, ref) => {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) return null;
    const [item] = payload;
    const key    = `${labelKey ?? item.dataKey ?? item.name ?? "value"}`;
    const itemCfg = getPayloadConfig(config, item, key);
    const value   = !labelKey && typeof label === "string"
      ? config[label as keyof typeof config]?.label ?? label
      : itemCfg?.label;

    if (labelFormatter) {
      return <div className={cn("font-mono font-semibold text-slate-300 mb-1", labelClassName)}>{labelFormatter(value, payload)}</div>;
    }
    if (!value) return null;
    return <div className={cn("font-mono font-semibold text-slate-300 mb-1", labelClassName)}>{value}</div>;
  }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

  if (!active || !payload?.length) return null;

  const nestLabel = payload.length === 1 && indicator !== "dot";

  return (
    <div
      ref={ref}
      className={cn(
        "min-w-[8rem] rounded-xl border border-slate-800 bg-[#0A0B0D]",
        "px-3 py-2.5 shadow-2xl shadow-black/60",
        "text-[11px] font-mono",
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="flex flex-col gap-1.5">
        {payload.map((item, index) => {
          const key        = `${nameKey ?? item.name ?? item.dataKey ?? "value"}`;
          const itemCfg    = getPayloadConfig(config, item, key);
          const dotColor   = color ?? item.payload?.fill ?? item.color;

          return (
            <div
              key={item.dataKey}
              className={cn(
                "flex w-full items-center gap-2",
                indicator === "dot" && "items-center"
              )}
            >
              {formatter && item.value !== undefined && item.name ? (
                formatter(item.value, item.name, item, index, item.payload)
              ) : (
                <>
                  {itemCfg?.icon ? (
                    <itemCfg.icon />
                  ) : !hideIndicator && (
                    <span
                      className={cn("shrink-0 rounded-[2px]", {
                        "h-2 w-2":           indicator === "dot",
                        "w-1 h-3":           indicator === "line",
                        "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                      })}
                      style={{ background: dotColor, borderColor: dotColor }}
                    />
                  )}
                  <div className="flex flex-1 items-center justify-between gap-4">
                    <span className="text-slate-500">
                      {nestLabel ? tooltipLabel : null}
                      {itemCfg?.label ?? item.name}
                    </span>
                    {item.value !== undefined && (
                      <span className="font-bold tabular-nums text-slate-200">
                        {Number(item.value).toLocaleString()}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
ChartTooltipContent.displayName = "ChartTooltipContent";

// ─── Legend ───────────────────────────────────────────────────────────────────

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
      hideIcon?: boolean;
      nameKey?:  string;
    }
>(({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }, ref) => {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center gap-4 text-[10px] font-mono text-slate-500",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload.map((item) => {
        const key     = `${nameKey ?? item.dataKey ?? "value"}`;
        const itemCfg = getPayloadConfig(config, item, key);

        return (
          <div key={item.value} className="flex items-center gap-1.5">
            {itemCfg?.icon && !hideIcon ? (
              <itemCfg.icon />
            ) : (
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: item.color }} />
            )}
            {itemCfg?.label}
          </div>
        );
      })}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegendContent";

// ─── Helper ───────────────────────────────────────────────────────────────────

function getPayloadConfig(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== "object" || payload === null) return undefined;

  const inner =
    "payload" in payload &&
    typeof (payload as any).payload === "object" &&
    (payload as any).payload !== null
      ? (payload as any).payload
      : undefined;

  let configKey = key;
  if (key in (payload as any) && typeof (payload as any)[key] === "string") {
    configKey = (payload as any)[key];
  } else if (inner && key in inner && typeof inner[key] === "string") {
    configKey = inner[key];
  }

  return configKey in config ? config[configKey] : config[key];
}

export {
  ChartContainer, ChartStyle,
  ChartTooltip, ChartTooltipContent,
  ChartLegend, ChartLegendContent,
};
