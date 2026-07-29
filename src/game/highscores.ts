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
  score: number;
  accuracy: number;
  streak: number;
  hands: number;
  date: number;
  mode?: Mode;
}

const KEY = "hilo-ace-highscores-v1";

export function loadHighScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HighScore[];
    if (!Array.isArray(arr)) return [];
    return arr.sort((a, b) => b.score - a.score).slice(0, 10);
  } catch {
    return [];
  }
}

export function saveHighScore(entry: HighScore): HighScore[] {
  const list = loadHighScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, 10);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {}
  return trimmed;
}

export function isHighScore(score: number): boolean {
  const list = loadHighScores();
  if (list.length < 10) return score > 0;
  return score > list[list.length - 1].score;
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
