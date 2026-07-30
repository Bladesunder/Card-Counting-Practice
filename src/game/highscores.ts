export type Mode = "strategy" | "count" | "both";

export const MODE_META: Record<Mode, { title: string; short: string; blurb: string; icon: string }> = {
  strategy: {
    title: "Basic Strategy",
    short: "STRATEGY",
    blurb: "Call the perfect play on every hand. No counting.",
    icon: "♠",
  },
  count: {
    title: "Card Counting",
    short: "COUNTING",
    blurb: "Cards fly by — keep the Hi-Lo running count in your head.",
    icon: "±",
  },
  both: {
    title: "Full Table",
    short: "BOTH",
    blurb: "Perfect play AND the running count. The real deal.",
    icon: "★",
  },
};

export interface HighScore {
  name: string;
  streak: number;
  timeMs: number;
  avgMsPerHand: number;
  date: number;
  mode?: Mode;
}

const KEY = "hilo-ace-highscores-v2";

function rankEntries(list: HighScore[]): HighScore[] {
  return list.sort((a, b) => b.streak - a.streak || a.avgMsPerHand - b.avgMsPerHand);
}

export function loadHighScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HighScore[];
    if (!Array.isArray(arr)) return [];
    return rankEntries(arr).slice(0, 10);
  } catch {
    return [];
  }
}

export function saveHighScore(entry: HighScore): HighScore[] {
  const list = loadHighScores();
  list.push(entry);
  const trimmed = rankEntries(list).slice(0, 10);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {}
  return trimmed;
}

export function isHighScore(streak: number): boolean {
  const list = loadHighScores();
  if (list.length < 10) return streak > 0;
  return streak > list[list.length - 1].streak;
}

export function loadMode(): Mode {
  try {
    const m = localStorage.getItem("hilo-ace-mode");
    if (m === "strategy" || m === "count" || m === "both") return m;
  } catch {}
  return "both";
}
export function saveMode(m: Mode) {
  try { localStorage.setItem("hilo-ace-mode", m); } catch {}
}

export function loadName(): string {
  try {
    return localStorage.getItem("hilo-ace-name") || "";
  } catch {
    return "";
  }
}
export function saveName(n: string) {
  try { localStorage.setItem("hilo-ace-name", n); } catch {}
}
