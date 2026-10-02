# Project To-Do List

## Review Studio Enhancements
- [ ] Add option to mark wrong words for later review.
- [ ] Add option to add optional margins around bounding boxes, so the user can see if something is missing or not.
- [ ] Add option to add notes/comments on certain boxes (e.g. typos in the original book to highlight/annotate).

## Things to be fixed:
- [ ] When OCRing a page, using google lens, angles are not taken into consideration when drawing the bounding boxes on images. Hence, the bounding boxes are sometimes flipped.

## Things to be added later:
- [ ] There should be an option to automatically replace ayat.
- [ ] A more robust way to detect tables. I was thinking of using qunatized onnx models, something like:
https://huggingface.co/docs/transformers/model_doc/slanet
- [ ] RELIABLE auto-detection of Arabic poetry.
- [ ] Auto-detection of Arabic font.
- [ ] Auto-detection of text color
- [ ] Binarization using ZIGZAG
- [ ] Quantizing the U-Net Binarization model (onnx)
- [ ] Binarization using U-Net
- [ ] Aggregating online datasets for binarized models.
- [ ] Aggregating online datasets for scanned documents containing tables.
