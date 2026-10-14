# Motion plan: Members' Locker Wall

One physical system: steel doors that hinge, name tags that slide in their holders, LEDs that switch like real diodes (fast on, slow decay), and digit reels that roll. Everything on the page moves in one of those four ways.

## Focal sequence

| Moment | Named effect | Job | Tech |
|---|---|---|---|
| A. Lights on | Staggered LED power-on wave + tag slide-in, then headline line-mask reveal | The wall arrives as a room switching on; the stack is counted | GSAP timeline, SplitText (lines, masked), 1.1 s total, skippable by scroll |
| A. Downlight | Lerped pointer spotlight over brushed steel (0.12) | The wall feels like a physical object under a lamp | rAF, CSS custom properties, off on touch and reduced motion |
| A. Tag unfurl | Hover/focus expands a locker's tag into its day-one sentence | Every item has a reason, one tap away | CSS transition on grid rows, 220 ms |
| B. The clear | Pinned scroll-scrubbed state change of the whole wall: hinged door swing (rotateY on the hinge edge, perspective 1200 px) for 10 lockers, LED fade-out, reason stamp, odometer reels 21→11 and $1,428→$661, depth step for the rest (tested forward + amber pulse, your-call recede + ice, keep jade, yours lock) | Shows day-one subtraction, with reasons | ScrollTrigger pin + scrub 0.8, one master timeline |
| C. Fourteen nights | Pinned scrubbed punch card: holes punch row by row (on/off), sleep bars draw, rows regroup into on vs off, averages draw, swing band fades in, verdict stamp lands | Shows how a verdict is earned | ScrollTrigger pin + scrub, Flip-free (transforms computed) |
| C. Effect control | Drag a slider; bars, averages and the verdict update live (Dropped ↔ Inconclusive) | Honesty you can touch | Pointer events, 150 ms state changes |

## Supporting motion

- **Odometer reels** for every tally (stacked 0 to 9 columns, translateY, 600 ms ease-out, stagger 40 ms right to left).
- **Verdict deck** (D): drag, flick or click; spring back with rubber band 0.35; commit at 16% width or 0.45 px/ms; spread 36 px, 1.2° per card.
- **Your wall** (E): chip press `scale(.97)` 100 ms; a new locker slides up into its cell (240 ms); "Distill it" runs the same door swing as B in 900 ms, then Flip compacts the wall (500 ms).
- **Baseline week**: seven LEDs light one per 160 ms when in view, then breathe once.
- **Keycard**: pointer tilt (max 8°) with a moving specular sheen; spring settle on leave.
- **Join**: button press, a reader LED that blinks amber while sending, turns jade on success with a short drawn check.
- **Nav**: hides on scroll down, returns on scroll up (300 ms).
- **Tally readout**: fixed plate, appears after the hero, reels roll as the clear plays.
- **Headline settle** on two H2s only: letter-spacing .03em → 0 with a 20 px rise, 0.8 s.

## Easing and timing tokens

- `--ease-out: cubic-bezier(.16,1,.3,1)` arrivals
- `--ease-in: cubic-bezier(.55,0,1,.45)` exits (faster than arrivals)
- `--ease-door: cubic-bezier(.2,.75,.25,1)` hinges
- Durations: feedback 100 to 150 ms, state 200 to 300 ms, overlays 400 ms, authored entrance 600 to 800 ms.
- Linear only for scrubbed scroll.

## Budget

- Lenis smooth scroll on fine pointers only; native on touch.
- One rAF for the downlight that stops when the pointer is still.
- Pinned stages are the only scroll-linked work; nothing listens to scroll directly.
- No WebGL. Grain is one static SVG tile on a fixed layer.

## Reduced motion

Pins removed; B and C render their end states with legends; reels show final numbers; deck switches instantly; downlight, grain drift and tilt off; LED blinks become steady.
