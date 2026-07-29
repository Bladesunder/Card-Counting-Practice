import { Card, cardValue, evaluateHand, isPair } from "./cards";

export type Action = "H" | "S" | "D" | "P"; // Hit, Stand, Double, Split
export const ACTION_LABEL: Record<Action, string> = {
  H: "Hit",
  S: "Stand",
  D: "Double",
  P: "Split",
};
export const ACTION_COLOR: Record<Action, string> = {
  H: "#22c55e",
  S: "#ef4444",
  D: "#3b82f6",
  P: "#f59e0b",
};

export const DEALER_COLS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];

// Dealer up card index: 2-9 => 0-7, 10 => 8, A => 9
export function dealerIdx(dealerUp: Card): number {
  const v = cardValue(dealerUp.rank);
  if (dealerUp.rank === "A") return 9;
  if (v === 10) return 8;
  return v - 2;
}

// Pair splitting chart (rows: pair rank, cols: dealer 2..A)
// Values: "P" split, "H" hit, "S" stand, "D" double (rare in pair), "Ph" split if DAS else hit
// We'll assume DAS allowed for simpler chart.
export const pairChart: Record<string, Action[]> = {
  A:  ["P","P","P","P","P","P","P","P","P","P"],
  "10":["S","S","S","S","S","S","S","S","S","S"],
  "9": ["P","P","P","P","P","S","P","P","S","S"],
  "8": ["P","P","P","P","P","P","P","P","P","P"],
  "7": ["P","P","P","P","P","P","H","H","H","H"],
  "6": ["P","P","P","P","P","H","H","H","H","H"],
  "5": ["D","D","D","D","D","D","D","D","H","H"],
  "4": ["H","H","H","P","P","H","H","H","H","H"],
  "3": ["P","P","P","P","P","P","H","H","H","H"],
  "2": ["P","P","P","P","P","P","H","H","H","H"],
};

// Soft totals: soft 13..20 (A+2 .. A+9). Rows keyed by non-ace rank sum. Cols dealer 2..A.
// Assumes double allowed after any two cards; if double not possible, treat D as H.
export const softChart: Record<number, Action[]> = {
  // soft total : row
  20: ["S","S","S","S","S","S","S","S","S","S"],
  19: ["S","S","S","S","D","S","S","S","S","S"],
  18: ["D","D","D","D","D","S","S","H","H","H"],
  17: ["H","D","D","D","D","H","H","H","H","H"],
  16: ["H","H","D","D","D","H","H","H","H","H"],
  15: ["H","H","D","D","D","H","H","H","H","H"],
  14: ["H","H","H","D","D","H","H","H","H","H"],
  13: ["H","H","H","D","D","H","H","H","H","H"],
};

// Hard totals 5..21
export const hardChart: Record<number, Action[]> = {
  21: ["S","S","S","S","S","S","S","S","S","S"],
  20: ["S","S","S","S","S","S","S","S","S","S"],
  19: ["S","S","S","S","S","S","S","S","S","S"],
  18: ["S","S","S","S","S","S","S","S","S","S"],
  17: ["S","S","S","S","S","S","S","S","S","S"],
  16: ["S","S","S","S","S","H","H","H","H","H"],
  15: ["S","S","S","S","S","H","H","H","H","H"],
  14: ["S","S","S","S","S","H","H","H","H","H"],
  13: ["S","S","S","S","S","H","H","H","H","H"],
  12: ["H","H","S","S","S","H","H","H","H","H"],
  11: ["D","D","D","D","D","D","D","D","D","H"],
  10: ["D","D","D","D","D","D","D","D","H","H"],
  9:  ["H","D","D","D","D","H","H","H","H","H"],
  8:  ["H","H","H","H","H","H","H","H","H","H"],
  7:  ["H","H","H","H","H","H","H","H","H","H"],
  6:  ["H","H","H","H","H","H","H","H","H","H"],
  5:  ["H","H","H","H","H","H","H","H","H","H"],
};

export interface StrategyContext {
  canDouble: boolean; // only true on first decision, 2 cards
  canSplit: boolean;
}

export function correctAction(
  player: Card[],
  dealerUp: Card,
  ctx: StrategyContext
): Action {
  const di = dealerIdx(dealerUp);
  // Pair
  if (ctx.canSplit && isPair(player)) {
    const key = player[0].rank === "A" ? "A"
      : cardValue(player[0].rank) === 10 ? "10"
      : player[0].rank;
    const a = pairChart[key]?.[di];
    if (a) {
      if (a === "D" && !ctx.canDouble) return "H";
      return a;
    }
  }
  const hv = evaluateHand(player);
  // Soft
  if (hv.soft && hv.total >= 13 && hv.total <= 20) {
    const a = softChart[hv.total][di];
    if (a === "D" && !ctx.canDouble) {
      // fall back: soft 18 stand vs some; soft 17-13 hit
      return hv.total >= 18 ? "S" : "H";
    }
    return a;
  }
  // Hard
  const row = hardChart[Math.min(21, Math.max(5, hv.total))];
  const a = row[di];
  if (a === "D" && !ctx.canDouble) {
    return hv.total >= 12 ? "S" : "H";
  }
  return a;
}

export type ChartTable = "pair" | "soft" | "hard";
export interface ChartLocation {
  table: ChartTable;
  rowKey: string;
  colIdx: number;
}

/** Where does this hand live on the printed strategy card? Used to highlight the cell. */
export function chartLocation(
  player: Card[],
  dealerUp: Card,
  canSplit: boolean
): ChartLocation | null {
  if (!player.length || !dealerUp) return null;
  const colIdx = dealerIdx(dealerUp);
  if (canSplit && isPair(player)) {
    const key =
      player[0].rank === "A" ? "A" : cardValue(player[0].rank) === 10 ? "10" : player[0].rank;
    if (pairChart[key]) return { table: "pair", rowKey: key, colIdx };
  }
  const hv = evaluateHand(player);
  if (hv.soft && hv.total >= 13 && hv.total <= 20) {
    return { table: "soft", rowKey: String(hv.total), colIdx };
  }
  const t = Math.min(21, Math.max(5, hv.total));
  return { table: "hard", rowKey: String(t), colIdx };
}

// Explanation string for feedback
export function explainAction(
  player: Card[],
  dealerUp: Card,
  action: Action
): string {
  const hv = evaluateHand(player);
  const dv = dealerUp.rank === "A" ? "A" : String(cardValue(dealerUp.rank));
  const kind = isPair(player)
    ? `pair of ${player[0].rank}s`
    : hv.soft
    ? `soft ${hv.total}`
    : `hard ${hv.total}`;
  return `${ACTION_LABEL[action]} on ${kind} vs dealer ${dv}`;
}
