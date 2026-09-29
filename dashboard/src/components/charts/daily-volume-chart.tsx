"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, type BarShapeProps } from "recharts";

import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DailyVolume } from "@/lib/types";

// Stack order, bottom to top. Colours are the validated categorical slots 1-3 plus a neutral for the remainder.
const SERIES = ["auto", "approval", "ignored", "other"] as const;
type SeriesKey = (typeof SERIES)[number];

const config = {
  auto: { label: "Handled automatically", color: "var(--chart-1)" },
  approval: { label: "Sent for approval", color: "var(--chart-2)" },
  ignored: { label: "Ignored as spam", color: "var(--chart-3)" },
  other: { label: "In progress or failed", color: "var(--chart-4)" },
} satisfies ChartConfig;

const shortDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const formatDay = (day: string, format: Intl.DateTimeFormat) => format.format(new Date(`${day}T00:00:00Z`));

/**
 * One stacked segment: the topmost non-empty segment of a column gets 4px rounded corners, and every segment
 * below it gives up 2px at its top, leaving a surface-coloured gap between segments.
 */
function StackSegment({ x, y, width, height, fill, payload, series }: BarShapeProps & { series: SeriesKey }) {
  if (!height || height <= 0) return null;
  const top = SERIES.findLast((key) => payload[key] > 0);
  if (series !== top) {
    const gap = height > 3 ? 2 : 0;
    return <rect x={x} y={y + gap} width={width} height={height - gap} fill={fill} />;
  }
  const r = Math.min(4, height, width / 2);
  const d = `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
  return <path d={d} fill={fill} />;
}

export function DailyVolumeChart({ data }: { data: DailyVolume[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-1" role="group" aria-label="Display as">
        {(["chart", "table"] as const).map((option) => (
          <Button
            key={option}
            size="xs"
            variant={view === option ? "secondary" : "ghost"}
            aria-pressed={view === option}
            onClick={() => setView(option)}
          >
            {option === "chart" ? "Chart" : "Table"}
          </Button>
        ))}
      </div>

      {view === "chart" ? (
        <ChartContainer config={config} className="aspect-auto h-72 w-full">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={20}
              tickFormatter={(day: string) => formatDay(day, shortDay)}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
            <ChartTooltip
              cursor={{ className: "fill-muted" }}
              content={<ChartTooltipContent labelFormatter={(day) => formatDay(String(day), longDay)} />}
            />
            <ChartLegend itemSorter={null} content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-1" />} />
            {SERIES.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="emails"
                fill={`var(--color-${key})`}
                maxBarSize={24}
                shape={(props: BarShapeProps) => <StackSegment {...props} series={key} />}
              />
            ))}
          </BarChart>
        </ChartContainer>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day (UTC)</TableHead>
              {SERIES.map((key) => (
                <TableHead key={key} className="text-right">
                  {config[key].label}
                </TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="tabular-nums">
            {data.map((row) => (
              <TableRow key={row.day}>
                <TableCell>{formatDay(row.day, longDay)}</TableCell>
                {SERIES.map((key) => (
                  <TableCell key={key} className="text-right">
                    {row[key]}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium">
                  {SERIES.reduce((sum, key) => sum + row[key], 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
