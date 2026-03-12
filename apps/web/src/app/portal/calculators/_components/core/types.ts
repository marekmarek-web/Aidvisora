/**
 * Shared types for calculator UI components.
 */

export interface CalculatorPageShellProps {
  children: React.ReactNode;
  /** Optional max-width class (e.g. max-w-7xl). */
  maxWidth?: string;
  /** Optional section class (e.g. padding). */
  className?: string;
}
