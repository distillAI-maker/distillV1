import type { Catalog, Item } from '@distill/catalog';
import type {
  InventoryItem,
  OverlapDecision,
  RoutedItem,
  RoutingOptions,
  StackAnswers,
} from './types.js';

export interface WorkingItem {
  inventory: InventoryItem;
  answers: Readonly<StackAnswers>;
  item?: Item;
  routed: RoutedItem;
  overlapEligible: boolean;
}
export const overlapPolicies = {
  'fitness memberships': 'fitness',
  'heat and cold': 'heat',
  massage: 'show',
  'meditation apps': 'usage',
  wearables: 'choice',
  'wake-up light': 'show',
  'daily multivitamin': 'multi',
  'omega-3': 'fish',
  collagen: 'powder',
  'caffeine before training': 'caffeine',
  'sleep aids': 'sleep',
  electrolytes: 'electrolytes',
  magnesium: 'choice',
  bloodwork: 'bloodwork',
  'professional skin treatments': 'skin',
  exfoliants: 'exfoliants',
  'hydrating layers': 'hydration',
  'at-home skin devices': 'skinUsage',
} as const;
const usage = (row: WorkingItem) => row.answers.usesLast30Days ?? row.answers.visitsLast30Days;
const active = (row: WorkingItem) =>
  row.overlapEligible &&
  row.routed.tier !== 'T2' &&
  row.routed.tier !== 'PROTECTED' &&
  !row.routed.excluded &&
  !row.routed.needsAnswers?.length;

