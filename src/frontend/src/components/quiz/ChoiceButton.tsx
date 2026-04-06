import { memo, useCallback, type ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import { sanitizeMediaUrl } from "../../utils/sanitizeUrl";

type ChoiceColor = "red" | "blue" | "green" | "yellow";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  choice: string;
  color: ChoiceColor;
  isSelected?: boolean;
  choiceIndex: number;
  choiceImageUrl?: string | null;
  onClick: (choiceIndex: number) => void;
};

const colorStyles: Record<ChoiceColor, string> = {
  red: "bg-choice-pastel-rose",
  blue: "bg-choice-pastel-sky",
  green: "bg-choice-pastel-mint",
  yellow: "bg-choice-pastel-amber",
};

export const ChoiceButton = memo(function ChoiceButton({ choice, color, isSelected = false, disabled, choiceIndex, choiceImageUrl, onClick, ...props }: Props) {
  const handleClick = useCallback(() => {
    onClick(choiceIndex);
  }, [onClick, choiceIndex]);

  const safeImageUrl = sanitizeMediaUrl(choiceImageUrl);

  return (
    <button
      type="button"
      className={cn(
        "rounded-xl text-gray-900 font-bold flex items-center justify-center p-3 min-h-[44px]",
        "motion-safe:transition-[opacity,transform,box-shadow] motion-safe:duration-200",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-900/50",
        "disabled:cursor-not-allowed",
        colorStyles[color],
        isSelected && "ring-4 ring-gray-900",
        disabled && !isSelected && "opacity-60"
      )}
      disabled={disabled}
      aria-pressed={isSelected}
      onClick={handleClick}
      {...props}
    >
      {safeImageUrl ? (
        <div className="flex flex-col items-center gap-1.5 w-full h-full">
          <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden rounded-lg">
            <img
              src={safeImageUrl}
              alt={choice || `選択肢${choiceIndex}`}
              width={120}
              height={120}
              className="max-w-full max-h-full object-cover rounded-lg"
            />
          </div>
          {choice && <span className="text-sm font-bold truncate max-w-full">{choice}</span>}
        </div>
      ) : (
        <span className="text-lg">{choice}</span>
      )}
    </button>
  );
});
