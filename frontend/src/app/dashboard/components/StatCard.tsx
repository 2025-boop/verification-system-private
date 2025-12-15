"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
}) {
  return (
    <Card className="glass-panel hover:bg-background/60 transition">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>

      <CardContent>
        <div className="text-4xl font-extrabold tracking-tight">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
