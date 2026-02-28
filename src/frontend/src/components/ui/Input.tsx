import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  helperText?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={inputId} className="text-base font-medium text-white">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "px-6 py-4 rounded-2xl border-2 text-center font-bold text-lg transition-[border-color,box-shadow] duration-200",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30",
            error
              ? "border-red-500 bg-red-50"
              : "border-white bg-white focus-visible:border-primary",
            className
          )}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={cn(errorId, helperId)}
          {...props}
        />
        {helperText && !error && (
          <p id={helperId} className="text-sm text-white/70">
            {helperText}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-sm text-red-300 font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
