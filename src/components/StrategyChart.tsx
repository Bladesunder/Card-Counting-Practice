import { useEffect, useRef, useState } from "react";
import {
  Action,
  ACTION_COLOR,
  ACTION_LABEL,
  ChartLocation,
  DEALER_COLS,
  hardChart,
  pairChart,
  softChart,
} from "../game/strategy";
import { countByTable, keyOf, RangeKey } from "../game/practiceRange";
import { cn } from "../utils/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional live hand position to highlight on the card */
  highlight?: ChartLocation | null;
  /** Selected practice spots; empty set means every hand is fair game */
  range: Set<RangeKey>;
  onRangeChange: (next: Set<RangeKey>) => void;
}

type Tab = "hard" | "soft" | "pair";

const TAB_LABEL: Record<Tab, string> = {
  hard: "Hard totals",
  soft: "Soft totals",
  pair: "Pairs",
};

const HARD_ROWS = [21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5];
const SOFT_ROWS = [20, 19, 18, 17, 16, 15, 14, 13];
const PAIR_ROWS = ["A", "10", "9", "8", "7", "6", "5", "4", "3", "2"];

const TAB_ROWS: Record<Tab, (string | number)[]> = {
  hard: HARD_ROWS,
  soft: SOFT_ROWS,
  pair: PAIR_ROWS,
};

function softLabel(total: number) {
  return `A,${total - 11}`;
}
function pairLabel(k: string) {
  return k === "10" ? "10,10" : `${k},${k}`;
}

interface DragRect {
  anchor: { r: number; c: number };
  cur: { r: number; c: number };
}

