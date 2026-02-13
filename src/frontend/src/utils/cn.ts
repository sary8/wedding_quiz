/**
 * Utility function to conditionally join classNames together
 * Similar to clsx/classnames but without dependencies
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}