export function applyOverlaps(
  catalog: Pick<Catalog, 'overlapGroups'>,
  rows: WorkingItem[],
  options: RoutingOptions,
): OverlapDecision[] {
  const decisions: OverlapDecision[] = [];
  for (const group of catalog.overlapGroups) {
    if (!Object.hasOwn(overlapPolicies, group.name))
      throw new Error(`Unknown overlap policy: ${group.name}`);
    const policy = overlapPolicies[group.name as keyof typeof overlapPolicies];
    const members = rows.filter(
      (row) => group.itemKeys.includes(row.inventory.key) && !row.routed.excluded,
    );
    // Protected items are never compared. Bloodwork alone permits a reference to the physical.
    const visible = members.filter(
      (row) => row.routed.tier !== 'PROTECTED' || policy === 'bloodwork',
    );
    const selectedId = options.overlapKeep?.[group.name];
    if (
      selectedId &&
      !['fitness', 'usage', 'choice', 'fish', 'powder', 'sleep', 'electrolytes'].includes(policy)
    )
      throw new Error(
        `This overlap needs its conditional answers, not a keeper choice: ${group.name}`,
      );
    if (selectedId && !visible.some((row) => row.inventory.id === selectedId && active(row)))
      throw new Error(`Invalid overlap choice for ${group.name}: ${selectedId}`);
    const bundled = visible.some(
      (row) =>
        (policy === 'choice' &&
          row.inventory.key === 'second-wearable-oura-plus-whoop' &&
          row.answers.bothWearables) ||
        (policy === 'hydration' && row.answers.hydrationRoutineDuplicates) ||
        (policy === 'exfoliants' && row.answers.sameNightExfoliation) ||
        (policy === 'heat' && row.answers.ownsEquivalentHeatOrCold),
    );
    if (visible.length < 2 && !bundled) continue;
    const candidates = visible.filter(active);
    let keeper: WorkingItem | undefined;
    let drops: WorkingItem[] = [];
    let needs: string[] = [];
    let informational = false;
    const choose = (pool: WorkingItem[]) => {
      if (pool.length < 2) {
        informational = true;
        return;
      }
      if (selectedId) {
        keeper = pool.find((row) => row.inventory.id === selectedId);
        if (!keeper) throw new Error(`Choice is outside the comparable items: ${group.name}`);
      } else {
        const counts = pool.map(usage);
        if (counts.some((count) => count === undefined)) {
          needs = ['usesLast30Days', 'overlapKeep'];
          return;
        }
        const max = Math.max(...(counts as number[]));
        const winners = pool.filter((row) => usage(row) === max);
        if (winners.length !== 1) {
          needs = ['overlapKeep'];
          return;
        }
        keeper = winners[0];
      }
      drops = pool.filter((row) => row !== keeper);
    };
    switch (policy) {
      case 'show':
        informational = true;
        break;
      case 'fitness': {
        const apps = candidates.filter((row) => row.inventory.key.startsWith('fitness-app-'));
        const gyms = candidates.filter((row) => !apps.includes(row));
        choose(gyms);
        // The workbook explicitly permits an app alongside an attended gym.
        if (
          apps.length &&
          !visible.some(
            (row) => !row.inventory.key.startsWith('fitness-app-') && (usage(row) ?? 0) > 0,
          )
        )
          needs = [...needs, 'fitness_app_and_unused_gym_review'];
        break;
      }
      case 'usage':
        choose(candidates);
        break;
      case 'choice':
        if (selectedId) {
          keeper = candidates.find((row) => row.inventory.id === selectedId);
          drops = candidates.filter((row) => row !== keeper);
        } else needs = ['overlapKeep'];
        break;
      case 'heat': {
        const duplicate = candidates.filter(
          (row) =>
            row.answers.ownsEquivalentHeatOrCold === true && row.item?.category === 'service',
        );
        if (duplicate.length) drops = duplicate;
        else {
          const studios = candidates.filter((row) => row.item?.category === 'service');
          if (studios.length >= 2) choose(studios);
          else needs = ['ownsEquivalentHeatOrCold'];
        }
        break;
      }
      case 'fish':
      case 'powder': {
        keeper = candidates.find(
          (row) =>
            row.inventory.key === (policy === 'fish' ? 'omega-3-fish-oil' : 'collagen-peptides'),
        );
        if (keeper) drops = candidates.filter((row) => row !== keeper);
        else needs = ['overlapKeep'];
        break;
      }
      case 'multi': {
        const bases = candidates.filter((row) =>
          ['multivitamin', 'greens-powder-ag1-etc'].includes(row.inventory.key),
        );
        const separates = candidates.filter((row) => !bases.includes(row));
        if (bases.length) {
          keeper = bases[0];
          drops = separates.filter((row) => row.answers.multiContainsStudiedDose === true);
          if (separates.some((row) => row.answers.multiContainsStudiedDose === undefined))
            needs = ['multiContainsStudiedDose'];
          if (!separates.length) informational = true;
        } else informational = true;
        break;
      }
      case 'caffeine':
        keeper = candidates.find((row) =>
          ['coffee-after-2pm', 'second-or-third-coffee'].includes(row.inventory.key),
        );
        if (keeper) {
          drops = candidates.filter(
            (row) =>
              row.inventory.key === 'pre-workout' &&
              row.answers.caffeineWithinHourOfCoffee === true,
          );
          if (
            candidates.some(
              (row) =>
                row.inventory.key === 'pre-workout' &&
                row.answers.caffeineWithinHourOfCoffee === undefined,
            )
          )
            needs = ['caffeineWithinHourOfCoffee'];
        } else informational = true;
        break;
      case 'sleep':
        keeper = candidates.find((row) => row.inventory.key === 'melatonin');
        if (keeper) drops = candidates.filter((row) => row.inventory.key === 'sleep-gummies-blend');
        if (!drops.length) informational = true;
        break;
      case 'electrolytes':
        keeper = candidates.find((row) => row.inventory.key === 'electrolytes-lmnt-etc');
        if (keeper)
          drops = candidates.filter(
            (row) => row.inventory.key === 'electrolytes-plus-sports-drink',
          );
        else needs = ['overlapKeep'];
        break;
      case 'bloodwork':
        if (visible.some((row) => row.inventory.key === 'annual-physical-with-bloodwork')) {
          drops = candidates.filter(
            (row) =>
              row.inventory.key === 'blood-panel-subscription-function-etc' &&
              row.answers.subscriptionHasAdditionalTests === false,
          );
          if (
            candidates.some(
              (row) =>
                row.inventory.key === 'blood-panel-subscription-function-etc' &&
                row.answers.subscriptionHasAdditionalTests === undefined,
            )
          )
            needs = ['subscriptionHasAdditionalTests'];
        } else informational = true;
        break;
      case 'exfoliants':
        drops = candidates.filter((row) => row.answers.sameNightExfoliation === true);
        if (!drops.length) needs = ['sameNightExfoliation'];
        break;
      case 'hydration':
        drops = candidates.filter(
          (row) =>
            row.answers.hydrationRoutineDuplicates === true &&
            (row.inventory.key === 'toner-hydrating-or-balancing' ||
              row.inventory.key === 'multiple-hydrating-serums-two-hyaluronic-acid-products' ||
              (row.inventory.key === 'eye-cream-when-you-already-use-a-moisturiser' &&
                row.answers.eyeCreamHasAdditionalActive === false)),
        );
        if (!drops.length) needs = ['hydrationRoutineDuplicates', 'eyeCreamHasAdditionalActive'];
        break;
      case 'skin':
      case 'skinUsage':
        // TODO(team): "least" and "less than weekly" do not define an exact 30-day cutoff.
        informational = true;
        needs = ['SKIN_USAGE_THRESHOLD'];
        break;
    }
    // A user's keeper choice can override a default recommendation within that comparison.
    if (selectedId && keeper && drops.length) {
      const compared = [keeper, ...drops];
      const chosen = compared.find((row) => row.inventory.id === selectedId);
      if (!chosen) throw new Error(`Choice is outside the comparable items: ${group.name}`);
      keeper = chosen;
      drops = compared.filter((row) => row !== chosen);
    }
    // An unresolved source row cannot be silently settled by a generic group comparison.
    if (visible.some((row) => row.routed.step === 'source_conflict'))
      needs.push('COLUMN_CONFLICTS');
    const status = drops.length
      ? selectedId
        ? 'confirmed'
        : 'suggested'
      : informational && !needs.length
        ? 'informational'
        : 'pending';
    if (status === 'pending') {
      // Do not offer a test while a potentially duplicate exposure still needs an answer.
      for (const row of candidates) {
        row.routed = {
          ...row.routed,
          tier: 'T3',
          step: 'overlap',
          detail: 'overlap_review_required',
          keep: false,
          canRunAnyway: false,
          needsAnswers: [...new Set([...(row.routed.needsAnswers ?? []), ...needs])],
        };
        row.overlapEligible = false;
      }
    }
    const itemIds = visible.map((row) => row.inventory.id);
    for (const row of visible) {
      if (row.routed.tier === 'PROTECTED') continue;
      row.routed = {
        ...row.routed,
        overlapIds: [
          ...new Set([
            ...(row.routed.overlapIds ?? []),
            ...itemIds.filter((id) => id !== row.inventory.id),
          ]),
        ],
      };
    }
    for (const row of drops)
      row.routed = {
        ...row.routed,
        tier: 'T2',
        step: 'overlap',
        reason: 'overlaps with something else',
        keep: false,
        canRunAnyway: false,
        dailyRating: undefined,
      };
    decisions.push({
      group: group.name,
      itemIds,
      status,
      keepId: keeper?.inventory.id,
      dropIds: drops.map((row) => row.inventory.id),
      needsAnswers: [...new Set(needs)],
      ruleText: group.ruleText,
      monthlyTotal:
        visible.reduce((sum, row) => sum + Math.round((row.routed.monthlyCost ?? 0) * 100), 0) /
        100,
      comparisons: visible
        .filter((row) => row.routed.tier !== 'PROTECTED')
        .map((row) => ({
          id: row.inventory.id,
          usesLast30Days: usage(row) ?? null,
          costPerUse:
            (usage(row) ?? 0) > 0
              ? Math.round(((row.routed.monthlyCost ?? 0) * 100) / usage(row)!) / 100
              : null,
        })),
    });
  }
  return decisions;
}
