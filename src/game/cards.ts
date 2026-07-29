export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  rank: Rank;
  suit: Suit;
  id: string;
}

export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
export const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function suitColor(s: Suit): "red" | "black" {
  return s === "♥" || s === "♦" ? "red" : "black";
}

// Hi-Lo tag: 2-6 => +1, 7-9 => 0, 10/J/Q/K/A => -1
export function hiLoValue(r: Rank): number {
  if (r === "A" || r === "10" || r === "J" || r === "Q" || r === "K") return -1;
  if (r === "7" || r === "8" || r === "9") return 0;
  return 1;
}

export function cardValue(r: Rank): number {
  if (r === "A") return 11;
  if (r === "K" || r === "Q" || r === "J" || r === "10") return 10;
  return parseInt(r, 10);
}

let idCounter = 0;
export function makeShoe(decks = 6): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) {
        shoe.push({ rank: r, suit: s, id: `c${idCounter++}` });
      }
    }
  }
  // Fisher-Yates shuffle
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

export interface HandValue {
  total: number;
  soft: boolean; // has usable ace counted as 11
}

export function evaluateHand(cards: Card[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === "A") {
      aces++;
      total += 11;
    } else {
      total += cardValue(c.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isPair(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  return cardValue(cards[0].rank) === cardValue(cards[1].rank) && cards[0].rank === cards[1].rank
    // treat 10/J/Q/K as pair of 10s
    || (cardValue(cards[0].rank) === 10 && cardValue(cards[1].rank) === 10);
}
