# Typography readability — findings and plan

## Rollback

- Git branch `typography/readability`, checkpoint commit `7a8628a`
  (captures the working tree as it stood before any typography change).
- Byte-exact file backup:
  `/private/var/folders/zn/66wsvvn53xvg7nxngqbtym_m0000gn/T/opencode/capital-typography-backup/index.html.pre-typography`
  SHA256 `000678d441dcf04fac1c861b84f4b86f2e3fd908327b117fa6e63b4a3692122b`

Rollback (restores only this task's changes):

    git checkout -- index.html        # back to 7a8628a
    git checkout main && git branch -D typography/readability   # full cleanup

## Files modified by this task

- `index.html` (only file)
- `TYPOGRAPHY-NOTES.md` (this file, new)

## STEP 2 — why the board text is unreadable

Measured, not guessed. At the default framing (`cap3dFitCamera`, fill 0.94) on a
1160px-wide 3D canvas the board spans 17.68 world units at ~61.5 px/unit. One
0.96-unit tile therefore projects to an ~84x48px diamond.

The tile top is a `CanvasTexture`. Mapping the tile's two texture axes through the
camera basis (theta 45deg, phi = iso) gives, per full tile width:

    texture u -> screen (+43.6, -25.1)   len 50.3
    texture v -> screen (-43.6, -25.1)   len 50.3

Both texture axes foreshorten EQUALLY, so the text is not badly distorted — it is
rotated ~30deg and mildly squashed (perpendicular text height is 43.5 against a
50.3 advance). The real fault is simply size and resolution:

    on-screen text height = (fontPx / textureSize) * 43.5

| | before |
|---|---|
| name font | 30px in a 256px texture -> **5.1px on screen** |
| price font | 30px in a 256px texture -> **5.1px on screen** |

So both the name and the price render at roughly 5 physical pixels. That is the
whole problem: not contrast, not the 3D transform.

Secondary faults:

1. **Texture resolution 256** for a tile that is ~84px on screen and ~170px at
   maximum zoom, with `anisotropy=8` hardcoded rather than the device max.
2. **Fixed font sizes picked by string length** (`if name.length>14 ...`) instead of
   measured width, so some labels overflow the 230px max-width and get squeezed.
3. **The colour band eats 17% of the tile** (`fillRect(0,0,W,44)`) while the text is
   crammed into the remaining middle.
4. **The price has no plate** — it is the most useful thing on a tile and is given
   the same treatment as the name.
5. `MORTGAGED` at 26px scrims the tile and lands at y=226, on top of the price.

Hard geometric limit worth stating up front: a tile's baseline is only ~50px on
screen, so at a readable ~11px cap height roughly **6-7 characters fit per line**.
The full names are 10-18 characters ("COMMUNITY CHEST", "Concert Boulevard",
"Императорская пл."), so the board can only ever carry a short label. This matches
the brief's own escape hatch — abbreviate secondary labels, full name in the
property panel. The game already shows a crisp DOM tooltip on hover
(`showTooltip`, `.tt-name` 14px) and a full panel on click, so the exact name is
never lost; it just is not available from the board itself.

## Plan

### STEP 3 — board

- 256 -> 512 texture, anisotropy from `renderer.capabilities.getMaxAnisotropy()`.
- Measured auto-fit (`measureText`) instead of string-length guesses, 1-2 lines.
- Name ~9-13px on screen, price ~12-14px and gold on its own plate.
- Abbreviate street-type suffixes; compact labels for the special tiles.
- Keep the gold trim, navy tile and CAPITAL plaza exactly as they are.

### STEP 4 — rest of the interface

Raise contrast and weight on the low-contrast greys that carry real information
(balances, prices, player names, button labels) rather than resizing everything.

### Deliberately not done

- No camera change. The framing fix from the previous task stays.
- No perspective camera. Isometric ortho is what keeps tile text uniform.
- No global UI scale-up.

---

# Result

## What changed in `index.html`

### Board (3D)

- `cap3dTileTopTexture` rewritten; helpers `cap3dShortLabel`, `cap3dWrapLabel`,
  `cap3dHyphenSplit`, `cap3dFitFont`, `cap3dTileParts`, `cap3dTileGroupColour`,
  `cap3dRoundRect`.
- Tile texture 256 -> 512; anisotropy 8 -> `min(16, device max)`.
- Labels come from the project's own curated `BOARD_SHORT_EN` / `BOARD_SHORT_RU`
  map (which the 2D board already used) rather than a new abbreviation table.
- Colour band 17% -> 10.5% of the tile; name gets the reclaimed height.
- Price gets its own plate, larger and heavier than the name.
- `MORTGAGED` moved to a strip under the price so the number stays readable.

### Interface

- Six greys that failed WCAG AA on the lightest panel background were consolidated
  onto `#8d9aad` (5.75:1). They were: `#69788e` 3.65, `#6f7c90` 3.88, `#718096` 4.09,
  `#758398` 4.26, `#77859a` 4.38, `#78869a` 4.43. All six were text colours; two
  were also `GROUP_UI||...` fallbacks for a swatch background, where the lighter
  grey is an improvement.
- Russian interface labels were sitting a pixel below their English counterparts
  purely because the `html[lang="ru"]` block shrank them. Levelled: auction
  kicker, auction stat labels, property kicker, property stat labels, rent-step
  labels, bot personality tag.
- Player balance: 12px in Russian vs 15px in English -> now 14px. A balance is a
  number and does not get longer in Russian. Player name 12 -> 13px. Bankrupt
  badge 11 -> 12px.

## Measured result, all 40 tiles, both languages

Extracted the real renderer from `index.html` and ran it:

| | before | after |
|---|---|---|
| property name | 5.1px flat | 7.1-16.6px EN / 7.1-17.9px RU |
| price | 5.1px flat | 11.0px on all 31 priced tiles |
| texture | 256 | 512 |

Smallest remaining label is `COMMUNITY CHEST` at 7.1px (EN); the RU worst case
`Императорская` breaks as `Импера-/торская` at 8.2px.

## Verification done

- Both `<script>` blocks parse clean (JavaScriptCore).
- Tile layout checked against the real extracted code for all 40 tiles in both
  languages, with measured `measureText` widths.
- WCAG contrast ratios computed for every grey in the stylesheet against the
  lightest panel background actually in use.
- Visual check: every tile rendered at 100% through the exact projection the
  camera applies (45deg diamond, 35.264deg isometric, board at 94% of a
  1160px viewport) — see
  `.../opencode/shots/full-en.png`, `.../opencode/shots/ru-top.png`.
  Open the page itself at
  `.../opencode/board-typography-compare.html` to compare side by side.

## Verification NOT done — please eyeball the running game

Headless Chrome would not keep an iframe `load` event alive on this page (the
game runs a permanent `requestAnimationFrame` loop), so there is **no
end-to-end boot test** and **no screenshot of the running board**. WebGL did
initialise under software rendering in one attempt, but I could not confirm the
full path. Please load http://127.0.0.1:8000/ and check the 3D board, the
property panel, the auction and a Russian session.

## Deliberately left alone: the 2D board

Its tile type runs `clamp(9px,.68vw,12px)` with `-webkit-line-clamp:2` and
`max-height:2.2em`, plus separate Russian overrides down to 8px. Raising those
would grow the text box inside a fixed `1fr` grid track and can clip. Without
being able to see the result I judged the risk higher than the gain. It is the
one place I would expect more work if you want it.