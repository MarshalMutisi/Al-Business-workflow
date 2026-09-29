"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const config = {
  count: { label: "Emails", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Single-series horizontal bars, largest first, with the value at each bar's tip. */
export function CategoryChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: data.length * 36 + 8 }}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, left: 0, bottom: 4 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={96} />
        <ChartTooltip cursor={{ className: "fill-muted" }} content={<ChartTooltipContent hideIndicator />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} barSize={20}>
          <LabelList dataKey="count" position="right" offset={8} className="fill-foreground tabular-nums" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
