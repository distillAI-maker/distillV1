import type { ReactNode } from 'react';

/** The private study and the reveal draw their own top bars and fill the column. */
export default function StudyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ds">
      <div className="ds-col">{children}</div>
    </div>
  );
}
