#!/bin/sh
set -eu

# Compatibility wrapper. The OpenCV generator is documented in
# docs/layout-regeneration.md and installs its isolated dependency through uv.
uv run --with opencv-python python scripts/generate_terrain_masks.py "$@"
