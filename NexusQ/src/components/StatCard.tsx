import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
}

export function StatCard({ title, value, change }: StatCardProps) {
  const isPositive = change.startsWith('+');
  return (
    <div className="p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition-shadow">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="flex items-baseline justify-between mt-2">
        <h2 className="text-3xl font-bold tracking-tight">{value}</h2>
        <span className={cn(
          "text-xs font-semibold px-2 py-1 rounded-full",
          isPositive 
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        )}>
          {change}
        </span>
      </div>
    </div>
  );
}
