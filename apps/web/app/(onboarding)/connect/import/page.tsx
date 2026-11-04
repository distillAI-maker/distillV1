import { redirect } from 'next/navigation';
import { RITUAL_HOME, wearablesOn } from '../../../../lib/steps';
import { ImportForm } from './import-form';
export default function ImportPage() {
  if (!wearablesOn()) redirect(RITUAL_HOME);
  return <ImportForm />;
}
