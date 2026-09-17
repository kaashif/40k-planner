"""Extract timestamped evidence frames without retaining a full broadcast.

uv run --with yt-dlp --with imageio-ffmpeg --with pillow python scripts/sample-vod.py VIDEO_ID --times 637 1200 --out .cache/vod/pilot
Signed media URLs remain in memory. No browser cookies or credentials are used.
"""
import argparse
import concurrent.futures
import json
from pathlib import Path
import subprocess

import imageio_ffmpeg
from PIL import Image, ImageDraw
import yt_dlp


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video_id")
    parser.add_argument("--times", nargs="+", type=int, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if any(t < 0 for t in args.times):
        parser.error("Timestamps must be non-negative seconds")
    args.out.mkdir(parents=True, exist_ok=True)
    with yt_dlp.YoutubeDL({
        "quiet": True, "noplaylist": True,
        "format": "bestvideo[height<=1080][protocol=https]/best[height<=1080]/best",
        "js_runtimes": {"node": {}},
    }) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={args.video_id}", download=False)
    metadata = {k: info.get(k) for k in ("id", "title", "channel", "duration", "upload_date", "webpage_url", "chapters", "description")}
    (args.out / "source.json").write_text(json.dumps(metadata, indent=2))
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

    def capture(second):
        target = args.out / f"{second:06d}.jpg"
        if target.exists():
            return target
        proc = subprocess.run([
            ffmpeg, "-hide_banner", "-loglevel", "error", "-ss", str(second),
            "-i", info["url"], "-frames:v", "1", "-q:v", "3", "-y", str(target),
        ], capture_output=True, timeout=90)
        if proc.returncode or not target.exists():
            # ffmpeg errors may contain signed URLs; never print raw stderr.
            raise RuntimeError(f"Frame extraction failed at {second}s (exit {proc.returncode})")
        print(f"Captured {second}s: {target}", flush=True)
        return target

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        paths = list(pool.map(capture, args.times))
    width, height, columns = 480, 294, 3
    sheet = Image.new("RGB", (width * columns, height * ((len(paths) + columns - 1) // columns)), "#111820")
    draw = ImageDraw.Draw(sheet)
    for i, path in enumerate(paths):
        im = Image.open(path).convert("RGB")
        im.thumbnail((width, 270))
        x, y = (i % columns) * width, (i // columns) * height
        sheet.paste(im, (x, y))
        sec = args.times[i]
        draw.text((x + 8, y + 274), f"{sec//3600:02d}:{sec//60%60:02d}:{sec%60:02d} | {sec}s", fill="white")
    sheet.save(args.out / "contact-sheet.jpg", quality=85)


if __name__ == "__main__":
    main()
