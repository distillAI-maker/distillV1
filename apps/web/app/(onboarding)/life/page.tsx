import { redirect } from 'next/navigation';

/** The ideal-day box became "You, at your best" (step 4). Old links and saves land there. */
export default function LifePage() {
  redirect('/best');
}
