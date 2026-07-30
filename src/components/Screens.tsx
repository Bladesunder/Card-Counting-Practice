import { useEffect, useState } from "react";
import { HighScore, loadHighScores, Mode, MODE_META } from "../game/highscores";
import { cn } from "../utils/cn";

const MODES: Mode[] = ["strategy", "count", "both"];

export function ModeSwitch({
  mode,
  onChange,
  compact,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  compact?: boolean;
}) {
  return (
    <div className="w-full">
      <div className="relative flex gap-1 p-1 rounded-2xl bg-black/50 border border-white/10">
        {MODES.map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              onClick={() => onChange(m)}
              className={cn(
                "btn-juice relative flex-1 rounded-xl font-black transition-colors",
                compact ? "py-1.5 text-[11px]" : "py-2.5 text-xs sm:text-sm",
                active
                  ? "bg-gradient-to-b from-amber-300 to-amber-500 text-black shadow-lg shadow-amber-500/30"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              )}
            >
              <span className="mr-1">{MODE_META[m].icon}</span>
              {MODE_META[m].short}
            </button>
          );
        })}
      </div>
      {!compact && (
        <div key={mode} className="pop-in mt-2 text-[11px] sm:text-xs text-neutral-400 h-8 flex items-center justify-center text-center px-2">
          {MODE_META[mode].blurb}
        </div>
      )}
    </div>
  );
}

export function StartScreen({
  onStart,
  best,
  mode,
  onModeChange,
  onOpenChart,
  onOpenScores,
}: {
  onStart: () => void;
  best: number;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  onOpenChart: () => void;
  onOpenScores: () => void;
}) {
  const showsStrategy = mode !== "count";
  const showsCount = mode !== "strategy";
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-4 py-6 overflow-y-auto no-scrollbar backdrop-blur-sm bg-black/40">
      <div className="pop-in text-center max-w-md w-full my-auto">
        <div className="text-amber-400/80 text-[10px] sm:text-xs tracking-[0.4em] font-semibold mb-1">BLACKJACK · HI-LO</div>
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent drop-shadow-[0_4px_20px_rgba(245,196,107,0.4)]">
          Hi-Lo Ace
        </h1>

        <div className="mt-5">
          <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 mb-1.5">Practice mode</div>
          <ModeSwitch mode={mode} onChange={onModeChange} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-neutral-300">
          {showsStrategy && <><Key label="H" text="Hit" /><Key label="S" text="Stand" /><Key label="D" text="Double" /><Key label="P" text="Split" /></>}
          {showsCount && <><Key label="↑ / ↓" text="Count ±" /><Key label="Space" text="Lock in" /></>}
          <Key label="C" text="Strategy card" />
          <Key label="Esc" text="Pause" />
        </div>

        <button
          onClick={onStart}
          className="btn-juice mt-5 w-full px-10 py-4 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 text-black font-black text-xl shadow-xl shadow-amber-500/40 hover:brightness-110 glow-pulse"
        >
          DEAL ME IN
        </button>

        <div className="mt-2.5 flex gap-2">
          <button
            onClick={onOpenChart}
            className="btn-juice flex-1 px-4 py-2.5 rounded-xl bg-white/10 text-white font-bold text-sm border border-white/20 hover:bg-white/15"
          >
            📋 Strategy Card
          </button>
          <button
            onClick={onOpenScores}
            className="btn-juice flex-1 px-4 py-2.5 rounded-xl bg-white/10 text-white font-bold text-sm border border-white/20 hover:bg-white/15"
          >
            🏆 High Scores
          </button>
        </div>

        {best > 0 && (
          <div className="mt-3 text-neutral-400 text-sm">
            Best streak: <span className="text-amber-300 font-bold">×{best}</span>
          </div>
        )}
        <p className="mt-4 text-[10px] text-neutral-500 leading-relaxed">
          6-deck shoe · dealer stands soft 17 · DAS allowed · Hi-Lo tags: 2–6 = +1, 7–9 = 0, 10/J/Q/K/A = −1
        </p>
      </div>
    </div>
  );
}

function Key({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex items-center gap-2 justify-center bg-white/5 rounded-lg px-2 py-1.5 border border-white/10">
      <kbd className="px-2 py-0.5 rounded bg-black/60 border border-white/20 font-mono text-amber-200 text-[11px]">{label}</kbd>
      <span>{text}</span>
    </div>
  );
}

