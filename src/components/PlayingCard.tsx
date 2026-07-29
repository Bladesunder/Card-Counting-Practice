import { Card, suitColor } from "../game/cards";
import { cn } from "../utils/cn";

interface Props {
  card?: Card;
  hidden?: boolean;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  delayMs?: number;
  highlight?: boolean;
}

const SIZE = {
  sm: "w-12 h-16 text-[10px]",
  md: "w-16 h-24 sm:w-20 sm:h-28 text-xs sm:text-sm",
  lg: "w-20 h-28 sm:w-24 sm:h-36 text-sm sm:text-base",
};

export function PlayingCard({ card, hidden, size = "md", animate, delayMs = 0, highlight }: Props) {
  const s = SIZE[size];
  return (
    <div
      className={cn("relative", s, animate && "deal-in")}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className={cn("absolute inset-0 rounded-lg card-3d")}>
        {hidden || !card ? (
          <div className={cn(
            "absolute inset-0 rounded-lg card-back border border-amber-900/60 shadow-lg",
            "ring-1 ring-black/40"
          )}>
            <div className="absolute inset-1 rounded-md border border-amber-100/20 flex items-center justify-center">
              <div className="text-amber-200/70 text-[10px] tracking-widest font-bold rotate-45">HI·LO</div>
            </div>
          </div>
        ) : (
          <div className={cn(
            "absolute inset-0 rounded-lg bg-gradient-to-br from-white to-neutral-100 shadow-lg card-face",
            "border border-neutral-300 flex flex-col justify-between p-1 sm:p-1.5",
            highlight && "ring-2 ring-amber-400 shadow-amber-400/40",
            animate && "flip-in"
          )}>
            <div className={cn("font-bold leading-none", suitColor(card.suit) === "red" ? "suit-red" : "suit-black")}>
              <div>{card.rank}</div>
              <div className="text-[10px] sm:text-xs">{card.suit}</div>
            </div>
            <div className={cn(
              "self-center text-2xl sm:text-3xl md:text-4xl leading-none",
              suitColor(card.suit) === "red" ? "suit-red" : "suit-black"
            )}>
              {card.suit}
            </div>
            <div className={cn(
              "font-bold leading-none self-end rotate-180",
              suitColor(card.suit) === "red" ? "suit-red" : "suit-black"
            )}>
              <div>{card.rank}</div>
              <div className="text-[10px] sm:text-xs">{card.suit}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
