import { Arrival } from '../components/onboarding/arrival';
import { supabaseConfigured } from '../lib/env';

export default function Welcome() {
  return <Arrival signInFirst={supabaseConfigured} />;
}
