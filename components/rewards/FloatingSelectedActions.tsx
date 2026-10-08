"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./earn.module.css";

export function FloatingSelectedActions({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ left: 16, width: 0, height: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      if (!host.current || !bar.current) return;
      const rect = host.current.getBoundingClientRect();
      const height = bar.current.getBoundingClientRect().height;
      setBounds((previous) =>
        previous.left === rect.left && previous.width === rect.width && previous.height === height
          ? previous
          : { left: rect.left, width: rect.width, height }
      );
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (host.current) observer?.observe(host.current);
    if (bar.current) observer?.observe(bar.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div ref={host} style={{ height: bounds.height + 32 }}>
      <div
        ref={bar}
        className={styles.bulkBar}
        role="region"
        aria-label={label}
        style={{ left: bounds.left, width: bounds.width || "calc(100% - 32px)" }}
      >
        {children}
      </div>
    </div>
  );
}
