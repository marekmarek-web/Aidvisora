/**
 * Re-export pro všechny sdílené UI primitivy portálu / klientské zóny.
 * Používat místo ad-hoc Tailwind tříd pro jednotný design system.
 */

export { Button, ButtonLink } from "./Button";
export type {
  ButtonProps,
  ButtonLinkProps,
  ButtonVariant,
  ButtonSize,
} from "./Button";

export { Badge, StatusPill } from "./Badge";
export type { BadgeProps, BadgeTone, BadgeSize, BadgeVariant, StatusPillProps } from "./Badge";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps, EmptyStateCta } from "./EmptyState";
