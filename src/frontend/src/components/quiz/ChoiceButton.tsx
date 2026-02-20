import { memo, useCallback, type ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type ChoiceColor = "red" | "blue" | "green" | "yellow";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  choice: string;
  color: ChoiceColor;
  isSelected?: boolean;
  choiceIndex: number;
  onClick: (choiceIndex: number) => void;
};

const colorStyles: Record<ChoiceColor, string> = {
  red: "bg-choice-pastel-rose",
  blue: "bg-choice-pastel-sky",
  green: "bg-choice-pastel-mint",
  yellow: "bg-choice-pastel-amber",
};

export const ChoiceButton = memo(function ChoiceButton({ choice, color, isSelected = false, disabled, choiceIndex, onClick, ...props }: Props) {
  const handleClick = useCallback(() => {
    onClick(choiceIndex);
  }, [onClick, choiceIndex]);

  return (
    <button
      className={cn(
        "rounded-xl text-rose-text font-bold flex items-center justify-center p-3",
        "transition-[opacity,transform,box-shadow] duration-200",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-text/30",
        "disabled:cursor-not-allowed",
        colorStyles[color],
        isSelected && "scale-95 ring-4 ring-rose-text",
        disabled && !isSelected && "opacity-40"
      )}
      disabled={disabled}
      aria-pressed={isSelected}
      onClick={handleClick}
      {...props}
    >
      <span className="text-base">{choice}</span>
    </button>
  );
});
