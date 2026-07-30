import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, evaluateHand, hiLoValue, isPair, makeShoe } from "../game/cards";
import { Action, ACTION_COLOR, ACTION_LABEL, chartLocation, correctAction, explainAction } from "../game/strategy";
import { sfx, setMuted, isMuted } from "../game/sound";
import {
  HighScore, isHighScore, loadHighScores, loadMode, loadName,
  Mode, MODE_META, saveHighScore, saveMode, saveName,
} from "../game/highscores";
import { buildCuratedHand, loadRange, RangeKey, saveRange } from "../game/practiceRange";
import { PlayingCard } from "./PlayingCard";
import { Burst, ParticleLayer } from "./Particles";
import { GameOverScreen, HighScoreTable, PauseScreen, StartScreen } from "./Screens";
import { StrategyChart } from "./StrategyChart";
import { cn } from "../utils/cn";

type Phase = "menu" | "playing" | "paused" | "gameover";
type SubPhase = "decision" | "countPrompt" | "feedback" | "dealing";

interface Toast {
  id: number;
  text: string;
  color: string;
  x: number;
  y: number;
}

const LIVES_START = 3;
const RESHUFFLE_AT = 60; // reshuffle when shoe has < 60 cards left of 312 (6 decks)

export default function Game() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [sub, setSub] = useState<SubPhase>("decision");
  const [shoe, setShoe] = useState<Card[]>(() => makeShoe(6));
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]); // dealer[1] hidden until count prompt phase
  const [visibleDealer, setVisibleDealer] = useState<Card[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [lives, setLives] = useState(LIVES_START);
  const [hands, setHands] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [runningCount, setRunningCount] = useState(0); // ground truth
  const [userCount, setUserCount] = useState(0); // player's guess
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [shakeClass, setShakeClass] = useState<string>("");
  const [showHint, setShowHint] = useState(false);
  const [comboFlashKey, setComboFlashKey] = useState(0);
  const [showHighScores, setShowHighScores] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [newHigh, setNewHigh] = useState(false);
  const [name, setName] = useState(loadName());
  const [bestOverall, setBestOverall] = useState(0);
  const [handsSinceCountPrompt, setHandsSinceCountPrompt] = useState(0);
  const [mode, setModeState] = useState<Mode>(() => loadMode());
  const [showChart, setShowChart] = useState(false);
  const [range, setRangeState] = useState<Set<RangeKey>>(() => loadRange());

  const burstIdRef = useRef(0);
  const toastIdRef = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const shakeTimerRef = useRef<number | null>(null);
  // dealHand reads the mode through a ref so a mode-switch + immediate restart
  // never deals a hand using the previous mode's rules.
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  // dealHand reads the practice range through a ref for the same reason as modeRef.
  const rangeRef = useRef(range);
  useEffect(() => { rangeRef.current = range; }, [range]);

  const setRange = useCallback((next: Set<RangeKey>) => {
    setRangeState(next);
    saveRange(next);
  }, []);

  // Load best score on mount
  useEffect(() => {
    const list = loadHighScores();
    if (list.length > 0) setBestOverall(list[0].score);
  }, []);

  const pushBurst = useCallback((x: number, y: number, color: string, kind: Burst["kind"] = "spark") => {
    setBursts((b) => {
      const next = [...b, { id: ++burstIdRef.current, x, y, color, kind }];
      // keep list bounded
      return next.slice(-40);
    });
  }, []);

  const pushToast = useCallback((text: string, color: string, x?: number, y?: number) => {
    const id = ++toastIdRef.current;
    const w = window.innerWidth;
    const h = window.innerHeight;
    setToasts((t) => [...t, {
      id, text, color,
      x: x ?? w / 2,
      y: y ?? h / 2 - 40,
    }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 900);
  }, []);

  const doShake = useCallback((size: "sm" | "md") => {
    setShakeClass(size === "sm" ? "shake-sm" : "shake-md");
    if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = window.setTimeout(() => setShakeClass(""), size === "sm" ? 240 : 400) as unknown as number;
  }, []);

  // Shoe penetration — a real counter can read this off the discard tray.
  const decksRemaining = Math.max(0.5, shoe.length / 52);
  const trueCount = Math.round((runningCount / decksRemaining) * 10) / 10;

  // Draw N cards from shoe, updating running count for cards that will be shown (all).
  const drawCards = useCallback((n: number, from: Card[]): { drawn: Card[]; rest: Card[] } => {
    const drawn = from.slice(0, n);
    const rest = from.slice(n);
    return { drawn, rest };
  }, []);

  // Deal a new hand
  const dealHand = useCallback((currentShoe?: Card[]) => {
    let s = currentShoe ?? shoe;
    if (s.length < RESHUFFLE_AT) {
      s = makeShoe(6);
      setRunningCount(0);
      pushToast("SHUFFLE", "#f5c46b");
    }
    setSub("dealing");
    const countOnly = modeRef.current === "count";
    // Counting-only mode deals extra cards so the count moves faster and feels alive.
    const n = countOnly ? 5 : 4;

    // With an active practice range, deal only hands that land on a selected spot.
    const wantCurated = !countOnly && rangeRef.current.size > 0;
    let curated = wantCurated ? buildCuratedHand(rangeRef.current, s) : null;
    if (wantCurated && !curated) {
      // The selected spots can't be built from the remaining shoe (ranks
      // depleted, or a 2-card-impossible row like hard 20) — reshuffle and
      // retry once, then fall back to a normal random deal.
      s = makeShoe(6);
      setRunningCount(0);
      pushToast("SHUFFLE", "#f5c46b");
      curated = buildCuratedHand(rangeRef.current, s);
    }

    let p: Card[];
    let d: Card[];
    let rest: Card[];
    if (curated) {
      p = curated.player;
      d = [curated.dealerUp, curated.hole]; // dealer[1] is hole card
      rest = curated.rest;
    } else {
      const { drawn, rest: remaining } = drawCards(n, s);
      // Order dealt: player, dealer, player, dealer
      p = countOnly ? [drawn[0], drawn[2], drawn[4]] : [drawn[0], drawn[2]];
      d = [drawn[1], drawn[3]];
      rest = remaining;
    }
    setPlayer(p);
    setDealer(d);
    // In counting mode every card is face-up — nothing is hidden from the counter.
    setVisibleDealer(countOnly ? d : [d[0]]);
    setShoe(rest);

    const delta =
      p.reduce((acc, c) => acc + hiLoValue(c.rank), 0) +
      hiLoValue(d[0].rank) +
      (countOnly ? hiLoValue(d[1].rank) : 0);
    setRunningCount((rc) => rc + delta);

    // Counted per hand dealt so counting-only mode (which has no strategy
    // decision) still schedules count checks.
    setHandsSinceCountPrompt((h) => h + 1);

    setFeedback(null);
    setShowHint(false);
    sfx.deal();
    for (let i = 1; i < n; i++) setTimeout(() => sfx.deal(), i * 110);
    // Counting mode has no decision — go straight to the "watch & track" beat.
    setTimeout(() => setSub(countOnly ? "feedback" : "decision"), countOnly ? 420 : 500);
  }, [shoe, drawCards, pushToast]);

  const startGame = useCallback(() => {
    const fresh = makeShoe(6);
    setShoe(fresh);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setLives(LIVES_START);
    setHands(0);
    setCorrectCount(0);
    setRunningCount(0);
    setUserCount(0);
    setHandsSinceCountPrompt(0);
    setPhase("playing");
    setNewHigh(false);
    sfx.start();
    if (rangeRef.current.size > 0 && modeRef.current !== "count") {
      setTimeout(() => pushToast("RANGE PRACTICE", "#f5c46b"), 400);
    }
    // Give the first hand
    setTimeout(() => dealHand(fresh), 250);
  }, [dealHand, pushToast]);

  const changeMode = useCallback((m: Mode) => {
    if (m === mode) return;
    setModeState(m);
    saveMode(m);
    sfx.click();
    // Switching mid-run restarts so scores stay comparable within a mode.
    // modeRef is refreshed by its effect before this timeout fires.
    if (phase === "playing" || phase === "paused") {
      setTimeout(() => startGame(), 0);
    }
  }, [mode, phase, startGame]);

  const endGame = useCallback(() => {
    sfx.gameover();
    doShake("md");
    setPhase("gameover");
    setNewHigh(isHighScore(score));
  }, [score, doShake]);

  // Handle player action
  const handleAction = useCallback((action: Action) => {
    if (phase !== "playing" || sub !== "decision") return;
    const canDouble = player.length === 2;
    const canSplit = isPair(player);
    if (action === "P" && !canSplit) {
      pushToast("Can't split", "#ef4444");
      sfx.wrong();
      return;
    }
    if (action === "D" && !canDouble) {
      pushToast("Can't double", "#ef4444");
      sfx.wrong();
      return;
    }
    const dealerUp = dealer[0];
    const right = correctAction(player, dealerUp, { canDouble, canSplit });
    const ok = action === right;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    setHands((h) => h + 1);
    if (ok) {
      const gain = 100 + combo * 15;
      setScore((s) => s + gain);
      const nc = combo + 1;
      setCombo(nc);
      setBestCombo((b) => Math.max(b, nc));
      setCorrectCount((c) => c + 1);
      setComboFlashKey((k) => k + 1);
      setFeedback({ ok: true, msg: `✓ Correct — ${explainAction(player, dealerUp, right)}` });
      pushBurst(centerX, centerY, "#22c55e", "confetti");
      pushBurst(centerX, centerY, "#f5c46b", "ring");
      pushToast(`+${gain}${nc > 1 ? ` × ${nc}` : ""}`, "#f5c46b", centerX, centerY - 60);
      sfx.correct();
      if (nc > 1) sfx.combo(nc);
    } else {
      setCombo(0);
      setLives((l) => l - 1);
      setFeedback({ ok: false, msg: `✗ Wrong — correct: ${ACTION_LABEL[right]} (${explainAction(player, dealerUp, right)})` });
      pushBurst(centerX, centerY, "#ef4444", "spark");
      pushToast(`−1 LIFE`, "#ef4444", centerX, centerY - 60);
      sfx.wrong();
      doShake("md");
    }

    // Reveal dealer hole card + update running count
    setVisibleDealer(dealer);
    setRunningCount((rc) => rc + hiLoValue(dealer[1].rank));

    setSub("feedback");
  }, [phase, sub, player, dealer, combo, pushBurst, pushToast, doShake, endGame]);

  // Advance from feedback → maybe count prompt → deal next
  const advance = useCallback(() => {
    if (phase !== "playing") return;
    if (sub === "feedback") {
      // Count quizzes only exist in modes that train counting.
      const countsEnabled = mode !== "strategy";
      // Counting-only mode quizzes often; "both" ramps the gap up as you survive.
      const freq = mode === "count" ? 2 : hands < 5 ? 2 : hands < 15 ? 3 : 4;
      if (countsEnabled && handsSinceCountPrompt >= freq) {
        setSub("countPrompt");
        setUserCount(0);
      } else {
        // Check lives; if 0, endGame
        if (lives <= 0) { endGame(); return; }
        dealHand();
      }
    } else if (sub === "countPrompt") {
      // Submit count
      const ok = userCount === runningCount;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      setHands((h) => h + 1);
      if (ok) {
        const bonus = 250 + combo * 25;
        setScore((s) => s + bonus);
        const nc = combo + 1;
        setCombo(nc);
        setBestCombo((b) => Math.max(b, nc));
        setCorrectCount((c) => c + 1);
        setComboFlashKey((k) => k + 1);
        pushBurst(cx, cy, "#3b82f6", "confetti");
        pushBurst(cx, cy, "#60a5fa", "ring");
        pushToast(`COUNT! +${bonus}`, "#60a5fa", cx, cy - 60);
        sfx.correct();
      } else {
        setCombo(0);
        setLives((l) => l - 1);
        pushToast(`Miscount: was ${runningCount > 0 ? `+${runningCount}` : runningCount}`, "#ef4444", cx, cy - 60);
        sfx.wrong();
        doShake("md");
      }
      // Teach the running → true count conversion after every check.
      setFeedback({
        ok,
        msg: `Running ${runningCount > 0 ? `+${runningCount}` : runningCount} ÷ ${decksRemaining.toFixed(1)} decks = true count ${trueCount > 0 ? `+${trueCount}` : trueCount}`,
      });
      setHandsSinceCountPrompt(0);
      setTimeout(() => {
        setLives((cl) => {
          if (cl <= 0) { endGame(); return cl; }
          dealHand();
          return cl;
        });
      }, 700);
    }
  }, [phase, sub, mode, hands, combo, handsSinceCountPrompt, lives, dealHand, endGame, userCount, runningCount, decksRemaining, trueCount, pushBurst, pushToast, doShake]);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // The chart modal owns Escape while it is open.
      if (showChart) {
        if (k === "c") { e.preventDefault(); setShowChart(false); sfx.click(); }
        return;
      }
      if (k === "c") {
        e.preventDefault();
        setShowChart(true);
        sfx.click();
        return;
      }
      if (phase === "menu") {
        if (k === "enter" || k === " ") { e.preventDefault(); startGame(); }
        return;
      }
      if (phase === "gameover") {
        if (k === " " || k === "enter") { e.preventDefault(); startGame(); }
        return;
      }
      // Note: only Escape pauses — "P" is reserved for Split.
      if (k === "escape") {
        e.preventDefault();
        setPhase((p) => (p === "playing" ? "paused" : p === "paused" ? "playing" : p));
        sfx.click();
        return;
      }
      if (phase === "paused") return;
      if (sub === "decision") {
        if (k === "h") handleAction("H");
        else if (k === "s") handleAction("S");
        else if (k === "d") handleAction("D");
        else if (k === "p") handleAction("P");
        else if (k === "?" || k === "/") setShowHint((v) => !v);
      } else if (sub === "feedback") {
        if (k === " " || k === "enter") { e.preventDefault(); advance(); }
      } else if (sub === "countPrompt") {
        if (k === "arrowup" || k === "+" || k === "=") { setUserCount((c) => c + 1); sfx.hint(); }
        else if (k === "arrowdown" || k === "-") { setUserCount((c) => c - 1); sfx.hint(); }
        else if (k === " " || k === "enter") { e.preventDefault(); advance(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, sub, handleAction, advance, startGame, showChart]);

  const playerHV = useMemo(() => evaluateHand(player), [player]);
  const dealerUpHV = useMemo(() => (dealer[0] ? evaluateHand([dealer[0]]) : { total: 0, soft: false }), [dealer]);
  const dealerFullHV = useMemo(() => evaluateHand(visibleDealer), [visibleDealer]);

  const canDouble = player.length === 2;
  const canSplit = isPair(player);

  const rightAction: Action | null = useMemo(() => {
    if (phase !== "playing" || sub !== "decision" || player.length < 2 || !dealer[0]) return null;
    return correctAction(player, dealer[0], { canDouble, canSplit });
  }, [phase, sub, player, dealer, canDouble, canSplit]);

  // Highlight the live hand on the strategy card (only when strategy is being trained).
  const liveChartCell = useMemo(() => {
    if (mode === "count") return null;
    if (phase !== "playing" || sub !== "decision" || player.length < 2 || !dealer[0]) return null;
    return chartLocation(player, dealer[0], canSplit);
  }, [mode, phase, sub, player, dealer, canSplit]);

  const countOnly = mode === "count";

  return (
    <div className="fixed inset-0 felt bg-shift overflow-hidden">
      {/* Board wrapper for shake */}
      <div ref={boardRef} className={cn("absolute inset-0 flex flex-col", shakeClass)}>
        {/* Top HUD */}
        <div className="flex items-center justify-between px-3 sm:px-6 pt-3 sm:pt-4 gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <HudBox label="SCORE" value={score.toLocaleString()} accent="amber" />
            <HudBox
              label="COMBO"
              value={combo > 0 ? `×${combo}` : "—"}
              accent={combo > 0 ? "amber" : "neutral"}
              flashKey={comboFlashKey}
            />
            <div className="hidden sm:flex items-center gap-1.5 bg-black/40 rounded-xl px-3 py-2 border border-white/10">
              <span className="text-amber-300 text-sm">{MODE_META[mode].icon}</span>
              <span className="text-[10px] font-black tracking-[0.15em] text-neutral-300">
                {MODE_META[mode].short}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Lives count={lives} />
            <button
              onClick={() => { setMuted(!muted); setMutedState(!muted); }}
              className="btn-juice w-9 h-9 rounded-lg bg-white/10 border border-white/20 text-white flex items-center justify-center"
              title="Mute"
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button
              onClick={() => { setShowChart(true); sfx.click(); }}
              className="btn-juice relative w-9 h-9 rounded-lg bg-white/10 border border-white/20 text-white flex items-center justify-center"
              title={range.size > 0
                ? `Basic strategy card (C) · practicing ${range.size} spot${range.size === 1 ? "" : "s"}`
                : "Basic strategy card (C)"}
            >
              📋
              {range.size > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-black/60" />
              )}
            </button>
            <button
              onClick={() => setShowHighScores(true)}
              className="btn-juice w-9 h-9 rounded-lg bg-white/10 border border-white/20 text-white flex items-center justify-center"
              title="High scores"
            >
              🏆
            </button>
            <button
              onClick={() => { if (phase === "playing") { setPhase("paused"); sfx.click(); } else if (phase === "paused") { setPhase("playing"); sfx.click(); } }}
              className="btn-juice w-9 h-9 rounded-lg bg-white/10 border border-white/20 text-white flex items-center justify-center"
              title="Pause"
            >
              {phase === "paused" ? "▶" : "⏸"}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 flex flex-col items-center justify-between py-3 sm:py-6 px-3">
          {/* Dealer */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs uppercase tracking-[0.3em] text-amber-200/70">Dealer {visibleDealer.length > 1 ? `· ${dealerFullHV.total}` : `· ${dealerUpHV.total}`}</div>
            <div className="flex gap-1 sm:gap-2">
              {dealer.map((c, i) => {
                const showFront = i === 0 || visibleDealer.length > 1;
                return (
                  <PlayingCard
                    key={`${c.id}-${showFront ? "f" : "b"}`}
                    card={c}
                    hidden={!showFront}
                    animate
                    delayMs={i === 0 ? 0 : 200}
                    size="md"
                  />
                );
              })}
            </div>
          </div>

          {/* Middle: feedback zone. The running count is deliberately never
              displayed — tracking it is the player's job. */}
          <div className="flex flex-col items-center gap-2 my-3">
            {feedback && (sub === "feedback" || sub === "countPrompt") && (
              <div
                className={cn(
                  "pop-in mt-1 px-4 py-2 rounded-xl text-sm sm:text-base font-bold shadow-lg max-w-md text-center",
                  feedback.ok
                    ? "bg-emerald-500/20 border border-emerald-400/40 text-emerald-200"
                    : "bg-red-500/20 border border-red-400/40 text-red-200"
                )}
              >
                {feedback.msg}
                {sub === "feedback" && (
                  <div className="text-xs font-normal opacity-80 mt-1">Press Space to continue</div>
                )}
              </div>
            )}
            {countOnly && sub === "feedback" && (
              <div className="pop-in px-4 py-2 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-200 text-sm font-bold text-center">
                Keep the running count…
                <div className="text-xs font-normal opacity-80 mt-0.5">Space to deal the next cards</div>
              </div>
            )}
            {showHint && rightAction && (
              <div className="pop-in text-xs text-amber-200 bg-black/40 border border-amber-400/30 px-3 py-1 rounded-lg">
                💡 Hint: {ACTION_LABEL[rightAction]}
              </div>
            )}
          </div>

          {/* Player */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1 sm:gap-2">
              {player.map((c, i) => (
                <PlayingCard
                  key={c.id}
                  card={c}
                  animate
                  delayMs={i === 0 ? 100 : 300}
                  size="md"
                  highlight={sub === "decision"}
                />
              ))}
            </div>
            <div className="text-xs uppercase tracking-[0.3em] text-amber-200/70">
              {countOnly ? (
                <>Table · {player.length + dealer.length} cards out</>
              ) : (
                <>
                  You · {playerHV.total}{playerHV.soft && ` (soft)`}
                  {canSplit && " · pair"}
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="w-full max-w-2xl mt-3">
            {sub === "countPrompt" ? (
              <CountPrompt
                value={userCount}
                decksRemaining={decksRemaining}
                onDelta={(d) => { setUserCount((c) => c + d); sfx.hint(); }}
                onSubmit={advance}
              />
            ) : (
              <ActionBar
                onAction={handleAction}
                onHint={() => { setShowHint((v) => !v); sfx.click(); }}
                onAdvance={advance}
                canDouble={canDouble}
                canSplit={canSplit}
                phase={sub}
                countOnly={countOnly}
              />
            )}
          </div>
        </div>

        {/* Bottom subtle stats */}
        <div className="px-4 pb-2 flex items-center justify-between text-[10px] sm:text-xs text-neutral-400">
          <div className="sm:hidden">{MODE_META[mode].icon} <span className="text-neutral-200">{MODE_META[mode].short}</span></div>
          <div>{countOnly ? "Checks" : "Hands"}: <span className="text-neutral-200">{hands}</span></div>
          <div>Acc: <span className="text-neutral-200">{hands > 0 ? Math.round((correctCount / hands) * 100) : 0}%</span></div>
          <div>Shoe: <span className="text-neutral-200">{decksRemaining.toFixed(1)}d</span></div>
        </div>
      </div>

      {/* Toasts overlay */}
      {toasts.map((t) => (
        <div
          key={t.id}
          className="fixed z-50 pointer-events-none rise font-black text-2xl sm:text-3xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
          style={{ left: t.x, top: t.y, color: t.color, transform: "translate(-50%, -50%)" }}
        >
          {t.text}
        </div>
      ))}

      {/* Particles */}
      <ParticleLayer bursts={bursts} />

      {/* Screens */}
      {phase === "menu" && (
        <StartScreen
          onStart={startGame}
          best={bestOverall}
          mode={mode}
          onModeChange={changeMode}
          onOpenChart={() => { setShowChart(true); sfx.click(); }}
          onOpenScores={() => { setShowHighScores(true); sfx.click(); }}
        />
      )}
      {phase === "paused" && (
        <PauseScreen
          onResume={() => { setPhase("playing"); sfx.click(); }}
          onQuit={() => { setPhase("menu"); sfx.click(); }}
          mode={mode}
          onModeChange={changeMode}
          onOpenChart={() => { setShowChart(true); sfx.click(); }}
        />
      )}
      {phase === "gameover" && (
        <GameOverScreen
          score={score}
          hands={hands}
          correct={correctCount}
          bestStreak={bestCombo}
          onRestart={startGame}
          onMenu={() => setPhase("menu")}
          newHigh={newHigh}
          mode={mode}
          name={name}
          setName={setName}
          onSave={() => {
            saveName(name);
            const entry: HighScore = {
              name: name || "Anon",
              score,
              accuracy: hands > 0 ? Math.round((correctCount / hands) * 100) : 0,
              streak: bestCombo,
              hands,
              date: Date.now(),
              mode,
            };
            saveHighScore(entry);
            setBestOverall((b) => Math.max(b, score));
            setNewHigh(false);
          }}
        />
      )}

      <HighScoreTable open={showHighScores} onClose={() => setShowHighScores(false)} />

      <StrategyChart
        open={showChart}
        onClose={() => { setShowChart(false); sfx.click(); }}
        highlight={liveChartCell}
        range={range}
        onRangeChange={setRange}
      />
    </div>
  );
}

/* ================= sub-components ================= */

function HudBox({ label, value, accent = "neutral", flashKey }: {
  label: string; value: string; accent?: "amber" | "neutral"; flashKey?: number;
}) {
  return (
    <div className="bg-black/40 backdrop-blur rounded-xl px-3 py-1.5 border border-white/10">
      <div className="text-[9px] uppercase tracking-[0.2em] text-neutral-400">{label}</div>
      <div
        key={flashKey}
        className={cn(
          "font-black text-lg sm:text-xl leading-tight",
          accent === "amber" ? "text-amber-300" : "text-white",
          flashKey !== undefined && flashKey > 0 && "combo-flash"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Lives({ count }: { count: number }) {
  return (
    <div className="flex gap-1 items-center bg-black/40 rounded-lg px-2 py-1.5 border border-white/10">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={cn(
          "w-4 h-4 rounded-full transition-all",
          i < count ? "chip" : "bg-neutral-800 border border-neutral-700"
        )} />
      ))}
    </div>
  );
}

function ActionBar({ onAction, onHint, onAdvance, canDouble, canSplit, phase, countOnly }: {
  onAction: (a: Action) => void;
  onHint: () => void;
  onAdvance: () => void;
  canDouble: boolean;
  canSplit: boolean;
  phase: SubPhase;
  countOnly?: boolean;
}) {
  const disabled = phase !== "decision";
  // Counting-only mode has no strategy decision — just a deal button.
  if (countOnly) {
    return (
      <button
        onClick={onAdvance}
        disabled={phase !== "feedback"}
        className="btn-juice w-full py-4 rounded-2xl bg-gradient-to-b from-blue-400 to-blue-600 text-white font-black text-lg shadow-lg shadow-blue-500/30 disabled:opacity-40"
      >
        DEAL NEXT (Space)
      </button>
    );
  }
  return (
    <div className="w-full flex flex-col gap-2">
      {phase === "feedback" ? (
        <button
          onClick={onAdvance}
          className="btn-juice w-full py-4 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 text-black font-black text-lg shadow-lg shadow-amber-500/30"
        >
          NEXT HAND (Space)
        </button>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            <ActionBtn label="Hit" hint="H" color={ACTION_COLOR.H} onClick={() => onAction("H")} disabled={disabled} />
            <ActionBtn label="Stand" hint="S" color={ACTION_COLOR.S} onClick={() => onAction("S")} disabled={disabled} />
            <ActionBtn label="Double" hint="D" color={ACTION_COLOR.D} onClick={() => onAction("D")} disabled={disabled || !canDouble} />
            <ActionBtn label="Split" hint="P" color={ACTION_COLOR.P} onClick={() => onAction("P")} disabled={disabled || !canSplit} />
          </div>
          <button
            onClick={onHint}
            disabled={disabled}
            className="btn-juice text-xs w-full py-2 rounded-lg bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10 disabled:opacity-40"
          >
            💡 Show hint (?)
          </button>
        </>
      )}
    </div>
  );
}

function ActionBtn({ label, hint, color, onClick, disabled }: {
  label: string; hint: string; color: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "btn-juice relative py-3 sm:py-4 rounded-xl font-black text-white text-sm sm:text-lg shadow-lg",
        "border border-white/20 backdrop-blur",
        disabled ? "opacity-30 cursor-not-allowed" : "hover:brightness-110"
      )}
      style={{
        background: disabled ? "#1a1a1a" : `linear-gradient(to bottom, ${color}, ${shade(color, -0.25)})`,
        boxShadow: disabled ? undefined : `0 4px 14px ${color}55`,
      }}
    >
      <div className="leading-tight">{label}</div>
      <div className="text-[10px] font-mono opacity-70 mt-0.5">[{hint}]</div>
    </button>
  );
}

function shade(hex: string, amt: number) {
  const c = hex.replace("#", "");
  const num = parseInt(c, 16);
  let r = (num >> 16) + Math.round(255 * amt);
  let g = ((num >> 8) & 0xff) + Math.round(255 * amt);
  let b = (num & 0xff) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function CountPrompt({ value, decksRemaining, onDelta, onSubmit }: {
  value: number; decksRemaining: number; onDelta: (d: number) => void; onSubmit: () => void;
}) {
  return (
    <div className="w-full flex flex-col gap-2 items-center pop-in">
      <div className="text-amber-300 text-xs sm:text-sm tracking-[0.3em] uppercase font-bold">Count Check</div>
      <div className="text-neutral-300 text-xs sm:text-sm text-center">
        What is the current running Hi-Lo count?
      </div>
      <div className="text-[10px] text-neutral-500">
        Discard tray: ≈{decksRemaining.toFixed(1)} decks remain
      </div>
      <div className="flex items-center gap-3 my-1">
        <button
          onClick={() => onDelta(-1)}
          className="btn-juice w-14 h-14 rounded-2xl bg-red-500/80 text-white text-3xl font-black shadow-lg"
        >
          −
        </button>
        <div className="w-24 h-16 rounded-2xl bg-black/60 border-2 border-amber-400/60 flex items-center justify-center">
          <div className={cn(
            "text-4xl font-black",
            value > 0 ? "text-emerald-300" : value < 0 ? "text-red-300" : "text-amber-200"
          )}>
            {value > 0 ? `+${value}` : value}
          </div>
        </div>
        <button
          onClick={() => onDelta(1)}
          className="btn-juice w-14 h-14 rounded-2xl bg-emerald-500/80 text-white text-3xl font-black shadow-lg"
        >
          +
        </button>
      </div>
      <button
        onClick={onSubmit}
        className="btn-juice mt-1 px-8 py-3 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-black font-black shadow-lg shadow-amber-500/30"
      >
        LOCK IN (Space)
      </button>
      <div className="text-[10px] text-neutral-500">Tags: 2–6 = +1 · 7–9 = 0 · 10/J/Q/K/A = −1</div>
    </div>
  );
}
