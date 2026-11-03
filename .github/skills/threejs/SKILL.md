---
name: threejs
description: Build polished, performant, responsive 3D interfaces with Three.js and React Three Fiber.
---

# Three.js Interface Design

Use this skill when adding or improving 3D scenes, camera choreography, interactive objects, or full-page 3D experiences.

## Scene Architecture

1. Keep application state outside the scene and pass serializable data into 3D render components.
2. Separate scene composition, camera control, lighting, materials, object interaction, and UI overlays into focused components.
3. Keep 2D and 3D renderers behaviorally equivalent when they represent the same data.
4. Use lazy loading for heavy 3D dependencies so the non-3D mode keeps a small initial bundle.
5. Prefer instancing, shared geometries, shared materials, and bounded object counts for repeated items.

## Visual Direction

- Establish a clear spatial composition before adding decoration.
- Use a small palette with meaningful material roles and readable contrast.
- Use lighting, depth, fog, shadows, and camera framing to establish hierarchy.
- Keep important controls in an HTML overlay instead of hiding essential actions inside the canvas.
- Make loading, camera intro, empty, error, selected, dragged, and completed states explicit.

## Camera and Motion

- Animate the camera into a stable final framing before enabling orbit controls.
- Use eased interpolation and avoid sudden camera jumps.
- Keep the main subject visible on narrow screens and adapt camera distance to scene bounds.
- Respect `prefers-reduced-motion` by shortening or disabling camera and object animation.
- Stop or reduce animation work when the scene is not visible.

## Interaction

- Support mouse and touch input with clear separation between camera gestures and object dragging.
- Use long press or an explicit grab state before dragging objects on touch devices.
- Prevent page scrolling only while an object drag is active; preserve normal scrolling otherwise.
- Highlight the selected object, valid drop targets, and invalid targets.
- Provide a non-3D fallback for devices that cannot render the scene reliably.

## Validation

- Typecheck and production-build after scene changes.
- Test desktop and narrow mobile viewports.
- Check that the canvas is nonblank, framed, and not clipping the primary subject.
- Verify camera controls, object selection, drag/drop, resize, and mode switching.
- Check canvas pixel output or a screenshot when visual tooling is available.
- Report browser or device behavior that was not directly verified.
