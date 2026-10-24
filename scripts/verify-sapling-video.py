#!/usr/bin/env python3
"""Check upload limits and extract a contact sheet for human visual review."""
import argparse
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    video = args.video.resolve()
    output = args.out or video.parent / "verification"
    output.mkdir(parents=True, exist_ok=True)
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(video)
    ]))
    duration = float(probe["format"]["duration"])
    streams = probe["streams"]
    checks = {
        "duration_100_to_120_seconds": 100 <= duration <= 120,
        "h264_video": any(s.get("codec_name") == "h264" for s in streams),
        "has_audio": any(s.get("codec_type") == "audio" for s in streams),
        "under_512_MB": video.stat().st_size < 512_000_000,
    }
    sheet = Image.new("RGB", (1920, 1290), "#080f1c")
    draw = ImageDraw.Draw(sheet)
    font_path = "/System/Library/Fonts/Supplemental/Arial.ttf"
    font = ImageFont.truetype(font_path, 20) if Path(font_path).exists() else ImageFont.load_default()
    for index, ratio in enumerate((0.035, 0.15, 0.28, 0.40, 0.52, 0.64, 0.76, 0.86, 0.96)):
        timestamp = min(duration - 0.1, duration * ratio)
        frame = output / f"frame_{index + 1:02d}.jpg"
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(timestamp),
            "-i", str(video), "-frames:v", "1", "-q:v", "2", str(frame)
        ], check=True)
        with Image.open(frame) as image:
            thumb = image.convert("RGB")
            thumb.thumbnail((640, 400))
            x, y = (index % 3) * 640, (index // 3) * 430
            sheet.paste(thumb, (x + (640 - thumb.width) // 2, y))
            draw.text((x + 16, y + 402), f"{timestamp:05.1f}s", font=font, fill="#a7f3d0")
    sheet_path = output / "contact-sheet.jpg"
    sheet.save(sheet_path, quality=92)
    report = {
        "video": str(video), "duration_seconds": duration,
        "size_MB": round(video.stat().st_size / 1_000_000, 2),
        "checks": checks, "ok": all(checks.values()),
        "contact_sheet": str(sheet_path),
        "visual_review": "Pending human/agent inspection; extraction alone does not verify placement or lip sync.",
        "probe": probe,
    }
    (output / "video-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: value for key, value in report.items() if key != "probe"}, indent=2))
    if not report["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
