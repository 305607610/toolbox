---
name: 叮当 (Toolbox)
description: "A quiet Windows desktop tool launcher: the tools are the content and the interface gets out of their way."
colors:
  accent: "#2563EB"
  accent-strong: "#1D4ED8"
  accent-soft: "#EAF1FE"
  accent-dark: "#3B82F6"
  accent-strong-dark: "#60A5FA"
  accent-soft-dark: "rgba(59, 130, 246, 0.14)"
  selected-text-dark: "#93C5FD"
  focus-light: "rgba(37, 99, 235, 0.2)"
  focus-dark: "rgba(59, 130, 246, 0.3)"
  surface-content: "#F6F6F4"
  surface-chrome: "#F0F0ED"
  surface-card: "#FFFFFF"
  surface-content-dark: "#0F1115"
  surface-chrome-dark: "#121419"
  surface-card-dark: "#161A21"
  text-primary: "#1C1D20"
  text-secondary: "#5F646B"
  text-primary-dark: "#F2F4F7"
  text-secondary-dark: "#9AA3B1"
  border: "#E4E4DF"
  border-strong: "#D6D6D0"
  border-dark: "#252A34"
  border-strong-dark: "#333A47"
  state-hover: "#E9E9E5"
  state-hover-dark: "#1C212A"
  close-hover: "#C42B1C"
  scroll-thumb: "#C9C9C3"
  scroll-thumb-dark: "#3A4150"
  seal-ink: "#D40000"
  paper: "#FFFFFF"
  paper-checker: "#FAFAF7"
  seal-warn: "#B42318"
  seal-warn-dark: "#F87171"
  id-photo-blue: "#438EDB"
  id-photo-red: "#D9001B"
typography:
  display:
    fontFamily: '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  section:
    fontSize: "15px"
    fontWeight: 600
  body:
    fontFamily: '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "14px"
    lineHeight: 1.6
  body-compact:
    fontSize: "13px"
    lineHeight: 1.6
  caption:
    fontSize: "12px"
  label:
    fontSize: "11px"
    letterSpacing: "0.02em"
  micro:
    fontSize: "10px"
    lineHeight: 1
  brand:
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.01em"
rounded:
  micro: "4px"
  tag: "5px"
  control: "6px"
  menu: "8px"
  field: "10px"
  icon: "11px"
  card: "12px"
  icon-lg: "14px"
  round: "50%"
spacing:
  "2": "2px"
  "4": "4px"
  "6": "6px"
  "8": "8px"
  "10": "10px"
  "12": "12px"
  "14": "14px"
  "16": "16px"
  "18": "18px"
  "22": "22px"
  "24": "24px"
  "26": "26px"
  "28": "28px"
  "32": "32px"
  "36": "36px"
components:
  titlebar-control:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
    width: "34px"
    height: "30px"
  titlebar-control-hover:
    backgroundColor: "{colors.state-hover}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.control}"
  window-close:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
    width: "34px"
    height: "30px"
  window-close-hover:
    backgroundColor: "{colors.close-hover}"
    textColor: "#FFFFFF"
    rounded: "{rounded.control}"
  search-field:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.field}"
    width: "360px"
    height: "38px"
    padding: "0 12px"
  search-field-focus:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.field}"
  sidebar-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.menu}"
    height: "40px"
    padding: "0 10px"
  sidebar-item-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-strong}"
    rounded: "{rounded.menu}"
    height: "40px"
  tool-card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.card}"
    padding: "22px"
  tool-card-hover:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
  card-icon:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-strong}"
    rounded: "{rounded.icon}"
    width: "44px"
    height: "44px"
  tag:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  back-button:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.field}"
    padding: "0 8px"
    height: "36px"
  info-strip:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.field}"
    padding: "14px 16px"
  plan-step:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  empty-state:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.card}"
    padding: "56px 24px"
  seal-paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.card}"
    padding: "28px"
  seal-paper-signature:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.card}"
    padding: "24px"
  seal-panel:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
  export-panel:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "16px 20px 18px"
---

# Design System: 叮当 (Toolbox)

## Overview

**Creative North Star: "The Quiet Workbench"**

A Windows utility that behaves like Windows, not like a themed microsite. The world is a warm-neutral paper stack, one blue signal, and the operating system's own UI voice. The frame is thin and fixed; the tools are the only content. Familiarity is the style, and reliability is produced by alignment, state feedback, and speed rather than by surprise.

Craft lives in the smallest mechanics: a 1px line that never doubles, a 44px icon block that lines up across both columns, a search field that focuses on Ctrl K, a card that lifts 2px and settles back. There is no decorative layer to maintain. Every surface either holds a tool or helps someone find one.

The implemented tools extend the same workbench without inventing a second world. 电子印章 keeps the fixed frame and blue UI, but gives the artifact an unthemed paper stage: white in both themes, a 24px checkerboard for transparency, a red seal that is content rather than chrome, and an export block pinned to the top of the right panel so the primary action never scrolls away. 图片压缩 is a batch list with a sticky settings panel. PDF 转 HTML is a viewer: a scrollable field of white pages on the left, a 340px inspector on the right, and an export block that stays at the panel's top while pages scroll. 证件照 is a light-table portrait stage beside a 340px inspector, with the same sticky export block and a 单张/排版 switch that turns the stage into a 6-inch print sheet.

The identity is deliberately split. `叮当` is the name people read in the titlebar and installer; `Toolbox` is the name the filesystem sees. The supplied `public/app.png` is the only raster identity, and every functional icon is Lucide linework.

**Key Characteristics:**
- Light-first with a persisted dark mirror; content, chrome, and card surfaces step by tone, not by shadow.
- One blue accent. Selection is a pale wash, focus is a 2px outline, and the only other UI hue is the Windows close-button red; seal red is content, scoped to the seal tool.
- A fixed three-anchor frame: 48px titlebar, 216px sidebar, 360px search. Content is a two-column wall of whole-card links.
- System UI type throughout; emphasis by weight and size; tabular numerals for every count and version. Bundled seal faces appear only inside the seal artwork.
- 1px hairlines, 12px cards, 5–14px interior radii, and one authored hover lift.
- Keyboard-complete: Ctrl K focuses search, Enter opens the first result, Escape clears or returns, and focus is always visible.
- Brand raster for identity; Lucide linework for function; no emoji and no glyph icons.
- The seal, PDF and 证件照 workspaces keep the artifact itself unthemed while the surrounding UI stays blue: paper-white portrait or page, light-table field, export and controls in the workbench's language.

Surface briefs: `.impeccable/surfaces/home.md` for the workbench and `.impeccable/surfaces/seal.md` for 电子印章.