export function PauseScreen({
  onResume,
  onQuit,
  mode,
  onModeChange,
  onOpenChart,
}: {
  onResume: () => void;
  onQuit: () => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  onOpenChart: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-4 backdrop-blur-md bg-black/60">
      <div className="pop-in text-center w-full max-w-sm">
        <h2 className="text-4xl sm:text-6xl font-black text-amber-300">PAUSED</h2>

        <div className="mt-5">
          <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 mb-1.5">Practice mode</div>
          <ModeSwitch mode={mode} onChange={onModeChange} />
          <div className="text-[10px] text-neutral-500 -mt-1">Switching restarts the run</div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            onClick={onResume}
            className="btn-juice px-8 py-3 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-black font-bold text-lg shadow-lg"
          >
            Resume (Esc)
          </button>
          <button
            onClick={onOpenChart}
            className="btn-juice px-8 py-3 rounded-xl bg-white/10 text-white font-bold border border-white/20"
          >
            📋 Strategy Card (C)
          </button>
          <button
            onClick={onQuit}
            className="btn-juice px-8 py-2.5 rounded-xl bg-white/5 text-neutral-300 font-bold border border-white/10"
          >
            Quit to Menu
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameOverScreen({
  streak,
  accuracy,
  timeMs,
  avgMsPerHand,
  lastMistake,
  rangeActive,
  onRestart,
  onMenu,
  newHigh,
  name,
  setName,
  onSave,
  mode,
}: {
  streak: number;
  accuracy: number;
  timeMs: number;
  avgMsPerHand: number;
  lastMistake: string | null;
  rangeActive: boolean;
  onRestart: () => void;
  onMenu: () => void;
  newHigh: boolean;
  name: string;
  setName: (n: string) => void;
  onSave: () => void;
  mode: Mode;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-4 backdrop-blur-md bg-black/70">
      <div className="pop-in text-center max-w-md w-full">
        <div className="text-red-400 text-xs tracking-[0.4em] font-semibold mb-1">BUSTED</div>
        <h2 className="text-4xl sm:text-6xl font-black text-white">Game Over</h2>
        <div className="mt-1 text-xs text-neutral-400">
          {MODE_META[mode].icon} {MODE_META[mode].title}
        </div>

        {lastMistake && (
          <div className="mt-4 px-4 py-2 rounded-xl bg-red-500/15 border border-red-400/30 text-red-200 text-sm font-bold">
            {lastMistake}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 bg-white/5 rounded-2xl p-4 border border-white/10">
          <Stat label="Streak" value={`×${streak}`} highlight />
          <Stat label="Time spent" value={fmtDuration(timeMs)} />
          <Stat label="Avg per hand" value={fmtAvg(avgMsPerHand)} />
          <Stat label="Accuracy" value={`${accuracy}%`} />
        </div>

        {rangeActive && (
          <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10 text-neutral-400 text-xs">
            Range practice — high scores don't count
          </div>
        )}

        {newHigh && !saved && !rangeActive && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/20 border border-amber-400/40">
            <div className="text-amber-300 font-bold text-sm">🏆 NEW HIGH SCORE!</div>
            <div className="mt-2 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 12))}
                placeholder="Your name"
                className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white outline-none focus:border-amber-400"
                autoFocus
              />
              <button
                onClick={() => { onSave(); setSaved(true); }}
                className="btn-juice px-4 py-2 rounded-lg bg-amber-400 text-black font-bold"
              >
                Save
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={onRestart}
            className="btn-juice px-8 py-4 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-black font-black text-lg shadow-lg shadow-amber-500/30"
          >
            PLAY AGAIN (Space)
          </button>
          <button
            onClick={onMenu}
            className="btn-juice px-8 py-2 rounded-xl bg-white/10 text-white border border-white/20"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-left">
      <div className="text-[10px] uppercase tracking-widest text-neutral-400">{label}</div>
      <div className={cn("text-2xl font-black", highlight ? "text-amber-300" : "text-white")}>{value}</div>
    </div>
  );
}

export function fmtDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtAvg(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function HighScoreTable({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [scores, setScores] = useState<HighScore[]>([]);
  useEffect(() => {
    if (open) setScores(loadHighScores());
  }, [open]);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={onClose}>
      <div
        className="pop-in bg-neutral-900 border border-white/10 rounded-2xl p-5 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black text-amber-300">🏆 High Scores</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-xl">✕</button>
        </div>
        <div className="mt-4">
          {scores.length === 0 ? (
            <div className="text-neutral-500 text-center py-6">No scores yet. Go make one!</div>
          ) : (
            <div className="space-y-1">
              {scores.map((s, i) => (
                <div key={i} className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg",
                  i === 0 ? "bg-amber-500/20 border border-amber-400/30" : "bg-white/5"
                )}>
                  <div className="w-6 text-center font-black text-neutral-400">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white truncate leading-tight">{s.name || "Anon"}</div>
                    <div className="text-[9px] uppercase tracking-wider text-neutral-500">
                      {s.mode ? MODE_META[s.mode].short : "BOTH"} · {fmtDuration(s.timeMs)} · {fmtAvg(s.avgMsPerHand)}/hand
                    </div>
                    <div className="text-[9px] text-neutral-600">
                      {new Date(s.date).toLocaleString()}
                    </div>
                  </div>
                  <div className="w-14 text-right font-black text-amber-300">×{s.streak}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
