# table_detector

Detects row/column/cell structure inside a user-selected table region.
Assumes the crop already contains a table (no table-*finding* step) —
only structure *recognition*. Text recognition is fully decoupled: this
module never calls an OCR engine itself.

## Usage

```python
import cv2
from table_detector.orchestrator import detect_table_structure
from table_detector.cell_ocr import fill_cell_text

full_image = cv2.imread("scan.png")            # full-resolution source
crop = full_image[y0:y1, x0:x1]                 # the user's selection

result = detect_table_structure(crop, crop_origin=(x0, y0), rtl=True)
# result -> {crop_origin, crop_size, detection_method, confidence,
#            grid: {rows, cols}, cells: [{row, col, row_span, col_span,
#            bbox_crop, bbox_abs}, ...]}

# Optional: OCR each cell with whichever engine the user has selected.
def my_ocr(cell_image):
    return my_selected_engine.recognize(cell_image)

fill_cell_text(result, full_image, my_ocr)       # adds "text" to each cell
```

`cells[].row/col/row_span/col_span` are the same fields the frontend's
`TableModel` grid already uses, so this JSON can be handed straight to
the JS table-building code (e.g. construct a `<table>` with matching
`rowspan`/`colspan`) without a translation layer.

## Pipeline

```
preprocess (deskew + binarize)
        |
line_grid_detector  -- found a ruling-line grid? ----------------- yes --> build_cells (merges via missing dividers)
        |
       no
        |
blob_detector -> column_finder -> row_grouper (per column) -> row_reconciler (union across columns)
        |
span_detector (horizontal-bridge / merge detection, shared step)
        |
grid_builder (RTL remap, absolute bboxes, final JSON)
```

- **Path A (bordered):** morphological extraction of horizontal/vertical
  ruling lines -> grid -> a missing divider segment between two
  ruling-line-bounded cells means they're merged.
- **Path B (borderless):** connected-component blobs (no OCR involved) ->
  global column bands from an x-axis ink-coverage profile -> per-column
  grouping into text lines, then paragraphs (cells) via gap-size vs.
  median line height -> row bands = the union of overlapping paragraph
  intervals across all columns -> horizontal merges detected by checking
  whether ink actually bridges a normally-empty column gutter for one
  specific row band.
- RTL remap is a deliberately separate final step: everything upstream
  works in plain image x/y, direction-agnostic.

## Known limitations (read before relying on this for tricky scans)

- **Ambiguous floating merged cells (Path B):** if a vertically-merged
  cell's text is centered and doesn't visually overlap either
  neighboring row's content, whitespace geometry alone can't always tell
  "this spans both rows" from "this is its own separate middle row" —
  there's no line to disambiguate it. This is the scenario the original
  spec flagged ML-based table-structure models (Table Transformer,
  PP-Structure/SLANet) as a last-resort escalation for; that escalation
  path isn't implemented here, only geometric detection.
- **Deskew + absolute coordinates:** if a nonzero skew angle is
  corrected internally, `bbox_crop` is in the *deskewed* crop's frame.
  `bbox_abs` is only `crop_origin`-shifted, not un-rotated. For anything
  beyond a couple of degrees of skew, OCR each cell against the
  deskewed crop (returned internally, not currently exposed — easy to
  add if you need it) rather than against the original full-resolution
  image at `bbox_abs`.
- **Path B thresholds are heuristic** (wrap-gap / row-gap factors,
  gutter ratios) and were tuned against synthetic test images, not real
  scans. They'll likely need a pass of tuning against your actual scan
  characteristics (font size range, typical cell padding).
- **Confidence scores are coarse heuristics**, not calibrated
  probabilities — treat them as a rough "flag for user review" signal
  (the doc's intent), not a precise metric.

## Files
- `preprocess.py` — deskew + binarize
- `line_grid_detector.py` — Path A
- `blob_detector.py` — engine-independent text blob detection
- `column_finder.py` — Path B, global column detection
- `row_grouper.py` — Path B, per-column line/paragraph grouping
- `row_reconciler.py` — Path B, cross-column row-band union
- `span_detector.py` — shared merge detection (+ Path B's horizontal-bridge check)
- `grid_builder.py` — final JSON assembly + RTL remap
- `cell_ocr.py` — optional per-cell OCR hookup (engine-agnostic)
- `orchestrator.py` — entry point, ties the above together
