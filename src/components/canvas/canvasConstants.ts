/**
 * Viewport padding for Fit-to-View, Pathfinder, and Tree Traversals.
 * Strictly respects the 64px fixed header as a top boundary with breathing room,
 * plus generous 60px padding on all other sides so person tiles are never
 * stuck under the header or at the edge of the screen.
 */
export const HEADER_AWARE_FIT_PADDING = {
  top: 120, // 64px header height + 56px breathing buffer below header bottom
  bottom: 60, // 60px padding from screen bottom
  left: 60, // 60px padding from screen left edge
  right: 60, // 60px padding from screen right edge
};

export const CANVAS_VIEWPORT_STORAGE_KEY = 'family_tree_canvas_viewport';

