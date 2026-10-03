import type { Metadata } from 'next';
import { Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';

export const metadata: Metadata = { title: 'Today' };

// The loading state of Today; the screen itself lands in the next pull request.
export default function TodayPage() {
  return (
    <section className="stack" aria-busy="true">
      <p className="lede">{copy.common.loading}</p>
      <Skeleton kind="title" />
      <Skeleton kind="option" count={2} />
    </section>
  );
}
