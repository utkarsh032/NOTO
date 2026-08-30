import type { ReactNode } from 'react';

import { cn } from '../../utils/cn';

export interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * A group of related settings, in a card.
 *
 * One card per group rather than one long list with rules across it: a screen
 * of twelve settings is scanned by group first, and a heading floating above
 * undifferentiated rows makes the reader count to work out where it stops.
 */
export function SettingsSection({ title, description, children, className }: SettingsSectionProps) {
  return (
    <section className={cn('border-default bg-surface rounded-xl border shadow-sm', className)}>
      <header className="border-default border-b px-5 py-4">
        <h2 className="text-primary text-h4">{title}</h2>
        {description ? <p className="text-tertiary text-caption mt-1">{description}</p> : null}
      </header>
      <div className="divide-default divide-y">{children}</div>
    </section>
  );
}

export interface SettingsRowProps {
  label: string;
  description?: string;
  /** The control. Right-aligned, and never wider than it needs to be. */
  control?: ReactNode;
  /** Full-width content under the label, for anything a row cannot hold. */
  children?: ReactNode;
  htmlFor?: string;
}

export function SettingsRow({ label, description, control, children, htmlFor }: SettingsRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-primary text-body-sm block font-medium">
            {label}
          </label>
        ) : (
          <p className="text-primary text-body-sm font-medium">{label}</p>
        )}
        {description ? <p className="text-tertiary text-caption mt-0.5">{description}</p> : null}
        {children}
      </div>

      {control ? <div className="shrink-0">{control}</div> : null}
    </div>
  );
}
