/** The chisel star from the brand board: eight points cut from opposing strokes. Decorative; always hidden from screen readers. */
export function Mark({ className = 'mark' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 48 48">
      <path d="M24 2 28.3 18.2 43.8 11 31 24l12.8 13-15.5-7.2L24 46l-4.3-16.2L4.2 37 17 24 4.2 11l15.5 7.2L24 2Z" />
      <circle cx="24" cy="24" r="3.2" />
    </svg>
  );
}
