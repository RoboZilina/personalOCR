# VN-Optimized Japanese Text Validator Design

## Overview
A deterministic, safe, web-friendly, fast, zero-AI, zero-guessing text validator and cleaner specifically tuned for visual novel OCR output. Designed to run in the browser app as a unified post-processing layer for all OCR engines.

## Core Principles
- **Japanese Character Protection**: Never modify kana, kanji, okurigana, particles, honorifics, conjugations, Japanese punctuation, or Japanese spacing.
- **Garbage Removal**: Remove OCR hallucinations, UI debug strings, and stray ASCII after Japanese text.
- **Punctuation Normalization**: Collapse duplicates, normalize mixed punctuation, preserve VN-style ellipses.
- **Smart Spacing**: Remove accidental spaces inside Japanese, insert space between Japanese and Latin, collapse multiple spaces.
- **English‑Only OCR Fixes**: Apply safe substitutions (0→O, 1→l, etc.) only to ASCII‑only segments.
- **VN‑Specific Cleanup**: Remove UI artifacts, progress indicators, debug overlays, trailing punctuation clusters.
- **Heuristic Safety**: Adjust cleanup intensity based on line composition (mostly Japanese, mostly ASCII, mixed).

## Integration Points
1. **Engine‑Level Post‑Processing**: Modify each engine's `postprocess` function in `app.js` to include validation and cleaning.
2. **Unified Validator Module**: Create `js/utils/text_validator.js` exporting the cleaning and validation functions.
3. **Density Filter Retention**: Keep the existing `scoreJapaneseDensity`‑based garbage filter (drop lines with density < -0.5) as a first gate.
4. **Whitespace Handling**: Replace the current aggressive whitespace removal (`text.replace(/\s+/g, '').trim()`) with smart spacing rules.

## Module API

### `scoreJapaneseDensity(text)`
Returns a numeric score: `jp - ascii*0.5 - noise`. Already exists in `app.js`. Will be extended to include additional Japanese ranges (CJK extensions, half‑width katakana, Japanese punctuation).

### `isValidJapanese(text, confidence)`
Optional validation gate (ported from DesktopOCR). May be used for additional filtering.

### `cleanVNText(text)`
Main cleaning function implementing the eight‑layer rule set.

**Signature:** `function cleanVNText(text: string): string`

**Layers:**
1. **Japanese Character Detection** – identify ranges to protect.
2. **Garbage Character Removal** – remove isolated garbage chars (`| > < * _ ~ # ^ ) ( ] [ } { % @ + = ; :`), `[NaN%]`, `[undefined]`, `[object Object]`, stray ASCII after Japanese.
3. **Punctuation Normalization** – collapse duplicates, normalize mixed punctuation, preserve ellipses.
4. **Spacing Rules** – remove spaces inside Japanese, insert space between Japanese and Latin, collapse multiple spaces, remove space before Japanese punctuation.
5. **English‑Only OCR Fixes** – apply substitutions (`0→O`, `1→l`, `rn→m`, `vv→w`, `5→s`, `8→B`) only to ASCII‑only segments.
6. **VN‑Specific Cleanup** – remove UI artifacts (`%` at line end, `[xx%]`), stray ASCII after Japanese, trailing punctuation clusters, leading garbage.
7. **Heuristic Safety** – classify line composition and apply appropriate cleanup intensity.
8. **Final Trim** – trim leading/trailing whitespace.

### `applyVNValidator(lines, separator)`
Combined density filter + cleaning for multi‑line OCR results.

**Signature:** `function applyVNValidator(lines: string[], separator: string = '\n'): string`

**Steps:**
1. Filter out lines where `scoreJapaneseDensity(line) < -0.5`.
2. Map each kept line through `cleanVNText`.
3. Join cleaned lines with `separator`.
4. Return the joined string (or empty string if no lines remain).

## Integration Plan

### 1. Create the Validator Module
- File: `js/utils/text_validator.js`
- Export `cleanVNText`, `applyVNValidator`, `scoreJapaneseDensity` (re‑export).
- Include comprehensive unit tests (later).

### 2. Update Engine Post‑Process Functions
In `app.js`, modify the `engines` registry:

**PaddleOCR** – replace current `postprocess` with:
```js
postprocess: (results) => applyVNValidator(results, '\n')
```

**Tesseract** – replace current `postprocess` with:
```js
postprocess: (results) => applyVNValidator(results, ' ')
```

**MangaOCR** – replace current `postprocess` with:
```js
postprocess: (results) => applyVNValidator(results, '')
```

### 3. Update Whitespace Handling in `addOCRResultToUI`
Replace:
```js
const clean = text.replace(/\s+/g, '').trim();
```
with:
```js
const clean = cleanVNText(text);
```

### 4. Keep History Loading Unchanged
History lines were already cleaned when they were first added; no need to re‑process them. The existing whitespace removal stays for backward compatibility (or we could also apply `cleanVNText` for consistency). Decision: keep as is to avoid surprises.

### 5. Ensure Japanese Character Protection
All cleaning steps must respect the Japanese character ranges. Use a protective mask or pre‑check before substitutions.

## Risk Assessment
- **Low risk** of corrupting Japanese text due to protective layer.
- **Medium risk** of unintended side‑effects on mixed‑language lines (need thorough testing).
- **Low performance impact** (string operations only).
- **High effectiveness** for VN OCR noise reduction.

## Testing Strategy
1. Collect real OCR samples from visual novels (using the app).
2. Create a test suite in `test_validator.html` that runs the validator on sample inputs and compares outputs.
3. Verify that Japanese text remains unchanged while garbage is removed.
4. Ensure no regressions in existing OCR pipeline.

## Next Steps
1. Implement `js/utils/text_validator.js` with the eight‑layer rule set.
2. Integrate into `app.js` as described.
3. Run manual tests with sample OCR outputs.
4. Deploy and monitor for any issues.

## References
- DesktopOCR `validator.py` (logic/validator.py)
- User‑provided VN‑Optimized Japanese OCR Rule Set (in original request)
- Existing `scoreJapaneseDensity` function in `app.js`