export function StrategyChart({ open, onClose, highlight, range, onRangeChange }: Props) {
  const [tab, setTab] = useState<Tab>("hard");
  const [drag, setDrag] = useState<DragRect | null>(null);
  // The commit listener lives on window and reads the drag through a ref —
  // registering it at drag time would race a fast pointerup.
  const dragRef = useRef<DragRect | null>(null);
  const updateDrag = (d: DragRect | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  // Jump to the tab containing the live hand when opened
  useEffect(() => {
    if (open && highlight) setTab(highlight.table);
  }, [open, highlight]);

  useEffect(() => {
    if (!open) updateDrag(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  // Commit the in-progress drag selection on pointer release, wherever it lands.
  useEffect(() => {
    if (!open) return;
    const commit = () => {
      const d = dragRef.current;
      if (!d) return;
      updateDrag(null);
      const rows = TAB_ROWS[tab];
      const r0 = Math.min(d.anchor.r, d.cur.r);
      const r1 = Math.max(d.anchor.r, d.cur.r);
      const c0 = Math.min(d.anchor.c, d.cur.c);
      const c1 = Math.max(d.anchor.c, d.cur.c);
      const next = new Set(range);
      if (r0 === r1 && c0 === c1) {
        // A plain click toggles the cell for fine-tuning.
        const k = keyOf(tab, String(rows[r0]), c0);
        if (next.has(k)) next.delete(k);
        else next.add(k);
      } else {
        // A drag replaces this tab's rectangle; other tabs keep their selection.
        const prefix = `${tab}:`;
        for (const k of [...next]) if (k.startsWith(prefix)) next.delete(k);
        for (let r = r0; r <= r1; r++) {
          for (let c = c0; c <= c1; c++) next.add(keyOf(tab, String(rows[r]), c));
        }
      }
      onRangeChange(next);
    };
    window.addEventListener("pointerup", commit);
    window.addEventListener("pointercancel", commit);
    return () => {
      window.removeEventListener("pointerup", commit);
      window.removeEventListener("pointercancel", commit);
    };
  }, [open, range, tab, onRangeChange]);

  if (!open) return null;

  const rows = TAB_ROWS[tab];
  const counts = countByTable(range);
  const rangeActive = range.size > 0;
  const dragBounds = drag && {
    r0: Math.min(drag.anchor.r, drag.cur.r),
    r1: Math.max(drag.anchor.r, drag.cur.r),
    c0: Math.min(drag.anchor.c, drag.cur.c),
    c1: Math.max(drag.anchor.c, drag.cur.c),
  };

  const getAction = (row: string | number, col: number): Action => {
    if (tab === "hard") return hardChart[row as number][col];
    if (tab === "soft") return softChart[row as number][col];
    return pairChart[row as string][col];
  };

  const rowLabel = (row: string | number) =>
    tab === "hard" ? String(row) : tab === "soft" ? softLabel(row as number) : pairLabel(row as string);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="pop-in bg-neutral-900 border border-amber-400/30 rounded-2xl w-full max-w-lg max-h-[92dvh] flex flex-col shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-amber-300 leading-tight">
              Basic Strategy Card
            </h3>
            <p className="text-[10px] text-neutral-500">
              6 decks · dealer stands soft 17 · double after split allowed
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-juice w-9 h-9 rounded-lg bg-white/10 border border-white/20 text-neutral-300 hover:text-white text-lg shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 flex gap-1.5">
          {(["hard", "soft", "pair"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "btn-juice flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold border transition-colors",
                tab === t
                  ? "bg-amber-400 text-black border-amber-300"
                  : "bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10"
              )}
            >
              {TAB_LABEL[t]}
              {counts[t] > 0 && <span className="ml-1 text-[9px] opacity-70">({counts[t]})</span>}
              {highlight?.table === t && (
                <span className="ml-1 text-[9px] align-super">●</span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="px-4 py-3 overflow-auto no-scrollbar flex-1">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 text-center">
            Dealer up card
          </div>
          <table className="w-full border-separate border-spacing-[2px] touch-none select-none">
            <thead>
              <tr>
                <th className="w-10" />
                {DEALER_COLS.map((c) => (
                  <th
                    key={c}
                    className={cn(
                      "text-[10px] sm:text-xs font-black text-neutral-300 pb-0.5",
                      highlight && DEALER_COLS[highlight.colIdx] === c && highlight.table === tab
                        ? "text-amber-300"
                        : ""
                    )}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const isHiRow = highlight?.table === tab && highlight.rowKey === String(row);
                return (
                  <tr key={String(row)}>
                    <td
                      className={cn(
                        "text-[10px] sm:text-xs font-black text-right pr-1.5 whitespace-nowrap",
                        isHiRow ? "text-amber-300" : "text-neutral-400"
                      )}
                    >
                      {rowLabel(row)}
                    </td>
                    {DEALER_COLS.map((_, ci) => {
                      const a = getAction(row, ci);
                      const isCell = isHiRow && highlight?.colIdx === ci;
                      const selected = range.has(keyOf(tab, String(row), ci));
                      const inPreview =
                        !!dragBounds &&
                        ri >= dragBounds.r0 &&
                        ri <= dragBounds.r1 &&
                        ci >= dragBounds.c0 &&
                        ci <= dragBounds.c1;
                      return (
                        <td key={ci} className="p-0">
                          <div
                            className={cn(
                              "h-6 sm:h-7 rounded-[4px] flex items-center justify-center text-[10px] sm:text-xs font-black text-white/95 transition-all cursor-pointer",
                              rangeActive && !selected && "opacity-40",
                              selected && "ring-2 ring-amber-300",
                              inPreview &&
                                "scale-110 brightness-125 z-10 relative outline-2 outline-dashed outline-amber-200",
                              isCell && "ring-2 ring-white scale-110 z-10 relative shadow-lg"
                            )}
                            style={{
                              background: ACTION_COLOR[a],
                              boxShadow: isCell
                                ? `0 0 16px ${ACTION_COLOR[a]}`
                                : selected
                                ? "0 0 10px rgba(252,211,77,0.55)"
                                : undefined,
                            }}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              // Release implicit touch capture so pointerenter
                              // fires on the cells the finger drags across.
                              if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                                e.currentTarget.releasePointerCapture(e.pointerId);
                              }
                              updateDrag({ anchor: { r: ri, c: ci }, cur: { r: ri, c: ci } });
                            }}
                            onPointerEnter={() => {
                              if (dragRef.current) {
                                updateDrag({ ...dragRef.current, cur: { r: ri, c: ci } });
                              }
                            }}
                          >
                            {a}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Practice range controls */}
        <div className="px-4 pb-2 flex items-center justify-between gap-2 min-h-[26px]">
          {rangeActive ? (
            <>
              <span className="text-[10px] font-bold text-amber-200/90">
                Practicing {range.size} spot{range.size === 1 ? "" : "s"} · {counts.hard} hard ·{" "}
                {counts.soft} soft · {counts.pair} pair
              </span>
              <button
                onClick={() => onRangeChange(new Set())}
                className="btn-juice shrink-0 px-2.5 py-1 rounded-lg bg-amber-400/15 border border-amber-300/40 text-amber-200 text-[10px] font-black hover:bg-amber-400/25"
              >
                Clear range
              </button>
            </>
          ) : (
            <span className="text-[10px] text-neutral-500 text-center w-full">
              Drag on the card to practice a range · click cells to fine-tune
            </span>
          )}
        </div>

        {/* Legend */}
        <div className="px-4 pb-4 pt-1 border-t border-white/10">
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {(Object.keys(ACTION_LABEL) as Action[]).map((a) => (
              <div key={a} className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded-[3px] flex items-center justify-center text-[9px] font-black text-white"
                  style={{ background: ACTION_COLOR[a] }}
                >
                  {a}
                </div>
                <span className="text-[10px] text-neutral-300">{ACTION_LABEL[a]}</span>
              </div>
            ))}
          </div>
          {highlight && (
            <div className="mt-2 text-center text-[10px] text-amber-300/80">
              ● Your current hand is highlighted
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
