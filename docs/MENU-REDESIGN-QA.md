# Menu redesign validation

## Executed

- `node tools/check.mjs`: passes; one existing informational warning for translation keys referenced dynamically. Includes duplicate-ID validation.
- `node tools/menu-check.mjs`: 70 passing behavior checks (53 at the time of the redesign, 17 added with Settings), executing the real scripts and event handlers against DOM/Canvas test doubles.
- `git diff --check`: passes.

The behavior checks cover first-run language and saved language changes; Home
focus isolation; both languages and all reference tabs; all four difficulties;
Endless and bot-race entry; 2, 3 and 4 local players; insufficient, connected and
disconnected simulated controllers; stable controller slot assignments; Standard
and Custom; every bot count and difficulty; every rule switch; focus retention
after rebuilding controls; local car turns, taken cars, Back undo and random picks;
controller car navigation; pause, resume, quit, results and replay; Escape and
native Enter handling; and the mobile Local Play disabled state.

Gamepad snapshots are supplied only by the test fixture. Production detection
still comes from `navigator.getGamepads()`. Canvas is a test double, so these
checks do not prove visual rendering or native browser focus behavior.

## Browser checks still required

The available cloud browser rejected the local preview with
`net::ERR_BLOCKED_BY_CLIENT`. A local Chromium executable was unavailable and its
official download timed out. No visual walkthrough or browser-console pass is
claimed. Keep this change as a draft until these checks are completed.

| Viewport / preference | Checks |
| --- | --- |
| Narrow portrait phone: 320×568, 390×844 | Language, Home, all solo setup screens, reference tabs, touch targets, long French names, inner scrolling |
| Landscape phone: 844×390 | Back and footer actions remain visible; decision body scrolls; language dialog fits |
| Tablet: 768×1024 | Mode and difficulty layout, reference index, artwork scale |
| Tall narrow desktop: 500×1000 | Full viewport menu composition, keyboard legend, all local setup screens |
| Desktop: 1440×900 | Signature Home, all setup screens, controller bays, showroom and reference index |
| Wide desktop: 1920×1080 | Content bounds, spacing, road integration |
| English and French | No truncation or missing keys; translated ARIA labels |
| Reduced motion | Road and entrance animation stop; all states remain readable |
| Increased contrast / forced colors | Focus, switches, difficulty bars and selected/taken states remain clear |
| No backdrop blur | Language, pause and results have opaque fallback surfaces |

Walk through both solo modes and every local branch with real controllers,
including all player counts, controller disconnect/reconnect, each picking turn,
Back at every step, random picks and unavailable cars. Check native keyboard Tab,
Shift+Tab, Enter, Space and Escape; controller focus and scrolling; touch/mouse;
pause and results. Inspect the browser console throughout.

Explicitly observe the Home road scrolling continuously under normal motion
preferences. Source retains two endlessly animated dashed lane lines, asphalt
edges and striped kerbs, composed as a banked diagonal road. Reduced motion is
the intentional exception. Gameplay source, tuning, race timing and save semantics
are preserved; only the keyboard dispatch around menu button activation changes
outside the menu modules.

---

# Settings system validation

## Executed

- `node tools/check.mjs`: passes; the same single informational warning for
  translation keys referenced dynamically.
- `node tools/menu-check.mjs`: 70 passing behavior checks. The seventeen new ones
  cover opening Settings as a modal, Home staying unreachable behind it, Tab and
  Shift+Tab wrapping inside it, the sound switch against `soundOn` and the master
  gain, volume persistence and its effect on the gain, all three motion states
  against `motionReduced()` and `data-motion`, contrast, control hints, changing
  language without closing the panel, the two-press restore and what it leaves
  alone, and closing by backdrop and by Escape with focus returning to
  `#btnSettings`.
- Headless Chromium (Playwright against the system browser, nothing added to the
  repo) over a local `http-server`: first run, language choice, Settings opened
  from Home, every preference exercised through its own control, a race started
  with sound off, pause, quit, and a reload to confirm the panel paints from
  storage rather than from what it was left showing. No page errors in the
  console. Panel geometry measured at 1280×800, 1900×1000, 520×900, 390×844 and
  740×380: the card is capped inside the gutter at every one, its body scrolls,
  the document itself never scrolls, and `Restore default settings` is reachable.
- `prefers-reduced-motion: reduce` emulated: `motionReduced()` follows the system
  on **System**, is forced true on **Reduced**, and is false on **Full**, with the
  Home road's `animation-name` going `none` / `roadScroll` to match.

## Still required

The sandbox blocks Google Fonts, so the headless pass rendered in fallback faces:
Archivo and IBM Plex line breaks, and long French labels in the segmented rows,
still want a look on a real connection. Also unchecked here: real touch dragging
of the volume slider, VoiceOver/NVDA on the switches and segmented groups, and a
browser without `backdrop-filter` (the opaque fallback now covers `#settingsCard`
and both dialog backdrops, but it has not been observed).
