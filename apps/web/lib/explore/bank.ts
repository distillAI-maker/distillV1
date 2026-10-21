import { exploreBankSchema, type ExploreBank } from '@distill/engine/ritual';
import raw from '../../../../data/explore-bank.json';

/**
 * Real places and things to try, each opened and checked by hand (data/explore-bank.json). Only
 * ideas the founder has certified are ever shown; the rest wait for that check. Server only.
 */
export const exploreBank: ExploreBank = exploreBankSchema.parse(raw);
