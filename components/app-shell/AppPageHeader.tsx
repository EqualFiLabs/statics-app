import type { ReactNode } from "react";
import type { DappRouteId } from "@/lib/dapp-navigation";
import styles from "./AppPageHeader.module.css";

/** Decorative artwork never replaces the page's accessible heading or controls. */
export function AppPageHeader({
  feature,
  title,
  description,
  eyebrow,
  compact = false,
  actions,
  className = "",
}: {
  feature: DappRouteId;
  title: string;
  description: string;
  eyebrow?: string;
  compact?: boolean;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`${styles.header} ${compact ? styles.compact : ""} ${className}`}
      data-feature={feature}
    >
      <div className={styles.copy}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1>{title}</h1>
        <p className={styles.description}>{description}</p>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
