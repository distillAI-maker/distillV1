import type { Metadata } from 'next';
import { DayOne } from './day-one';

export const metadata: Metadata = { title: 'Day one' };

export default function DayOnePage() {
  return <DayOne />;
}
