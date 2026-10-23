import { redirect } from 'next/navigation';

/** Folded into the private study (step 4). Old links and saves land there. */
export default function Moved() {
  redirect('/study');
}
