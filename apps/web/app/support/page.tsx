import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage } from '../../components/ds/reading-page';

export const metadata: Metadata = { title: 'Help' };

const CONTACT = 'hello@distillthenoise.com';

/** Help: how to reach a person, the questions people ask, and where to turn when it is more than that. */
export default function SupportPage() {
  return (
    <ReadingPage title="Help.">
      <p className="rd-lead">
        Write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> about anything: a question, something that felt off, or an
        idea. A person reads every message and writes back.
      </p>

      <h2>Signing in</h2>
      <p>
        Distill emails you a link instead of a password. Open it on the phone where you use the app, and it signs you in
        there. Each link works once; if it says the link has expired, ask for a new one.
      </p>

      <h2>Your account and your data</h2>
      <p>
        Everything Distill knows about you is in Settings, where you can correct it, download it, or delete everything at
        once. More in <Link href="/privacy">Your privacy</Link>.
      </p>

      <h2>If it is more than a busy week</h2>
      <p>
        Distill is a wellness companion, not care or treatment. If you are struggling, you deserve support from a person:
        in the US you can call or text 988, the Suicide &amp; Crisis Lifeline, any time. If you are in danger, call 911.
      </p>
    </ReadingPage>
  );
}
