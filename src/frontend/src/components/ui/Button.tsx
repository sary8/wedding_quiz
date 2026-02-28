import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type ButtonVariant = "primary" | "secondary" | "accent" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-gradient-to-r from-primary to-primary-dark text-white hover:opacity-90 disabled:opacity-40",
  secondary: "bg-white/20 text-white hover:bg-white/30 disabled:opacity-40",
  accent: "bg-accent text-dark hover:opacity-90 disabled:opacity-40",
  ghost: "bg-transparent text-white hover:bg-white/10 disabled:opacity-40",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm rounded-lg min-h-[44px]",
  md: "px-6 py-3 text-base rounded-xl min-h-[44px]",
  lg: "px-12 py-4 text-xl rounded-2xl min-h-[44px]",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "md", fullWidth = false, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "font-bold transition-[opacity,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50",
          "disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
