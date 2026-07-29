import { useEffect, useState } from "react";
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
import { cn } from "../utils/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional live hand position to highlight on the card */
  highlight?: ChartLocation | null;
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

function softLabel(total: number) {
  return `A,${total - 11}`;
}
function pairLabel(k: string) {
  return k === "10" ? "10,10" : `${k},${k}`;
}

export function StrategyChart({ open, onClose, highlight }: Props) {
  const [tab, setTab] = useState<Tab>("hard");

  // Jump to the tab containing the live hand when opened
  useEffect(() => {
    if (open && highlight) setTab(highlight.table);
  }, [open, highlight]);

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

  if (!open) return null;

  const rows: (string | number)[] =
    tab === "hard" ? HARD_ROWS : tab === "soft" ? SOFT_ROWS : PAIR_ROWS;

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
          <table className="w-full border-separate border-spacing-[2px]">
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
              {rows.map((row) => {
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
                      return (
                        <td key={ci} className="p-0">
                          <div
                            className={cn(
                              "h-6 sm:h-7 rounded-[4px] flex items-center justify-center text-[10px] sm:text-xs font-black text-white/95 transition-transform",
                              isCell && "ring-2 ring-white scale-110 z-10 relative shadow-lg"
                            )}
                            style={{
                              background: ACTION_COLOR[a],
                              boxShadow: isCell
                                ? `0 0 16px ${ACTION_COLOR[a]}`
                                : undefined,
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
