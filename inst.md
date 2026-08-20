Build a modern, highly responsive, and professional Web-Based Whiteboard Application using React, TypeScript, Tailwind CSS, and HTML5 Canvas (or SVG/Fabric.js/Tldraw engine logic). The UI should be crisp, minimalist, and feature-rich, similar to Miro, Excalidraw, or Apple Freeform.

### 1. Core Architecture & Theme Capabilities
- Theme Switching: Seamless toggle between Light Mode and Dark Mode. The background, grids, toolbar UI, and default element stroke/fill colors must adapt dynamically to the selected theme.
- Dynamic Canvas Grid: Endless canvas pan (drag to move) and zoom (mouse wheel / pinch gestures) with a subtle dot or grid pattern background.

### 2. Annotation & Drawing Tools
- Freehand Drawing: Pen, Highlighter (semi-transparent), and Eraser tools with smooth stroke rendering.
- Customizable Attributes:
  - Adjustable stroke thickness / size slider.
  - Color picker (presets + custom hex code).
  - Opacity slider.
  - Stroke styles (Solid, Dashed, Dotted).

### 3. Vector Shapes & Diagrams
- Built-in Shapes: Rectangle, Circle/Ellipse, Triangle, Straight Line, Arrow (single & double-headed), Diamond, and Star.
- Shape Customization: Fill color, border color, border style, and corner radius settings.

### 4. Text & Typography Tools
- Rich Text Insertion: Double-click or select Text Tool to place text anywhere on the canvas.
- Formatting Options: Font size, font family (Sans-serif, Serif, Monospace,algerian,times new roman,georgia, Handdrawn), bold, italic, alignment, and color.
### page colour and graphics
there must be a colour wheel and also some inbuilt gradient graphics for the bg
### 5. Media & Document Import
- Image Import: Support drag-and-drop or file picker for PNG, JPG, WebP, and SVG images with resize and rotate handles.
- PDF Import: Import multi-page PDF documents, rendering pages as scalable images or canvas elements that can be annotated directly on top.

### 6. Canvas Interaction & Element Management
- Tooling Modes: Select/Move Tool vs. Draw Tool.
- Selection Engine: Click to select single element, multi-select via marquee box or Shift+Click.
- Transforming Elements: Drag bounding-box handles to scale, stretch, or rotate elements.
- Clipboard Operations: Full support for Copy, Cut, Paste, and Duplicate (keyboard shortcuts Ctrl/Cmd+C, Ctrl/Cmd+X, Ctrl/Cmd+V, Ctrl/Cmd+D).
- Ordering & Layering: Bring to Front, Send to Back, Bring Forward, Send Backward options in the context menu.
- History Engine: Unlimited Undo / Redo stack with keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Y / Shift+Z).

### 7. Export & Persistence
- Local Storage / Auto-Save: Automatically preserve canvas state locally so work isn't lost on refresh.
- Export Options:
  - Export as high-resolution PNG / JPEG (with option for transparent or colored background).
  - Export as SVG vector file.
  - Export/Import canvas raw data as JSON project files.

### 8. UI / UX Design Specifications
- Floating Toolbar: Modern floating bottom or side navigation bar for primary tools with clean icon-based buttons (Lucide / Heroicons).
- Contextual Property Bar: A contextual floating panel that appears near selected elements to quickly tweak color, stroke width, opacity, or layers.
- Keyboard Shortcuts Modal: Quick visual cheatsheet for key bindings (e.g., Spacebar + Drag to pan, V for Select, P for Pen, R for Rectangle, T for Text).