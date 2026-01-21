interface ActivityItemProps {
  user: string;
  action: string;
  time: string;
  detail: string;
}

export function ActivityItem({ user, action, time, detail }: ActivityItemProps) {
  return (
    <div className="flex gap-4">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary shrink-0 text-[10px] font-bold">
        {user.split(' ').map(n => n[0]).join('')}
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{user}</span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{time}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {action} · <span className="text-foreground/70">{detail}</span>
        </span>
      </div>
    </div>
  );
}