## Colors

A warm-neutral paper palette under a single blue UI signal, mirrored into a cool near-black night mode. The accent is an identifier, not a fill; the seal tool's red is content ink on its own paper.

### Primary
- **Launcher Blue** (#2563EB light / #3B82F6 dark): focus outlines, text selection, the search field's active border, and antd's primary token. It marks interaction, never decoration.
- **Deep Launcher Blue** (#1D4ED8 light / #60A5FA dark): selected navigation text and icons, the 44px card icon glyph, the info-strip icon, and the 打开 action on card hover or focus. This is the readable blue on light and dark surfaces.
- **Selected Blue Wash** (#EAF1FE light / rgba(59, 130, 246, 0.14) dark): the selected sidebar row, every tool icon block, and the tool-page info strip. In light it is an opaque tint; in dark it is a translucent wash over the night card.
- **Night Selected Blue** (#93C5FD): the dark Ant Design menu's selected token. The global stylesheet also pins selected text to Deep Launcher Blue; both read as one pale-blue selected state on the wash, never as a solid block.

### Neutral
- **Canvas Paper** (#F6F6F4 light / #0F1115 dark): the scrolling content field and the `app-main` background.
- **Chrome Mist** (#F0F0ED light / #121419 dark): the titlebar and sidebar. It is one small step darker than the canvas, enough to separate the frame without a shadow.
- **Card White** (#FFFFFF light / #161A21 dark): every tool card, the search field, keycaps, and plan steps.
- **Paper** (#FFFFFF, no dark variant): the seal preview stage's paper. It is deliberately not a themed token; in dark mode it stays #FFFFFF, because the artifact is judged as it will be printed, not as app chrome.
- **Paper Checker** (#FAFAF7): the 24px checkerboard squares behind a transparent seal. It is a content-preview pattern, not a decorative page texture; signature mode removes it and uses the plain paper variant.
- **Ink** (#1C1D20 light / #F2F4F7 dark): headings, card names, and the primary reading color.
- **Quiet Ink** (#5F646B light / #9AA3B1 dark): descriptions, group labels, tags, counts, version, and the 打开 action at rest.
- **Hairline** (#E4E4DF light / #252A34 dark): the 1px border on cards, fields, titlebar, sidebar, and dividers.
- **Hairline Strong** (#D6D6D0 light / #333A47 dark): hover borders, the dashed empty-state border, and the keycap's bottom edge.
- **Hover Mist** (#E9E9E5 light / #1C212A dark): titlebar button hover, empty-state and plan-number fills, and the menu hover row.
- **Scroll Thumb** (#C9C9C3 light / #3A4150 dark): the thin custom scrollbar.

### Content
- **Seal Ink** (#D40000 default): the seal artwork's ink: ring, star, arc text, and personal-seal glyphs. It is a content color, editable by the user (presets #D40000, #C8102E, #E60012, #A61B29), and it never becomes a UI accent. It does not flip in dark mode; it is ink on paper.
- **Signature Ink** (Ink #1C1D20 by default): the signature pad's pen color, with #1E3A5F and #334155 presets. It is content, not UI text, even when the default value coincides with Ink.
- **ID Photo Backgrounds** (#FFFFFF, #438EDB, #D9001B): the three printed background presets offered by 证件照. They are artifact fills selected by the user, never UI accents, and they never replace Launcher Blue in the surrounding interface.

### Semantic
- **Close Red** (#C42B1C): only the close button's hover fill, with white text. It is a Windows convention, not a second brand accent.
- **Focus Blue** (rgba(37, 99, 235, 0.2) light / rgba(59, 130, 246, 0.3) dark): the 3px translucent halo around a focused search field. The 2px outline elsewhere uses the solid Launcher Blue.
- **Seal Warning Red** (#B42318 light / #F87171 dark): inline validation on the seal form — missing name, missing glyphs, overlong text, font load failure — and the stage's error overlay. It is scoped to the seal tool, not a general error system and not a second brand accent.

Measured contrast on the shipped values: light Ink on canvas is 15.6:1; light Quiet Ink is 5.5:1 on canvas, 6.0:1 on cards, and 5.2:1 on chrome. Dark Ink on the night canvas is 17.2:1; dark Quiet Ink is 7.4:1 on canvas, 6.9:1 on cards, 7.2:1 on chrome. The 11px nav count reaches 4.9:1 on the light hover wash and 6.3:1 on the dark hover wash. The canvas/card pairs meet the brief's 5.5/6.8 floors. The light chrome pair (5.2:1) and the hover-wash counts (4.9:1 light, 6.3:1 dark) sit below those floors but above the 4.5:1 AA floor, so keep new small text on card or canvas rather than on chrome or a hover wash. Seal warning text measures 6.6:1 on Card White and 6.1:1 on Canvas Paper in light, and 6.3:1 on the Night Card and 6.8:1 on Night Canvas in dark. Seal Ink on paper is 5.5:1, enough for the large solid artwork.

**The One Accent Rule.** There is one blue UI signal, and it is reserved for brand identification, tool identification, current selection, focus, and text selection. Close Red is the only other workbench UI hue and exists only on the close-button hover. The seal tool adds content ink (Seal Ink) and a scoped validation red; neither leaves that tool, and neither becomes a UI accent. No gradients, no decorative color fields, no second accent.

**The Selection Wash Rule.** Current selection is a pale blue wash with strong blue text. Never make a selected nav row a solid accent block, and never use the accent as a decorative page fill. The accent identifies; it does not fill. Standard Ant Design controls (Segmented, Select, Slider) keep their own selected treatment; this rule governs navigation rows and the custom surfaces around them.

**The Content Ink Rule.** Seal red is the artifact's ink, never the interface's accent. Use it only inside the seal artboard and the seal-color picker; never for buttons, links, focus rings, labels, selected states, or decorative page fills. The UI stays blue. Signature ink is neutral ink, not seal red.

## Typography

**Display Font:** Segoe UI Variable Text, Segoe UI, Microsoft YaHei UI, Microsoft YaHei, system-ui, sans-serif
**Body Font:** the same OS UI stack
**Label/Mono Font:** none; counts and versions use tabular numerals, not a monospace costume

**Character:** The operating system's own voice: neutral, familiar, and legible in both Chinese and Latin. There is no display face and no second sans in the interface. The brand is a wordmark set in the same stack, not a logo face. The seal artwork is the one exception: its type is content, so it may use the bundled seal faces.

### Hierarchy
- **Display** (600, 30px, line-height 1.2, tracking -0.02em): the launcher title and the tool-page H1.
- **Title** (600, 19px, line-height 1.3, tracking -0.01em): the tool-card name. It is the loudest line inside a card and the only one that should be.
- **Section** (600, 15–16px): the plan heading (15px) and empty-state heading (16px). No uppercase, no letter-spaced eyebrow.
- **Body** (400, 14px, line-height 1.6): tool-page description, search input, and default UI copy. Tool descriptions cap at 56ch.
- **Body compact** (400, 13px, line-height 1.6): card descriptions, info-strip copy, menu labels, and plan-step labels.
- **Caption** (400, 12px): the result count beside the title and the 打开 action.
- **Label** (400, 11px, tracking 0.02em on group labels): group labels, tags, nav counts, sidebar footer, and version. Counts are tabular so they do not jitter.
- **Micro** (400, 10px, line-height 1): Ctrl and K keycaps.
- **Brand** (600, 13px, tracking 0.01em): the 叮当 wordmark. It sits at reading size, not display size.

### Seal Fonts
The seal workspace is the only place a non-system face appears, and it appears inside the artwork rather than in the interface.

- **敬峰中山王篆 V3.5** (`JFZSK`, 2.47MB TTF): SIL Open Font License 1.1, by 刘敬峰. It covers 3,509 simplified characters and is offered for personal seals only. The bundled file is unmodified.
- **崇羲小篆** (`ChongXi`, 21.82MB OTF): CC BY-ND 3.0 TW, issued by 中央研究院「小学堂」 (王心怡 et al.). It carries 11,608 cmap codepoints in traditional forms; the bundled file is original, unmodified, and not subset. Simplified input is converted with OpenCC (cn→tw) at runtime. It is the default personal-seal face, labeled `内置 · 繁体`, and the form shows the converted `繁体字形` when it differs from the typed name.
- **System faces:** 宋体, 仿宋, 楷体, 黑体, 隶书. Official and oval seals offer 宋/仿/楷/黑; personal seals offer 宋/仿/楷/隶 plus the two bundled faces. A system face is probed with `FontFace` `local()` and disabled in the selector when unavailable.
- **Coverage and licensing:** `src/seal/fontCoverage.json` lists the codepoints each bundled face covers. A missing glyph names the characters, shows a warning, and keeps export disabled; there is no silent fallback or mixed-font seal. The personal form's 字体授权 popover names both fonts, authors, sources, and licenses; the full license files ship in `public/fonts`. OFL 1.1 permits bundling and embedding. CC BY-ND 3.0 TW permits redistribution of the unmodified file with attribution and forbids derivatives, subsetting, or conversion; it is not an open-source license, and the documentation must not call it one.

**The OS Voice Rule.** The OS UI stack is the identity. Emphasis comes from weight and size, never from a second family, gradient text, or uppercase letter-spaced labels. Do not introduce a display face to make the launcher feel designed; restraint is the design. Seal faces and system serifs belong to the seal artwork only; never use them for UI labels, buttons, navigation, or chrome.

**The Tabular Count Rule.** Every count, version, result total, and numeric badge uses tabular numerals. Changing a count must not move the layout.

**The Quiet Label Rule.** Metadata is 10–12px and Quiet Ink; it never competes with the tool name. A label larger or darker than the thing it labels is a break.

**The Glyph Coverage Rule.** A bundled seal face is used only when every non-space character is covered. Missing glyphs name the characters, keep export disabled, and never trigger a silent substitute. Bundled faces ship unmodified with their attribution and license files; CC BY-ND is not open source and must not be subset, converted, or modified.

## Layout

A fixed desktop frame with three bands: a 48px custom titlebar, a 216px sidebar, and a fluid content area. The content centers at 1180px (920px on an unimplemented tool page; the seal page uses the full 1180px), but the default 1280px window leaves 1064px after the sidebar, so the shipped view is generous rather than maxed out. The rhythm is 26px between the page head and the card wall, 22px inside a card, and 18px from the card's top edge to its name.

The shell is exactly `100vh`; `.app-main` is the only scroll container and gets `min-height: 0`. Tool pages scroll the page itself. Never put the form in its own inner scroll area beside a fixed preview; the page scroll is what lets the preview and export stick.

### Frame metrics
- **Window:** 1280×820 default, 1040×700 minimum, centered, frameless, native shadow, fixed `#F6F6F4` window background. Resizable.
- **Titlebar:** 48px high, padding `0 8px 0 14px`, 1px bottom hairline. Brand mark 26px with a 6px radius and a 10px gap to the 13px wordmark. Window controls 34×30px.
- **Sidebar:** 216px wide, padding `10px 8px 12px`, 1px right hairline. At ≤1120px it becomes 204px. Rows are 40px high with an 8px radius and 2px block margins.
- **Content:** `max-width: 1180px` (`920px` on an unimplemented tool page), padding `28px 32px 36px`; at ≤1120px padding becomes `24px 24px 32px`. The main column scrolls independently; the frame does not.
- **Page head:** title on the left, search on the right, 24px gap. The title is 30px; the result count appears beside it only while searching. No subtitle.
- **Search:** 360×38px at default, 300px at ≤1120px, full width at ≤920px.
- **Tool grid:** two equal columns, 16px gap, 26px below the page head. Cards have a 252px minimum height and 22px padding. At ≤920px the grid becomes one column.
- **Card internals:** 44px icon block, group label opposite it, name 18px below the icon block, description 8px below the name, and a bottom-pinned foot with 18px top padding.
- **Tool page:** 56px hero icon with a 14px radius, 30px H1, 14px description at 56ch, info strip 26px below the header, then a 28px-top plan section with a 1px divider.
- **Seal workspace:** `max-width: 1180px`; two panes at `minmax(0, 1fr) 340px` with a 24px gap and 24px top margin. At ≤1120px the panel becomes 300px and the gap 20px. At ≤980px the workspace becomes one column and the stage stops sticking. The left stage is sticky at `top: 0`; the 340px right panel is a Card White card, and its export block is sticky at `top: 0` inside it.
- **Seal paper:** `min-height: 460px` with 28px padding; signature mode uses the plain variant at `min-height: 340px` and 24px padding with no checkerboard. Both are 12px radius, 1px `rgba(20, 22, 26, 0.08)`, and the resting card shadow. Artboards cap at 340px (official), 400px (oval), 300px (personal), and 620px (signature, 2:1). The caption is 12px Quiet Ink, centered, 12px below the paper.
- **Seal panel internals:** inner padding `20px 20px 6px`; sections separate with a 22px top margin, 20px top padding, and a 1px top hairline. Export padding is `16px 20px 18px` with a 1px bottom hairline and a 12px top-only radius. Form items sit 16px apart; labels are 12px, panel labels 11px/600/0.02em, notes 12px/1.55, and the two-column field row uses a 12px gap.
- **ID photo workspace:** `max-width: 1180px`; a portrait stage and a 340px inspector with a 20px gap. The stage head carries the file name, a small 单张/排版 Segmented and 更换; the viewer is a `clamp(380px, 56vh, 560px)` light table (#E7E7E3) with 20px inset and a contained canvas. The 11px footer reports millimetres, pixels and sheet count. At ≤1120px the inspector is 320px with a 16px gap; at ≤980px it stacks and the export block stops sticking.

**Responsive behavior:** 1120px trims the sidebar, search, and page padding without changing the composition. 920px stacks the card grid and makes the search full width; 980px stacks the seal workspace. Because the production window has a 1040px minimum, both stacked states are browser-preview/future-surface states rather than shipped desktop states.

**The Page-Scroll Rule.** The shell is a fixed `100vh` frame with one scroll container: `.app-main` (`min-height: 0`). Tool pages scroll the page; preview stages and export panels stick inside that scroll. Never make the right-hand form its own inner scroll pane.

**The Three-Anchor Rule.** 48px titlebar, 216px sidebar, 360px search are the frame anchors. At the narrow step they become 48 / 204 / 300; they never turn into a different navigation model. Keep the anchors stable so every new tool inherits the same geometry.

**The Header-Only Rule.** On the launcher page head, only the title (plus the result count while searching) and the search field appear. No subtitle, kicker, eyebrow, stat row, or toolbar. The tool page's description belongs to the tool header, not to the launcher page head.

**The Two-Column Rule.** The home wall is two equal columns above 920px and one below. Cards stretch to equal height, and the foot is pinned to the bottom so tags and 打开 align across a row.

## Elevation & Depth

Depth is tonal first: chrome sits one step below canvas, cards sit one step above it, and a 1px hairline does most of the separating. At rest, the card shadow is almost invisible. The only authored elevation moment is the card lift on hover; there are no decorative glows, glass panels, colored halos, or hard block shadows. The search focus ring is the one translucent halo, and it exists solely for focus. The seal paper and seal panel reuse the resting card shadow; sticking adds no shadow. The export panel separates from the scrolling form with a 1px bottom hairline, not a lifted edge.

### Shadow Vocabulary
- **Card at rest, light** (`0 1px 2px rgba(20, 22, 26, 0.04)`): a barely-there edge under every tool card.
- **Card at rest, dark** (`0 1px 2px rgba(0, 0, 0, 0.35)`): the night equivalent; the card's border does most of the work.
- **Card hover, light** (`0 12px 28px rgba(20, 22, 26, 0.08), 0 2px 6px rgba(20, 22, 26, 0.04)`): the 2px lift; offset plus soft blur.
- **Card hover, dark** (`0 18px 40px rgba(0, 0, 0, 0.48), 0 2px 8px rgba(0, 0, 0, 0.32)`): a deeper lift that still reads as a shadow, not a glow.
- **Search focus, light** (`0 0 0 3px rgba(37, 99, 235, 0.2)`): a translucent ring paired with a solid accent border.
- **Search focus, dark** (`0 0 0 3px rgba(59, 130, 246, 0.3)`): the night ring.
- **Keycap edge** (`0 1px 0 var(--border)`): the 1px bottom edge of a Ctrl/K keycap; the only permitted hard edge.

**The Tonal-First Rule.** At rest, surfaces separate by a color step and a 1px line, not by shadow. If a new surface needs more separation, change its tone or border before adding a shadow.

**The Lift-Only Rule.** The tool card is the only element that lifts: `translateY(-2px)` on hover, back to 0 on active, with the offset/blur shadows above. No zero-offset decorative halos and no `4px 4px 0` hard block shadows; the 1px keycap edge is the sole exception.

**The Focus Ring Rule.** Keyboard focus is a 2px solid Launcher Blue outline at 2px offset; the search field instead uses a solid accent border plus the 3px translucent ring. The signature canvas uses the same 2px outline at 3px offset so the ring clears the drawing surface. Never remove any of these, and never hide focus behind hover.

## Shapes

Rectilinear with soft corners. Structural lines are always 1px. Radii step with the size of the object: outer cards 12px, their icon blocks 11px, fields/info strips/plan steps 10px, menu rows 8px, titlebar controls and the brand mark 6px, tags 5px, keycaps 4px. The seal workspace follows the same ladder: 12px paper and panel, 8px signature canvas, 1px segment/input borders, and a 12px top-only radius on the export panel at the panel's top edge; a 1px bottom hairline separates it from the form. Circles are reserved for the empty-state glyph and plan numbers; they are not a general container shape.

**The Hairline Rule.** Every structural border is 1px. No 2px card outlines, no thick colored `border-left` or `border-right` bars. Color changes and the wash carry state; thickness does not.

**The Nested-Radius Rule.** A child never has a larger radius than its parent: 12px card → 11px icon block, 10px field, 5px tag. Circles are the only exception. This is what keeps the card wall from looking assembled out of unrelated parts.

## Components

### Titlebar and Window Controls
A custom 48px Windows titlebar with a drag region, a brand block, a theme toggle, and three window controls. The brand is the 26px `public/app.png` mark at a 6px radius, followed by the 叮当 wordmark at 13px/600. The action cluster is a theme toggle with a 16px icon, a 1×18px divider, then minimize, maximize/restore, and close at 34×30px with 6px radii and 1.6–1.8 Lucide strokes. Icons are Quiet Ink; hover is Hover Mist with Ink; close hover is Close Red with white. The maximize icon swaps between a square and overlapping squares at 12.5px. Double-clicking the drag region toggles maximize. The theme toggle carries a tooltip and `aria-pressed`.

**Theme behavior:** light is the default. The choice is stored under `toolbox-theme`, applied as `data-theme` on the document root, and read by an inline pre-paint script so the first paint is already in the chosen mode. Ant Design switches between its default and dark algorithms; custom surfaces use CSS variables; `color-scheme` follows the theme.

**The Display Alias Rule.** `叮当` is the only name a person reads. Paths, folders, and binaries stay English: install to `%LOCALAPPDATA%\Toolbox`, executable `toolbox.exe`, Tauri `mainBinaryName: toolbox`. The NSIS installer's display name is 叮当 because it is a display artifact; the install folder is still `Toolbox`. Never put the Chinese name in a path or executable.

### Sidebar
A transparent Ant Design inline menu on Chrome Mist, 216px wide (204px at ≤1120px). Rows are 40px high, 13px, with 17px Lucide icons at 1.7 and an 8px radius. The label row carries a right-aligned 11px tabular count; the row is a flex pair so counts never crowd the label. Selected rows use Selected Blue Wash with Deep Launcher Blue text and icon; hover uses Hover Mist. The footer holds Ctrl/K keycaps and `v0.1.0`; the shortcut is hidden on tool pages while the version stays. Selecting a group clears the search; typing a global query selects 全部工具; opening a tool selects that tool's group.

### Search
The only search surface, always in the page head on the home screen. It is 360×38px, 10px radius, Card White, 1px Hairline, 12px horizontal padding, with a 15px Lucide search glyph at 1.8 and a 14px X clear glyph at 1.8. Placeholder and icons are Quiet Ink. Hover raises the border to Hairline Strong; focus swaps the border to Launcher Blue and adds the 3px focus ring. Ctrl K focuses it from anywhere on the home screen; Enter opens the first result; Escape clears the query, then blurs on a second press. Matching covers name, description, and tags across all tools. While a query is present the title becomes 搜索结果 and the count appears; the grid switches to results regardless of the selected group.

**The Persistent Search Rule.** Search is part of the launcher header, not a modal, a drawer, or a command palette. It is always visible on the home surface and always one keystroke away.

### Tool Cards
The card is the product object: a whole-card link to one tool. Two columns, 16px gap, 252px minimum height, 22px padding, Card White, 1px Hairline, 12px radius, and the resting shadow. The top row holds a 44px icon block (11px radius, Selected Blue Wash, 21px Lucide glyph at 1.7 in Deep Launcher Blue) and the group label at 11px Quiet Ink. The name is 19px/600; the description is 13px/1.6 Quiet Ink with pretty wrapping. The foot is pinned to the bottom with 18px top padding: transparent 5px tags on the left, and 打开 with a 14px ArrowUpRight on the right. Hover lifts the card 2px, raises the border, applies the hover shadow, and turns 打开 Deep Launcher Blue; active returns the card to 0. Focus-visible adds the 2px accent outline. There are no nested buttons, menus, or secondary actions.

**The Object Card Rule.** A card is one tool, not a container for prose. Never nest a card inside a card, and never wrap a tool in a decorative card stack. Adding a tool means adding one card and nothing else.

### Tags
Ant Design tags with transparent fill, 1px Hairline, 5px radius, 11px Quiet Ink, and `2px 8px` padding. They label tool kinds and file formats (公章, 个人章, 椭圆章, 手写签名, JPG, PNG, WebP). They are read-only in this build; there is no selected or filter state.

### Buttons
The shipped buttons are Ant Design defaults under a no-shadow theme: 10px radius, 36px control height, font weight 500, and no primary/default/danger shadow. Text buttons (the back action) are Quiet Ink and turn Ink on hover. The empty state uses a default button. Do not restyle these into custom widgets; the product's constraint is that standard controls keep standard behavior. Each implemented tool has exactly one primary-filled export action: Ant Design primary, large (40px), with a Download glyph; the seal adds a 40px chevron split for SVG. Primary is Launcher Blue, never Seal Ink.

### Tool Page (signature)
Unimplemented tools use a 920px-wide honest placeholder, not a fake tool. The back text button (ArrowLeft 16px at 1.8, Quiet Ink) returns to the previous view or home; Escape does the same. The header pairs a 56px icon block (14px radius, 26px Lucide glyph at 1.6) with a 30px H1, a 14px/1.6 description capped at 56ch, and the group/tag row. A Selected Blue Wash info strip (10px radius, `14px 16px` padding, 16px Info glyph in Deep Launcher Blue) states: “此工具将在下一阶段接入，当前先保留入口。” Below a 1px divider, “计划中的步骤” is a 15px heading over wrapping plan cards: Card White, 1px Hairline, 10px radius, `12px 14px` padding, 180px minimum, a 24px circular tabular number in Hover Mist, and a 13px label. All four current tools are implemented and replace the plan area with their own workspace. 电子印章 and PDF 转 HTML use the full 1180px width; 图片压缩 uses the same shell with a batch list and sticky settings panel; 证件照 uses a light-table portrait stage with a 340px inspector.

**The Honest Placeholder Rule.** Until a tool is wired up, show the info strip and the planned steps. Never mock a working tool interior or imply functionality that is not there.

### Seal Workspace (signature)
The first implemented tool page. It keeps the 48px titlebar, 216px sidebar, and the tool header, then splits into a paper stage on the left and a 340px inspector card on the right. The page scrolls; the stage and the export block stick. The inspector is a single scrolling stack of object groups: 单位名称, 章型与底部文字, 编号, 五角星, 整体 for the official seal; 姓名, 版面, 整体 for the personal seal; 整体, 上弧, 中间, 下弧, 编号 for the oval; 笔迹, 导出 for the signature. A 恢复标准值 footer closes the seal groups. Mode changes preserve each mode's in-memory configuration.

#### Mode Switch
Ant Design Segmented, `size="large"`, with four options: 公章, 个人章, 椭圆章, 签名. Each label is 13px with a 15px Lucide glyph at 1.7 (Stamp, UserRound, Circle, PenTool) and a 6px gap. The segmented track carries 3px inset padding and a 1px Hairline border; selected segments keep Ant Design's standard raised treatment rather than a custom fill. The switch sits at the right end of the header (`margin-left: auto`) and wraps under the title block when the header gets tight. Do not turn it into a custom tab bar.

#### Paper Stage
The preview is a paper-white stage, not a themed app surface. `min-height: 460px` (340px in the plain signature variant), 28px padding (24px signature), 12px radius, 1px `rgba(20, 22, 26, 0.08)`, and the resting card shadow. The default stage carries a 24px checkerboard built from #FAFAF7 squares on #FFFFFF, which reads as transparency behind the seal; signature mode removes the checkerboard and uses plain paper. The artboard inside caps at 340px (official), 400px (oval), 300px (personal), and 620px (signature, 2:1 canvas). A 12px Quiet Ink caption sits 12px below the paper and states the real dimensions and background, e.g. `Ø42mm · 透明背景`, `22mm · 朱文`, `40 × 30mm · 透明背景`, or `手写签名 · 导出宽度 50mm`. Loading and font-error states overlay the artboard with a 78%-white veil and 13px Quiet Ink or Seal Warning Red text.

**The Paper Stage Rule.** The preview is always paper-white, in both themes. Never repaint the stage, checkerboard, or seal artboard with dark-mode surface tokens; only the caption, panel, and surrounding UI change with the theme. The artifact must be judged as it will be printed.

#### Sticky Export Panel
The export block is the first child of the right panel and sticks at `top: 0`, so the primary action stays visible while the form below scrolls. It has a 1px bottom hairline and a 12px top-only radius; it does not lift or gain a shadow. The label is 导出. The two fields are precision (300/600/1200 DPI) and background (透明/白底); signature mode replaces precision with width (30/40/50/60/80mm). A blocking warning repeats above the export button when the current mode cannot export. The main action is a full-width primary 导出 PNG button with a 16px Download glyph at 1.8; official and oval modes add a 40px chevron split for 导出 SVG. No format note sits under the actions: the controls, labels and disabled states carry the behavior. Export is disabled when the current mode is invalid, the font is loading or failed, glyphs are missing, the signature is empty, or an export is already running. The native save dialog comes from `tauri-plugin-dialog`; bytes are written by the Rust `save_export` command. Browser preview falls back to a download. Filenames follow `公章_{单位}_{尺寸}_{dpi}dpi.png`, `椭圆章_{上弧}_{宽}x{高}mm_{dpi}dpi.png`, `个人章_{姓名+后缀}.png`, and `签名_YYYYMMDD.png`, sanitized for Windows reserved names and invalid characters.

**The Export Lock Rule.** Export stays at the top of the right panel while the form scrolls. Never move the primary export to a footer or below the form; the action must remain visible at every scroll position. The shipped build deliberately reversed an earlier footer plan for this reason.

#### Object-Grouped Inspector and Metric Fields
The right card is a single scrolling inspector, not a set of abstract tabs. Each group is named after the object it edits, and its content and geometry live together: 单位名称 has the input plus inset, arc span, font size and letter spacing; 章型与底部文字 has the type select and the bottom text's size, position and spacing; 编号 has the number input, the 弧排/横排 switch, size, inset or line position, arc span and spacing. 五角星 and 整体 follow. Personal, oval and signature use the same object logic. Group headings are 12px/600 Ink, separated by a 1px Hairline and 18px of air; the first group after the warnings has no top rule. The export block stays above the groups; a 恢复标准值 text button sits in a 1px-top footer. Standard Ant Design vertical form, `requiredMark={false}`; item labels are 12px Quiet Ink, items 14px apart.

Every geometry number uses the same Metric Field: a 12px Ink label, a small Ant Input Number with a unit suffix, and a Slider underneath, so the exact value is always readable. Font size adds a 自动 Switch in the field head; while auto is on the input and slider are disabled and the hint states the fitted size (for example 自动适配 6.72mm). Turning auto off seeds the manual value with the current fitted size, so the switch never jumps. Controls sit with the object they change rather than in abstract 内容 / 版式 / 细节 sections. There are no explanatory section descriptions or field sublabels: labels, units, placeholders, states and warnings carry the meaning. The only inline hint left is the auto-fit value (自动适配 6.72mm) under 字号, because it reports live state rather than restating the control. Personal seals add layout, glyph gap and X/Y block offset; oval seals group 整体 / 上弧 / 中间 / 下弧 / 编号; signature adds smoothing and crop padding.

**The Full Inspector Rule.** Every parameter that changes the printed seal is adjustable in the inspector: text inset, font size, arc span, letter spacing, border, star size/position, bottom text size/position/spacing, and the official number's arc/line layout with inset, arc span, position and spacing; personal layout/gap/offset, oval arc groups, and signature smoothing/crop. The official number defaults to the bottom arc. Auto is a starting point, not a cage; never hide a geometry control behind a fixed preset.

Blocking problems are stated, not discovered on export. A 12px Seal Warning Red block sits above the groups; the sticky export panel repeats the first blocking warning above the disabled button. Text overflow, manual font larger than the layout, missing glyphs, and overlapping star/bottom text/number all pause export until adjusted. The font-credit trigger remains a 12px Quiet Ink text button opening a 300px top-right popover.

#### Official and Oval Seals (SVG)
Official seals are an SVG circle with an adjustable border (0.2–4mm), an optional five-point star with size and vertical offset, top arc text with adjustable inset, arc span, letter spacing and auto/manual font size, plus an optional bottom label. The official number is an arc by default — a bottom textPath with its own inset, arc span, size and spacing — and can switch to a horizontal line with a vertical position. The bottom label keeps independent size, position and spacing. Oval seals are an SVG ellipse with the same per-band controls for top, center, and bottom text, plus a number; the width and height are adjustable. Text is measured in millimetres with Canvas metrics and letter spacing; auto fits between a maximum and minimum, while manual sizes are checked against the arc and pause export on overflow. Official and oval artboards use system fonts only (宋/仿/楷/黑) so the SVG stays portable. SVG export writes `width`/`height` in millimetres and optionally adds a white rect; PNG export rasterizes the same SVG at the chosen DPI and then writes pHYs. The preview carries an `aria-label` naming the seal and its content.

#### Personal Seal Canvas
A 300px square, 1:1 Canvas 2D artboard. The glyph layout is automatic (vertical for 1–3 characters, two columns for four or more), with explicit 竖排 and 双列 overrides. Text inset, glyph gap, font size (auto/manual), block X/Y offset, shape and border are adjustable; a manual size above the fitted value is flagged and pauses export. 朱文 draws Seal Ink glyphs and a frame on transparent; 白文 fills the frame in Seal Ink and punches the glyphs out with `destination-out`, so the holes are truly transparent rather than white. The face can be either bundled seal font or 宋/仿/楷/隶; 崇羲 is the default and shows the `繁体字形` conversion. The preview re-renders at device pixel ratio and on resize. Personal seals export PNG only; the form explains that rasterizing avoids an SVG with missing glyphs. Missing glyphs are listed in the form, clear the stage and disable export; a font load failure also overlays the stage.

#### Signature Pad
A 620px-max, 2:1 canvas on plain paper, with a dashed 1px baseline at the 22/30 line. Pointer events use capture; strokes are smoothed with quadratic segments, a minimum point distance, and an adjustable smoothing amount (0–100%, default 40). Pen width runs 1.5–6 (default 3); ink defaults to #1C1D20 with #1E3A5F and #334155 presets. Undo, redo, and clear sit as Ant Design buttons with 15px Lucide glyphs; history holds 50 states, and clearing is undoable. Export crops to the inked bounds plus the adjustable 1–8mm crop padding (default 3), writes a fixed 600 DPI PNG at the selected 30–80mm width, preserves the stroke aspect ratio, and supports transparent or white background. The canvas takes focus with the 2px accent outline at 3px offset.

### PDF Workspace (signature)

The third implemented tool. It keeps the 48px titlebar, 216px sidebar, compact back topbar, and the same card language, then splits into a page stage on the left and a 340px inspector on the right. The workspace fills the available height; only the stage body scrolls, so the export block never leaves the panel.

#### Page Stage

The stage is a viewer, not a white app surface: Card White frame, 1px Hairline, 12px radius, and the resting shadow. Its head carries the file name at 13px/600 and a tabular `N 页 · size` at 11px Quiet Ink. The body is a viewer-gray field (`#E7E7E3`) with no padding; it holds the generated HTML in an iframe. The preview is the actual export (preview mode) at 144 DPI: SVG table lines and bands, real text spans with embedded fonts, extracted images, and a raster bottom layer only for complex art. A fit script scales the page to the stage width with `zoom`, so the preview remains WYSIWYG without a second renderer.

**The Page-Is-Content Rule.** PDF pages are paper, never themed chrome. They stay white in both themes; only the viewer field, captions, and inspector follow the theme. The preview must show the exported reconstruction, not a separate "original" rendering.

#### PDF Inspector

The panel is one card with three parts, in this order: the sticky export block, 文件, and 转换设置. Export is first and sticky so the primary action is present at every scroll position. It carries the `导出` label, a tabular `N 页 · DPI`, and a full-width primary `导出 HTML` with a 16px Download glyph. The button carries its busy state while the native conversion runs; it is disabled until the range is valid.

文件 repeats the name and `N 页 · size` with a text `更换文件`. 转换设置 holds a block Segmented for 144 / 192 / 300 DPI (12px labels, 26px rows), a 全部 / 自定义 Segmented, and a custom range Input (`如 1-3,5,8-10`) with inline red validation. Warnings for scanned pages and graphic-only art sit in a quiet 11px note under the settings. No explanatory footnotes: the labels, units and warnings carry the meaning.

#### Output Artifact

The export is one self-contained HTML. Each page is a white section at its 96dpi CSS size, with SVG paths for lines, fills, table borders and cubic curves (including the PDF clip paths that shape them); a layer of extracted `<img>` elements at their PDF transforms; and a layer of real text runs at their PDF coordinates. Each run is anchored at its first character's baseline origin and split into per-character boxes whose widths come from PDFium's loose character bounds, so tracking and justification match the PDF without stretching glyphs. Embedded subsets are repaired before they are used as inline `@font-face` data: a Unicode cmap is rebuilt from the PDF's ToUnicode/CIDToGIDMap data (or, for simple fonts, the subset's own code table), and missing `OS/2`, `post` and `name` tables are supplied so the browser accepts the font. Fonts the PDF did not embed fall back to the family Pdfium actually substituted, and the browser re-measures each character to keep the original advances. Glyphs with no Unicode mapping are cropped from a high-resolution page render and placed at their bounds. Images stay individual elements, so the output toolbar's 编辑文字 mode makes runs `contenteditable` and turns image clicks into a file picker; 保存副本 serializes the edited DOM into a new HTML. A raster layer is used only for constructs that cannot be split, such as bezier stamps, patterns and scanned pages. Print uses named `@page` sizes in millimetres and hides the toolbar and hint.

**The Object-Element Rule.** Never flatten the page into one screenshot. PDFium page objects become real elements: text becomes per-character positioned spans, paths (including cubic beziers and their clip paths) become SVG, and images become `<img>`. Only constructs that cannot be separated (patterns, shadings, clipped images, scanned pages) stay in a bottom raster layer, and the interface says that part is graphic-only rather than pretending it is editable.

### ID Photo Workspace (signature)

The fourth implemented tool. It keeps the fixed frame and the compact back topbar, then splits into a paper-white portrait stage on the left and a 340px inspector on the right. The stage head carries the file name and dimensions, a small 单张/排版 Segmented, and 更换; the viewer is a light table (#E7E7E3) with the portrait contained inside, so the photo is judged as a print rather than as app chrome. The 11px footer reports millimetres, pixels and sheet count. In 单张 view the preview draws two blue dashed composition guides (头顶 and 下巴) and a faint centre line; they never enter the export.

**The Light-Table Rule.** The portrait stage is a neutral light table in both themes, not a themed surface. The photo, sheet and cut lines are content; only the surrounding UI changes with the theme. Composition guides are preview chrome and must be drawn on the preview canvas only, never on the export canvas.

The inspector is one card: a sticky export block, then 规格, 背景, 人像 and 输出. 规格 holds 照片规格 (a Select of six common Chinese sizes, each with its millimetre size) and, in single mode, 导出尺寸 (标准 300 DPI / 原图分辨率) with the pixel size. The physical size and the export resolution are deliberately two labelled fields in one group, never two competing size options; each datum is written once, and the export block repeats neither. 背景 is a four-option Segmented with artifact swatches (白底/蓝底/红底/原背景); with a replacement colour active, 容差 and 羽化 sliders tune the local cutout and a quiet spinner reports 识别中. 人像 holds 缩放, 水平, 垂直 and the 构图辅助线 switch, with the photo itself draggable in the stage; the bounds and sliders share the same maxima. 输出 holds JPG/PNG and a JPG quality slider; the export block reports the approximate file size only in 300 DPI mode. In 排版 mode the stage becomes the 6-inch sheet at 300 DPI with the count in the footer and export meta; the output group states that the sheet is fixed to PNG. Export is one full-width primary action whose label follows the mode, disabled while the matte is being prepared.

The background replacement is a local colour cutout, not a model: it samples the top and upper sides, grows a region from those edges with an adaptive colour-distance cap, chokes and feathers the matte, and decontaminates soft edge pixels. That keeps a white shirt on a blue backdrop from disappearing. It cannot separate same-coloured clothing from the background, so 原背景 always remains available and the empty state sets the expectation. 原图分辨率 (the original-size export) uses the source pixels inside the current crop at 1:1, never below the 300 DPI footprint, capped at 3000px on the long edge; a higher-resolution matte is prepared only when that export is requested. Exports write the effective DPI into the JPEG JFIF header and the PNG pHYs chunk; the print sheet is 6 × 4 inches with per-photo cut lines. Filenames follow `证件照_{规格}_{底色}_{宽}x{高}.jpg` and `证件照_{规格}_6寸排版_{N}张.png`.

### Empty State
A dashed 1px Hairline Strong boundary at 12px radius, `56px 24px` padding, with a 44px circular Hover Mist glyph (SearchX or Info at 20px/1.7), a 16px/600 heading, a 13px Quiet Ink line, and one default Ant Design button. It appears for no search matches and for an empty group. The copy names the recovery: clear the search or view all tools.

**The Intake Drop Rule.** The three file-intake screens — 图片压缩, 证件照 and PDF 转 HTML — share one drop geometry: `max-width: 820px`, `min-height: 440px`, `48px 32px` padding, 12px radius, 1px dashed Hairline Strong, Card White, and no resting shadow. Inside: a 56px Selected Blue Wash icon block with a 26px Lucide glyph, a 19px/600 heading, a 13px Quiet Ink line with `8px 0 24px` margins, and a primary button with a 148px minimum width. The whole surface is the picker; the button is the keyboard-accessible action. Never give one intake screen its own box size.

### Icons and Brand Assets
Functional icons are Lucide only, in a 1.6–1.8px stroke range (most at 1.7), sized 14–26px. The contract named 1.6px; the shipped build uses 1.6 on the tool hero, 1.7 on cards/nav/titlebar, and 1.8 on search/clear/action arrows, so the recorded policy is the shipped range. The seal workspace adds 15px mode icons, 16px export and split glyphs, 15px signature actions, and a 14px footnote Info, all inside the same range. Brand, app, window, taskbar, installer, and uninstaller iconography come from `public/app.png` (1254×1254, user-supplied); the desktop icon set in `src-tauri/icons` was generated with `tauri icon`, and the favicon serves `app.png` directly. No third-party raster and no emoji.

**The Two-Icon Rule.** Brand raster for identity; Lucide linework for every functional icon. Never swap them, never recolor the brand raster into a UI icon, and never use Unicode glyphs or emoji as an icon.

### Browser Surfaces
Text selection is Launcher Blue with white in light mode (5.2:1); in dark mode it switches to Night Deep Launcher Blue (#60A5FA) with Night Canvas ink (7.4:1), so selected text stays legible. Scrollbars are 10px, with a 10px-radius thumb in Scroll Thumb and a 3px border of the canvas color. Focus-visible is a 2px accent outline at 2px offset. The `color-scheme` follows the theme so native controls match. The keycap is an 18px-high, 4px-radius cap with a 10px label and a 1px bottom edge.

### Motion
`--ease: cubic-bezier(0.2, 0.7, 0.2, 1)`. The tool card transitions transform, border-color, box-shadow, and background-color at 160ms; it is excluded from the later surface transition rule so its authored four-property transition survives the cascade. Other surface-level color, border, and background changes run 180ms. The seal page adds no authored motion; Ant Design control transitions and the 180ms surface changes are the only movement, and sticky positioning is not animated. There are no entrance animations, parallax, or looping effects. `prefers-reduced-motion: reduce` collapses transitions and animations to 0.01ms.

**The One-Motion Rule.** The card lift is the only authored hover moment. Everything else is a 160–180ms color or border change. Do not add a second entrance, a scroll reveal, or a decorative pulse.

## Do's and Don'ts

### Do:
- **Do** keep light as the default and persist the choice under `toolbox-theme`; apply it before paint so the first frame matches.
- **Do** hold the 48px titlebar, 216px sidebar, and 360px search anchors, and the 12px card radius.
- **Do** use the 44px Selected Blue Wash icon block for every tool, with a Lucide glyph at 1.6–1.8 and tabular counts.
- **Do** keep the whole card as one link, with the 2px accent focus outline and the 2px hover lift.
- **Do** write `叮当` in UI copy and keep `Toolbox` / `toolbox.exe` / `%LOCALAPPDATA%\Toolbox` in paths and binaries.
- **Do** separate surfaces with 1px hairlines and tone first; use offset-plus-blur shadows only when state demands them.
- **Do** measure new text pairs against the shipped floors: 5.5:1 light and 6.8:1 dark on canvas/card, with 4.5:1 as the absolute AA floor.
- **Do** use Lucide for functional icons and `public/app.png` for brand, window, and installer identity.
- **Do** keep the seal preview paper-white in both themes, with the 24px #FAFAF7 checkerboard for transparency and plain paper for signatures.
- **Do** keep Seal Ink inside the seal artboard and the color picker; the surrounding UI stays Launcher Blue, and signature ink stays neutral.
- **Do** pin export to the top of the right panel and let the page scroll; keep the preview sticky beside it.
- **Do** check bundled-font coverage before export, name missing characters, and keep export disabled until the glyphs or font are fixed.
- **Do** export PNG at 300/600/1200 DPI with pHYs metadata (signatures fixed at 600), or SVG for official/oval only, using the shipped filename patterns.
- **Do** keep the seal layout at 1180px with a 340px panel (300px at ≤1120px), stacking at ≤980px.
- **Do** expose every geometry parameter as a Metric Field: label, numeric input with unit, and slider. Auto font is a starting point, not a hidden default.
- **Do** group the inspector by the object being edited — 单位名称, 章型与底部文字, 编号, 五角星, 整体 — so content and geometry sit together; the default official number is arc-set.
- **Do** pause export on overflow, missing glyphs, font-load failure, or overlapping star/text/number, and repeat the blocking reason above the export button.
- **Do** keep the ID-photo preview on the #E7E7E3 light table, draw composition guides only on the preview canvas, and write the effective DPI (300 or the original-pixel DPI) into both JPEG and PNG exports.

### Don't:
- **Don't** introduce a second accent, gradients, decorative color fields, glass, glow, or `4px 4px 0` hard block shadows.
- **Don't** add a kicker, eyebrow, subtitle, stat row, or toolbar above the launcher title.
- **Don't** add a display face or a second sans; the OS UI stack is the identity. No gradient text.
- **Don't** use emoji, Unicode glyphs, or a monospace costume for icons or “technical” labels.
- **Don't** nest cards or put buttons, menus, or secondary actions inside a tool card.
- **Don't** make the selected nav row a solid accent block; use the wash and the strong blue text.
- **Don't** put a colored `border-left` or `border-right` above 1px on cards, rows, or callouts.
- **Don't** put the Chinese product name into an install path or executable name.
- **Don't** theme the seal paper, checkerboard, or artboard with dark-mode surface tokens; only the surrounding UI flips.
- **Don't** use seal red for buttons, links, focus rings, labels, selected states, or decoration, and don't use the bundled seal faces in UI chrome.
- **Don't** move the primary export to a footer or below the form, or put the form in its own inner scroll pane.
- **Don't** silently substitute a font, mix faces inside one seal, or export with missing glyphs.
- **Don't** hide seal geometry behind a fixed preset or a “simple” mode; the inspector is the product.
- **Don't** silently clip text, let glyphs cross the frame, or export a star/bottom text/number collision.
- **Don't** make the user discover a blocked export only after clicking; state the block above the button.
- **Don't** call the CC BY-ND 崇羲 font open source, subset it, convert it, or modify it; keep its attribution and license file with the app.
- **Don't** use the ID-photo white/blue/red background presets as UI accents, and don't bake the preview guides into an exported photo.