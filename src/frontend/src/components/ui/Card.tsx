import { type ReactNode } from "react";
import { cn } from "../../utils/cn";

type Props = {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
};

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({ children, className, padding = "md" }: Props) {
  return (
    <div
      className={cn(
        "bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20",
        paddingStyles[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
