/**
 * Shared form styles for all info-input wizards (source: info wizard.txt).
 */

export const wizardLabelClass =
  "block text-sm font-bold text-[color:var(--wp-text-secondary)] mb-2";

export const wizardInputClass =
  "w-full px-4 py-3.5 bg-[color:var(--wp-input-bg)] border border-[color:var(--wp-input-border)] rounded-xl text-sm font-medium outline-none focus:ring-4 focus:ring-[color:var(--wp-header-input-focus-ring)] focus:border-[color:var(--wp-header-input-focus-border)] transition-all text-[color:var(--wp-input-text)] placeholder:text-[color:var(--wp-text-tertiary)]";

export const wizardInputWithIconClass = `${wizardInputClass} pl-11`;

export const WIZARD_SLIDE_CSS = `
.wizard-slide-enter { animation: wizardSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
@keyframes wizardSlideIn {
  0% { opacity: 0; transform: translateX(20px); }
  100% { opacity: 1; transform: translateX(0); }
}
`;
