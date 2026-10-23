/** The brand's chisel star, as Figma draws it: full (22px), small (14px) or tiny (10px, inline). */
export function DStar({ size, className = '' }: { size?: 'small' | 'tiny'; className?: string }) {
  return (
    <svg
      className={`d-star${size ? ` d-star--${size}` : ''}${className ? ` ${className}` : ''}`}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <path
        className="d-star__rays"
        d="M20 2.5l3.8 12.8 9.7-8.6-8.7 9.6 12.7 3.7-12.7 3.7 8.7 9.6-9.7-8.6L20 37.5l-3.8-12.8-9.7 8.6 8.7-9.6L2.5 20l12.7-3.7-8.7-9.6 9.7 8.6L20 2.5z"
      />
      <circle className="d-star__core" cx="20" cy="20" r="2.8" />
    </svg>
  );
}

/** The wordmark on the right of the app's top bar. */
export function DBrand() {
  return (
    <span className="d-brand" translate="no">
      <DStar />
      <span>Distill</span>
    </span>
  );
}
