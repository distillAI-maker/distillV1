import { exploreBankSchema, type ExploreBank } from '@distill/engine/ritual';
import raw from '../../../../data/explore-bank.json';

/**
 * Real places and things to try, each opened and checked by hand (data/explore-bank.json). The
 * "what do you want to try" step only offers ideas the founder has certified. The Explore tab shows
 * the ones tied to what someone already does (lib/explore/nearby.ts). Server only.
 */
export const exploreBank: ExploreBank = exploreBankSchema.parse(raw);
