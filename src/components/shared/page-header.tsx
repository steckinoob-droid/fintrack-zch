interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">{title}</h1>
        {description && (
          <p className="hidden sm:block text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
