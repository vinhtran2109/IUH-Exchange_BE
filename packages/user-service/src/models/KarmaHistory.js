import { SupabaseModel, baseRow, valueOrNull } from '@iuh-exchange/common';

function mapKarmaHistoryToRow(item) {
  return {
    ...baseRow(item),
    user_id: String(item.userId),
    type: item.type || item.source || null,
    points: item.points ?? item.amount ?? null,
    reason: item.reason || '',
    related_id: valueOrNull(item.relatedId),
    metadata: {
      amount: item.amount,
      previousKarma: item.previousKarma,
      newKarma: item.newKarma,
      performedBy: item.performedBy,
      source: item.source,
      ...(item.metadata || {}),
    },
  };
}

export const KarmaHistory = new SupabaseModel('karma_histories', mapKarmaHistoryToRow);
