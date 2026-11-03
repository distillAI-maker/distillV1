import { redirect } from 'next/navigation';

/** Today became the Ritual tab (28 Oct). Old links and saves land there. Its screen stays in the code for now. */
export default function TodayPage() {
  redirect('/ritual');
}
