import { Card, Rank } from "./cards";
import { ChartLocation, ChartTable, DEALER_COLS } from "./strategy";

/** Encoded as `${table}:${rowKey}:${colIdx}` — one selected spot on the strategy card. */
export type RangeKey = string;

const STORAGE_KEY = "hilo-ace-range-v1";
const TEN_RANKS: Rank[] = ["10", "J", "Q", "K"];

export function keyOf(table: ChartTable, rowKey: string, colIdx: number): RangeKey {
  return `${table}:${rowKey}:${colIdx}`;
}

export function parseKey(key: RangeKey): ChartLocation | null {
  const m = /^(hard|soft|pair):([^:]+):(\d+)$/.exec(key);
  if (!m) return null;
  return { table: m[1] as ChartTable, rowKey: m[2], colIdx: Number(m[3]) };
}

export function loadRange(): Set<RangeKey> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((k): k is string => typeof k === "string" && parseKey(k) !== null)
    );
  } catch {
    return new Set();
  }
}

export function saveRange(cells: Set<RangeKey>): void {
  try {
    if (cells.size === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify([...cells]));
  } catch {
    // Storage unavailable — the selection simply won't persist.
  }
}

export function countByTable(cells: Set<RangeKey>): Record<ChartTable, number> {
  const counts: Record<ChartTable, number> = { hard: 0, soft: 0, pair: 0 };
  for (const k of cells) {
    const loc = parseKey(k);
    if (loc) counts[loc.table]++;
  }
  return counts;
}

export interface CuratedHand {
  player: [Card, Card];
  dealerUp: Card;
  hole: Card;
  rest: Card[];
}

interface HandRequirement {
  playerGroups: [Rank[], Rank[]];
  dealerGroup: Rank[];
}

function ranksForValue(v: number): Rank[] {
  return v === 10 ? TEN_RANKS : [String(v) as Rank];
}

function requirementFor(loc: ChartLocation): HandRequirement | null {
  const col = DEALER_COLS[loc.colIdx];
  const dealerGroup: Rank[] = col === "10" ? TEN_RANKS : col ? [col as Rank] : [];
  if (dealerGroup.length === 0) return null;

  if (loc.table === "pair") {
    const g = loc.rowKey === "10" ? TEN_RANKS : [loc.rowKey as Rank];
    return { playerGroups: [g, g], dealerGroup };
  }
  if (loc.table === "soft") {
    const kicker = Number(loc.rowKey) - 11;
    if (kicker < 2 || kicker > 9) return null;
    return { playerGroups: [["A"], [String(kicker) as Rank]], dealerGroup };
  }
  // Hard: two non-ace cards of differing value (equal values are pairs, which
  // live on the pair chart). Some rows (e.g. hard 20) have no such 2-card combo.
  const total = Number(loc.rowKey);
  const combos: [Rank[], Rank[]][] = [];
  for (let v1 = 2; v1 <= 10; v1++) {
    const v2 = total - v1;
    if (v2 < 2 || v2 > 10 || v2 === v1) continue;
    combos.push([ranksForValue(v1), ranksForValue(v2)]);
  }
  if (combos.length === 0) return null;
  return { playerGroups: combos[Math.floor(Math.random() * combos.length)], dealerGroup };
}

// Uniform pick without allocating a candidate list (reservoir sample).
function takeRandomIndex(shoe: Card[], used: Set<number>, group: Rank[]): number {
  let idx = -1;
  let seen = 0;
  for (let i = 0; i < shoe.length; i++) {
    if (used.has(i) || !group.includes(shoe[i].rank)) continue;
    seen++;
    if (Math.random() < 1 / seen) idx = i;
  }
  return idx;
}

/**
 * Build a 2-card player hand + dealer upcard that lands on one of the selected
 * chart spots (uniform over spots, so rare drills like 8,8 vs 10 come up as
 * often as common ones). Returns null if no selected spot can be built from
 * the remaining shoe — the caller should reshuffle and retry, then fall back
 * to a normal random deal.
 */
export function buildCuratedHand(cells: Set<RangeKey>, shoe: Card[]): CuratedHand | null {
  if (cells.size === 0 || shoe.length < 4) return null;
  const order = [...cells];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const key of order) {
    const loc = parseKey(key);
    if (!loc) continue;
    const req = requirementFor(loc);
    if (!req) continue;
    const used = new Set<number>();
    const i1 = takeRandomIndex(shoe, used, req.playerGroups[0]);
    if (i1 < 0) continue;
    used.add(i1);
    const i2 = takeRandomIndex(shoe, used, req.playerGroups[1]);
    if (i2 < 0) continue;
    used.add(i2);
    const iu = takeRandomIndex(shoe, used, req.dealerGroup);
    if (iu < 0) continue;
    used.add(iu);
    const ih = shoe.findIndex((_, i) => !used.has(i));
    if (ih < 0) continue;
    used.add(ih);
    return {
      player: [shoe[i1], shoe[i2]],
      dealerUp: shoe[iu],
      hole: shoe[ih],
      rest: shoe.filter((_, i) => !used.has(i)),
    };
  }
  return null;
}
