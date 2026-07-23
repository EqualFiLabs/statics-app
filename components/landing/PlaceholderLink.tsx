export function PlaceholderLink({ label }: { label: string }) {
  return (
    <span
      className="placeholder-link"
      aria-disabled="true"
      title={`${label} link coming soon`}
      data-placeholder-link
    >
      {label}
    </span>
  );
}
