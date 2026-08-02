#!/bin/sh
set -eu

source_dir="public/reference/11th-edition/maps"
output_dir="public/reference/11th-edition/terrain-masks"
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

mkdir -p "$output_dir"

for source_image in "$source_dir"/layout-*.jpg; do
  filename=$(basename "$source_image" .jpg)
  raw_mask="$work_dir/$filename-raw.png"
  combined_mask="$work_dir/$filename-combined.png"
  canvas="$work_dir/$filename-canvas.png"
  components="$work_dir/$filename-components.txt"

  magick "$source_image" -colorspace sRGB \
    -fx '(r>.48&&r<.80&&abs(r-g)<.07&&abs(r-b)<.08)?1:0' \
    -morphology Open Disk:3 -morphology Close Disk:8 "$raw_mask"
  magick "$source_image" -colorspace sRGB \
    -fx '((r>.48&&r<.80&&abs(r-g)<.07&&abs(r-b)<.08)||(g>.20&&g<.70&&g>r*1.12&&g>b*1.02))?1:0' \
    -morphology Open Disk:3 -morphology Close Disk:8 "$combined_mask"

  magick "$raw_mask" -define connected-components:verbose=true \
    -connected-components 8 null: > "$components" 2>&1
  magick -size 522x708 xc:black "$canvas"

  awk '/gray\(255\)/ && $4 >= 400 { print $2 }' "$components" | while IFS= read -r box; do
    width=$(printf '%s' "$box" | cut -d'x' -f1)
    rest=$(printf '%s' "$box" | cut -d'x' -f2)
    height=$(printf '%s' "$rest" | cut -d'+' -f1)
    x=$(printf '%s' "$rest" | cut -d'+' -f2)
    y=$(printf '%s' "$rest" | cut -d'+' -f3)
    component="$work_dir/component.png"
    holes="$work_dir/holes.png"
    filled="$work_dir/filled.png"
    next_canvas="$work_dir/next-canvas.png"

    magick "$combined_mask" -crop "${width}x${height}+${x}+${y}" +repage "$component"
    magick "$component" -fill white -draw 'color 0,0 floodfill' -negate "$holes"
    magick "$component" "$holes" -evaluate-sequence max "$filled"
    magick "$canvas" "$filled" -geometry "+${x}+${y}" -compose Plus -composite "$next_canvas"
    mv "$next_canvas" "$canvas"
  done

  magick "$canvas" -threshold 50% -type bilevel "$output_dir/$filename.png"
done
