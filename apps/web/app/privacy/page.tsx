import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage } from '../../components/ds/reading-page';

export const metadata: Metadata = { title: 'Privacy' };

const CONTACT = 'hello@distillthenoise.com';

/** The privacy policy: what Distill keeps, who helps run it, and how to take it back. */
export default function PrivacyPage() {
  return (
    <ReadingPage title="Your privacy." updated="Updated 29 October 2026">
      <p className="rd-lead">
        Distill builds your Ritual from what you tell it. This page says what that is, where it goes and how to take it
        back. In short: we keep what it takes to build your Ritual, we never sell it, and you can delete all of it from
        Settings whenever you like.
      </p>

      <h2>Without an account</h2>
      <p>
        You can use Distill without signing in. Your name, what you tapped and your answers stay on your phone. To show
        you your number and your first Ritual, the app sends them to our server, which works them out and keeps nothing.
      </p>

      <h2>With an account</h2>
      <p>
        When you sign in with your email, we keep your Ritual and what it is built from, so it is there on any device:
      </p>
      <ul>
        <li>your email address and first name;</li>
        <li>what you take and do, and what it costs you;</li>
        <li>your answers, your notes, your ideal day and the messages you send Distill;</li>
        <li>the changes you make, what you let go and what you tick off;</li>
        <li>if you connect Oura or WHOOP, your nights from it (sleep and recovery), or a file you choose to import.</li>
      </ul>

      <h2>Counting steps</h2>
      <p>
        We count steps through the app, like finishing onboarding, to make Distill better. Each count carries a random
        number for this device and where you first came from (our website, a class QR code or this app). Never what you
        write, and never your name or email.
      </p>

      <h2>Who helps us run Distill</h2>
      <p>Each of these gets only what its part needs:</p>
      <ul>
        <li>Vercel hosts the app.</li>
        <li>Supabase holds our database, your account and any file you import.</li>
        <li>Resend sends your sign-in email.</li>
        <li>
          Anthropic&apos;s Claude reads what you write (your ideal day, notes, answers and messages) when Distill words
          your Ritual or replies to you. Anthropic doesn&apos;t use it to train its models.
        </li>
        <li>Oura or WHOOP, only if you connect one, send us your nights.</li>
        <li>Wikimedia Commons serves the daily painting.</li>
      </ul>

      <h2>What we never do</h2>
      <p>
        We don&apos;t sell your data, show you ads or share what you tell us with anyone for their marketing. We
        don&apos;t follow you across other apps or websites. Your Ritual is built around your life and isn&apos;t used to
        sell you more things.
      </p>

      <h2>Yours to see, take and delete</h2>
      <ul>
        <li>
          <Link href="/things#knows">What Distill knows</Link>, in Settings, shows everything it has learned about you, and
          you can correct or remove any of it.
        </li>
        <li>Your data, in Settings, downloads a file of everything Distill holds on you.</li>
        <li>
          Delete everything, in Settings, deletes your account, your stack, your notes and every night we pulled, at once.
          Gone, not archived. Without an account, it clears this phone.
        </li>
      </ul>

      <h2>Keeping it safe</h2>
      <p>
        Everything travels encrypted. Wearable sign-ins are encrypted again before we store them, and access to the
        database is limited to the people who run Distill.
      </p>

      <h2>How long we keep it</h2>
      <p>
        For as long as you have an account. When you delete it, it goes. If you joined the waitlist on our website, we
        keep that email until you ask us to remove it, or until you delete your account.
      </p>

      <h2>Not for children</h2>
      <p>
        Distill is made for adults and isn&apos;t meant for anyone under 18. If you think a child has used it, write to us
        and we&apos;ll delete what they shared.
      </p>

      <h2>Not medical advice</h2>
      <p>
        Distill is a wellness tool, not a medical product. Nothing in it is medical advice, and anything a clinician gave
        you stays exactly as it is.
      </p>

      <h2>Changes and questions</h2>
      <p>
        If this page changes in a way that matters to you, we&apos;ll tell you in the app first. Questions, or a request
        about your data: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. A person reads every message.
      </p>
    </ReadingPage>
  );
}
