import { redirect } from 'next/navigation';

/** The ideal-day box became the private study (step 4). Old links and saves land there. */
export default function LifePage() {
  redirect('/study');
}
