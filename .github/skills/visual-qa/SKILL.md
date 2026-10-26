---
name: visual-qa
description: Verify frontend layouts and interactions across desktop and mobile viewports using focused visual and behavior checks.
---

# Visual QA

Use this skill after frontend changes that affect layout, styling, responsiveness, or interaction.

## Workflow

1. Identify the changed page, primary workflow, and states affected by the change.
2. Run the narrowest available build, typecheck, lint, or test before visual inspection.
3. Check at least one narrow mobile viewport and one desktop viewport.
4. Inspect for horizontal overflow, clipped text, overlapping controls, unstable grid dimensions, and inaccessible focus states.
5. Test the changed interaction with mouse and touch-oriented input where applicable.
6. Check loading, empty, error, disabled, and completed states when the feature uses them.
7. Confirm that fixed-position elements, drag previews, menus, dialogs, and tooltips stay within the viewport.
8. Re-run the focused executable validation after any repair.

## Interaction Checklist

- Buttons and inputs remain usable at narrow widths.
- Touch gestures do not unexpectedly trigger text selection or page scrolling.
- Drag interactions have a clear active state and a reliable cancel/end path.
- Keyboard focus is visible and follows a logical order.
- Dynamic content does not shift neighboring controls unexpectedly.

## Reporting

Report concrete findings first, including the affected viewport or state. Distinguish verified behavior from behavior not tested in a real browser. Keep the final summary concise.
