/** The eight-point mark from the Figma build. Decorative; always hidden from screen readers. */
export function Mark({ className = 'mark' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 40 40">
      <path d="M20 4v32M4 20h32M9 9l22 22M31 9 9 31" />
      <circle cx="20" cy="20" r="4" />
    </svg>
  );
}
