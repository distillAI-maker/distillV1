import type { ReactNode, SVGProps } from 'react';

// The twenty line icons from public/index.html, one stroke weight, copied unchanged.
const paths: Record<string, ReactNode> = {
  watch: (
    <>
      <rect x="7" y="6.5" width="10" height="11" rx="3" />
      <path d="M9 6.5V3.5h6v3M9 17.5v3h6v-3M12 10v2.2l1.5 1" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l7 2.5v5.5c0 4.2-2.9 7.4-7 9-4.1-1.600-7-4.8-7-9V6z" />
      <path d="M9 12l2.200 2.200L15.200 10" />
    </>
  ),
  cap: (
    <>
      <path d="M2.5 9.5L12 5l9.5 4.5L12 14z" />
      <path d="M6.500 11.800V16c1.500 1.400 3.400 2 5.500 2s4-.6 5.500-2v-4.200M21.500 9.500V14" />
    </>
  ),
  pill: (
    <g transform="rotate(-38 12 12)">
      <rect x="3.5" y="8.5" width="17" height="7" rx="3.500" />
      <path d="M12 8.5v7" />
    </g>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  cup: (
    <>
      <path d="M5 9h11v4.500a5.500 5.500 0 0 1-11 0z" />
      <path d="M16 10.500h1.300a2.400 2.400 0 0 1 0 4.800h-1.700M8 4.500V6M10.500 4v2M13 4.500V6" />
    </>
  ),
  loop: (
    <>
      <path d="M4.5 12a7.500 7.500 0 0 1 12.800-5.300L19.500 9M19.500 4.500V9H15" />
      <path d="M19.500 12a7.500 7.500 0 0 1-12.800 5.300L4.500 15M4.500 19.500V15H9" />
    </>
  ),
  plug: <path d="M9 3.500v4M15 3.500v4M6.500 7.500h11v4a5.500 5.500 0 0 1-11 0zM12 17v3.500" />,
  pass: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.500" />
      <path d="M3 10.500h18M7 14.500h4" />
    </>
  ),
  moon: <path d="M19.500 14.200A8 8 0 0 1 9.800 4.500a8 8 0 1 0 9.700 9.700z" />,
  spark: (
    <path d="M12 4.500c.6 3.900 3.100 6.400 7.500 7.500-4.400 1.100-6.900 3.600-7.500 7.500-.6-3.900-3.100-6.400-7.500-7.500 4.400-1.100 6.900-3.600 7.500-7.500z" />
  ),
  flask: (
    <path d="M9.500 3.500h5M10.500 3.500v5.200L5.600 17.500a2 2 0 0 0 1.800 3h9.200a2 2 0 0 0 1.800-3l-4.900-8.800V3.500M8 14.500h8" />
  ),
  checkc: (
    <>
      <circle cx="12" cy="12" r="8.500" />
      <path d="M8.200 12.400l2.600 2.600 5-5.400" />
    </>
  ),
  eyeoff: (
    <>
      <path d="M3 12s3.300-6 9-6 9 6 9 6-3.300 6-9 6-9-6-9-6z" />
      <circle cx="12" cy="12" r="2.600" />
      <path d="M4.500 19.500l15-15" />
    </>
  ),
  minusc: (
    <>
      <circle cx="12" cy="12" r="8.500" />
      <path d="M8.500 12h7" />
    </>
  ),
  lock: (
    <>
      <rect x="5.500" y="10.500" width="13" height="9" rx="2" />
      <path d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500" />
    </>
  ),
  cal: (
    <>
      <rect x="4" y="5.500" width="16" height="14" rx="2.500" />
      <path d="M4 10h16M8.500 3.500v4M15.500 3.500v4M9 14.500l2 2 4-4" />
    </>
  ),
  heart: (
    <path d="M12 19.500s-7-4.300-7-9.600A3.900 3.900 0 0 1 12 7.600a3.900 3.900 0 0 1 7 2.300c0 5.300-7 9.600-7 9.600z" />
  ),
  toggle: (
    <>
      <rect x="3.500" y="8" width="17" height="8" rx="4" />
      <circle cx="15.500" cy="12" r="2.200" />
    </>
  ),
  down: <path d="M12 5v14M6.500 13.500L12 19l5.500-5.500" />,
  // Two small additions in the same stroke: back and plus.
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  // The Figma build's button arrow.
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};

export type IconName = keyof typeof paths;
export const iconNames = Object.keys(paths) as IconName[];

export function Icon({
  name,
  size = 20,
  className,
  title,
  ...rest
}: { name: IconName; size?: number; title?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={['ic', className].filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {paths[name]}
    </svg>
  );
}
