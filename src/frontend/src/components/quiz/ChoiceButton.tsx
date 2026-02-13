import { type ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type ChoiceColor = "red" | "blue" | "green" | "yellow";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  choice: string;
  color: ChoiceColor;
  icon: string;
  isSelected?: boolean;
};

const colorStyles: Record<ChoiceColor, string> = {
  red: "bg-choice-red",
  blue: "bg-choice-blue",
  green: "bg-choice-green",
  yellow: "bg-choice-yellow",
};

export function ChoiceButton({ choice, color, icon, isSelected = false, disabled, ...props }: Props) {
  return (
    <button
      className={cn(
        "rounded-xl text-white font-bold flex flex-col items-center justify-center gap-2 p-3",
        "transition-all duration-200",
        "focus:outline-none focus:ring-4 focus:ring-white/50",
        "disabled:cursor-not-allowed",
        colorStyles[color],
        isSelected && "scale-95 ring-4 ring-white",
        disabled && !isSelected && "opacity-40"
      )}
      disabled={disabled}
      aria-pressed={isSelected}
      {...props}
    >
      <span className="text-4xl" aria-hidden="true">
        {icon}
      </span>
      <span className="text-base">{choice}</span>
    </button>
  );
}
