import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-sm">
      <Icon className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
      <h3 className="mb-2 text-xl font-semibold text-foreground">{title}</h3>
      <p className="mb-6 text-sm text-muted-foreground">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
};
