import { memo, useCallback, type ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type ChoiceColor = "red" | "blue" | "green" | "yellow";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  choice: string;
  color: ChoiceColor;
  icon: string;
  isSelected?: boolean;
  choiceIndex: number;
  onClick: (choiceIndex: number) => void;
};

const colorStyles: Record<ChoiceColor, string> = {
  red: "bg-choice-red",
  blue: "bg-choice-blue",
  green: "bg-choice-green",
  yellow: "bg-choice-yellow",
};

export const ChoiceButton = memo(function ChoiceButton({ choice, color, icon, isSelected = false, disabled, choiceIndex, onClick, ...props }: Props) {
  const handleClick = useCallback(() => {
    onClick(choiceIndex);
  }, [onClick, choiceIndex]);

  return (
    <button
      className={cn(
        "rounded-xl text-white font-bold flex flex-col items-center justify-center gap-2 p-3",
        "transition-[opacity,transform,box-shadow] duration-200",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50",
        "disabled:cursor-not-allowed",
        colorStyles[color],
        isSelected && "scale-95 ring-4 ring-white",
        disabled && !isSelected && "opacity-40"
      )}
      disabled={disabled}
      aria-pressed={isSelected}
      onClick={handleClick}
      {...props}
    >
      <span className="text-4xl" aria-hidden="true">
        {icon}
      </span>
      <span className="text-base">{choice}</span>
    </button>
  );
});
