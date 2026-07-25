import type { HTMLAttributes, ReactNode } from "react";

type ElementProps<T extends HTMLElement> = Omit<
  HTMLAttributes<T>,
  "children" | "title"
>;

function classes(base: string, className?: string) {
  return className ? `${base} ${className}` : base;
}

export interface DashboardLayoutProps extends ElementProps<HTMLElement> {
  children: ReactNode;
}

export function DashboardLayout({
  children,
  className,
  ...props
}: DashboardLayoutProps) {
  return (
    <main className={classes("dashboard-foundation", className)} {...props}>
      {children}
    </main>
  );
}

export interface DashboardHeaderProps extends ElementProps<HTMLElement> {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
}

export function DashboardHeader({
  title,
  description,
  eyebrow,
  actions,
  titleId,
  className,
  ...props
}: DashboardHeaderProps) {
  return (
    <header
      className={classes("dashboard-foundation__header", className)}
      aria-labelledby={titleId}
      {...props}
    >
      <div className="dashboard-foundation__header-copy">
        {eyebrow ? (
          <p className="dashboard-foundation__eyebrow">{eyebrow}</p>
        ) : null}
        <h1 id={titleId}>{title}</h1>
        {description ? (
          <p className="dashboard-foundation__description">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="dashboard-foundation__header-actions">{actions}</div>
      ) : null}
    </header>
  );
}

export interface DashboardContentProps extends ElementProps<HTMLDivElement> {
  children: ReactNode;
}

export function DashboardContent({
  children,
  className,
  ...props
}: DashboardContentProps) {
  return (
    <div
      className={classes("dashboard-foundation__content", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DashboardToolbarProps extends ElementProps<HTMLElement> {
  children: ReactNode;
  label?: string;
}

export function DashboardToolbar({
  children,
  label = "Dashboard filters and actions",
  className,
  ...props
}: DashboardToolbarProps) {
  return (
    <section
      className={classes("dashboard-foundation__toolbar", className)}
      aria-label={label}
      {...props}
    >
      {children}
    </section>
  );
}

export interface DashboardSectionProps extends ElementProps<HTMLElement> {
  title: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  headingId: string;
}

export function DashboardSection({
  title,
  children,
  description,
  actions,
  headingId,
  className,
  ...props
}: DashboardSectionProps) {
  return (
    <section
      className={classes("dashboard-foundation__section", className)}
      aria-labelledby={headingId}
      {...props}
    >
      <div className="dashboard-foundation__section-header">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description ? (
            <p className="dashboard-foundation__section-description">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="dashboard-foundation__section-actions">{actions}</div>
        ) : null}
      </div>
      <div className="dashboard-foundation__section-body">{children}</div>
    </section>
  );
}

export interface DashboardCardProps extends ElementProps<HTMLElement> {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  headingId?: string;
}

export function DashboardCard({
  children,
  title,
  description,
  actions,
  headingId,
  className,
  ...props
}: DashboardCardProps) {
  const labelled = title && headingId ? { "aria-labelledby": headingId } : {};

  return (
    <article
      className={classes("dashboard-foundation__card", className)}
      {...labelled}
      {...props}
    >
      {title || description || actions ? (
        <div className="dashboard-foundation__card-header">
          <div>
            {title ? <h3 id={headingId}>{title}</h3> : null}
            {description ? (
              <p className="dashboard-foundation__card-description">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="dashboard-foundation__card-actions">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className="dashboard-foundation__card-body">{children}</div>
    </article>
  );
}

interface DashboardStateProps extends ElementProps<HTMLDivElement> {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}

export type DashboardEmptyStateProps = DashboardStateProps;

export function DashboardEmptyState({
  title,
  description,
  action,
  icon,
  className,
  ...props
}: DashboardEmptyStateProps) {
  return (
    <div
      className={classes(
        "dashboard-foundation__state dashboard-foundation__state--empty",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div className="dashboard-foundation__state-icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action ? (
        <div className="dashboard-foundation__state-action">{action}</div>
      ) : null}
    </div>
  );
}

export interface DashboardErrorStateProps extends DashboardStateProps {
  live?: "polite" | "assertive";
}

export function DashboardErrorState({
  title,
  description,
  action,
  icon,
  live = "assertive",
  className,
  ...props
}: DashboardErrorStateProps) {
  return (
    <div
      className={classes(
        "dashboard-foundation__state dashboard-foundation__state--error",
        className,
      )}
      role="alert"
      aria-live={live}
      {...props}
    >
      {icon ? (
        <div className="dashboard-foundation__state-icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action ? (
        <div className="dashboard-foundation__state-action">{action}</div>
      ) : null}
    </div>
  );
}

export interface DashboardLoadingProps extends ElementProps<HTMLDivElement> {
  label?: string;
  rows?: number;
}

export function DashboardLoading({
  label = "Loading dashboard",
  rows = 3,
  className,
  ...props
}: DashboardLoadingProps) {
  const safeRows = Math.max(1, Math.min(rows, 10));

  return (
    <div
      className={classes("dashboard-foundation__loading", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
      {...props}
    >
      <span className="dashboard-foundation__sr-only">{label}</span>
      {Array.from({ length: safeRows }, (_, index) => (
        <span
          className="dashboard-foundation__loading-row"
          aria-hidden="true"
          key={index}
        />
      ))}
    </div>
  );
}

export interface PaginationItem {
  href: string;
  label: string;
  page: number;
  current?: boolean;
}

export interface PaginationProps extends ElementProps<HTMLElement> {
  items: readonly PaginationItem[];
  previousHref?: string;
  nextHref?: string;
  previousLabel?: string;
  nextLabel?: string;
  label?: string;
}

export function Pagination({
  items,
  previousHref,
  nextHref,
  previousLabel = "Previous page",
  nextLabel = "Next page",
  label = "Pagination",
  className,
  ...props
}: PaginationProps) {
  return (
    <nav
      className={classes("dashboard-foundation__pagination", className)}
      aria-label={label}
      {...props}
    >
      {previousHref ? (
        <a rel="prev" href={previousHref}>
          {previousLabel}
        </a>
      ) : (
        <span aria-disabled="true">{previousLabel}</span>
      )}
      <ol>
        {items.map((item) => (
          <li key={`${item.page}-${item.href}`}>
            <a
              href={item.href}
              aria-label={item.label}
              aria-current={item.current ? "page" : undefined}
            >
              {item.page}
            </a>
          </li>
        ))}
      </ol>
      {nextHref ? (
        <a rel="next" href={nextHref}>
          {nextLabel}
        </a>
      ) : (
        <span aria-disabled="true">{nextLabel}</span>
      )}
    </nav>
  );
}
