import type { Metadata } from 'next';
import { Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';

export const metadata: Metadata = { title: 'Day one' };

// The loading state of the day-one screen; the screen itself lands in the next pull request.
export default function DayOnePage() {
  return (
    <section className="stack" aria-busy="true">
      <p className="lede">{copy.dayOne.reading}</p>
      <Skeleton kind="title" count={2} />
      <Skeleton kind="option" count={3} />
    </section>
  );
}
