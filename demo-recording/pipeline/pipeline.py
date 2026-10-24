#!/usr/bin/env python3
"""Rerunnable TTS → real browser recording → optional lip sync → composite."""
import argparse
import concurrent.futures
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

HERE = Path(__file__).resolve().parent


def run(args, **kw):
    return subprocess.run([str(x) for x in args], check=True, **kw)


def probe(path):
    result = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path], capture_output=True, text=True)
    return float(json.loads(result.stdout)["format"]["duration"])


def save_json(path, data):
    Path(path).write_text(json.dumps(data, indent=2) + "\n")


def tts(config, work):
    key_file = Path.home() / ".config/elevenlabs/kris_api_key"
    if not key_file.is_file():
        raise RuntimeError(f"ElevenLabs key file missing: {key_file}")
    key = key_file.read_text().strip()
    voice = config.get("voiceId", "rsG3bwQLHQmLztP16wvR")
    model = config.get("modelId", "eleven_multilingual_v2")
    audio_dir = work / "audio"
    audio_dir.mkdir(exist_ok=True)

    def one(index_scene):
        i, scene = index_scene
        settings = config.get("voiceSettings", {"stability": 0.48, "similarity_boost": 0.80, "style": 0.18, "use_speaker_boost": True})
        cache_key = hashlib.sha256(json.dumps([voice, model, settings, scene["narration"]], ensure_ascii=False).encode()).hexdigest()[:16]
        audio = audio_dir / f"{i:02d}-{scene['id']}-{cache_key}.mp3"
        if not audio.is_file():
            req = urllib.request.Request(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
                data=json.dumps({"text": scene["narration"], "model_id": model,
                                 "voice_settings": settings}).encode(),
                headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
                method="POST")
            try:
                with urllib.request.urlopen(req, timeout=100) as response:
                    content = response.read()
                audio.write_bytes(content)
            except urllib.error.HTTPError as exc:
                # Do not print request headers, credentials, or opaque response bodies.
                raise RuntimeError(f"ElevenLabs scene {scene['id']} failed: HTTP {exc.code}") from None
        speed = float(config.get("speechSpeed", 1.0))
        if not 0.75 <= speed <= 1.25:
            raise RuntimeError("speechSpeed must be between0.75 and1.25")
        source = audio
        if speed != 1.0:
            source = audio.with_name(audio.stem + f"-speed-{speed}.wav")
            run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", audio,
                 "-af", f"atempo={speed}", "-ar", "44100", "-ac", "1", source])
        seconds = probe(source)
        print(f"Voice {scene['id']}: {seconds:.2f} s", flush=True)
        return {"id": scene["id"], "source": str(source), "speechSeconds": seconds,
                "leadSeconds": scene.get("leadSeconds", 0.25),
                "holdSeconds": scene.get("holdSeconds", 0.65)}

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        pieces = list(executor.map(one, enumerate(config["scenes"])))
    total = sum(x["speechSeconds"] + x["leadSeconds"] + x["holdSeconds"] for x in pieces)
    target = max(100.0, float(config.get("targetSeconds", 104)))
    if total < target:
        extra = target - total
        pieces[0]["holdSeconds"] += extra * 0.35
        pieces[-1]["holdSeconds"] += extra * 0.65
    elapsed = 0.0
    chunks = []
    for i, piece in enumerate(pieces):
        piece["startSeconds"] = round(elapsed, 6)
        seconds = piece["speechSeconds"] + piece["leadSeconds"] + piece["holdSeconds"]
        chunk = audio_dir / f"{i:02d}-padded.wav"
        delay = round(piece["leadSeconds"] * 1000)
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", piece["source"],
             "-af", f"adelay={delay}:all=1,apad", "-t", f"{seconds:.6f}",
             "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", chunk])
        # PCM samples determine the exact timeline, not MP3 container rounding.
        piece["durationSeconds"] = probe(chunk)
        elapsed += piece["durationSeconds"]
        piece["endSeconds"] = round(elapsed, 6)
        chunks.append(chunk)
    if elapsed > 119:
        raise RuntimeError(f"Narration is {elapsed:.1f}s; shorten scenes before recording (limit119s)")
    concat = audio_dir / "concat.txt"
    concat.write_text("".join("file '" + str(x).replace("'", "'\\''") + "'\n" for x in chunks))
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", concat,
         "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", work / "narration.wav"])
    result = {"totalSeconds": round(elapsed, 6), "scenes": pieces}
    save_json(work / "durations.json", result)
    print(f"Narration ready: {work / 'narration.wav'} ({elapsed:.2f} s)", flush=True)
    return result


def record(config_path, work):
    run(["node", HERE / "record.cjs", config_path, work / "durations.json", work])


def lipsync(face, work):
    root = Path(os.environ.get("WAV2LIP_HOME", str(Path.home() / ".cache/kris-lipsync/Wav2Lip")))
    python = Path(os.environ.get("WAV2LIP_PYTHON", str(root.parent / "venv/bin/python")))
    wrapper = Path(os.environ.get("WAV2LIP_WRAPPER", str(HERE / "run_wav2lip.py")))
    output = work / "face_synced.mp4"
    seconds = probe(work / "narration.wav")
    prepared = work / "face_pp.mp4"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", face,
         "-filter_complex", "[0:v]fps=25,scale=720:720:force_original_aspect_ratio=increase,crop=720:720,split[f][r];[r]reverse[rev];[f][rev]concat=n=2:v=1:a=0[v]",
         "-map", "[v]", "-t", str(seconds), "-an", "-c:v", "libx264", "-preset", "fast", prepared])
    env = dict(os.environ, WAV2LIP_WORK_DIR=str(work / "lipsync"))
    run([python, wrapper, "--checkpoint_path", root / "checkpoints/wav2lip_gan.pth",
         "--face", prepared, "--audio", work / "narration.wav", "--resize_factor", "1",
         "--pads", "0", "15", "0", "0", "--face_det_batch_size", "8",
         "--wav2lip_batch_size", "32", "--outfile", output], env=env)
    return output


def caption_assets(config, work):
    from PIL import Image, ImageDraw, ImageFont
    font_path = os.environ.get("VIDEO_FONT", "/System/Library/Fonts/Supplemental/Arial.ttf")
    font = ImageFont.truetype(font_path, 31)
    label_font = ImageFont.truetype(font_path, 19)
    assets = work / "overlays"
    assets.mkdir(exist_ok=True)
    for i, scene in enumerate(config["scenes"]):
        im = Image.new("RGBA", (1920, 1200))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((40, 1028, 1408, 1160), radius=20, fill=(3, 12, 22, 242), outline=(45, 79, 83, 255), width=2)
        d.rectangle((40, 1054, 46, 1132), fill=(52, 211, 153, 255))
        d.text((70, 1046), f"{i + 1:02d}  /  {scene.get('label', scene['id']).upper()}", font=label_font, fill=(52, 211, 153))
        words = scene["caption"].split()
        lines, line = [], ""
        for word in words:
            candidate = (line + " " + word).strip()
            if d.textlength(candidate, font=font) > 1280 and line:
                lines.append(line)
                line = word
            else:
                line = candidate
        lines.append(line)
        d.multiline_text((70, 1077), "\n".join(lines), font=font, fill=(238, 245, 248), spacing=6)
        im.save(assets / f"caption-{i}.png")
    for size in (340, 450):
        ring = Image.new("RGBA", (size + 12, size + 12))
        d = ImageDraw.Draw(ring)
        d.ellipse((1, 1, size + 10, size + 10), fill=(3, 12, 22, 255), outline=(52, 211, 153, 255), width=4)
        ring.save(assets / f"ring-{size}.png")
    return assets


def composite_plain(config, work, output):
    duration = json.loads((work / "durations.json").read_text())["totalSeconds"]
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", work / "screen_raw.webm", "-i", work / "narration.wav",
         "-filter_complex", f"[0:v]scale=1920:1200:flags=lanczos,setsar=1,fps=25[v];[1:a]afade=t=in:st=0:d=0.12,afade=t=out:st={max(0,duration-.3):.6f}:d=0.3[a]",
         "-map", "[v]", "-map", "[a]", "-t", str(duration), "-c:v", "libx264", "-preset", os.environ.get("VIDEO_PRESET", "fast"),
         "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output])
    actual = probe(output)
    save_json(work / "verification.json", {"durationSeconds": actual, "bytes": output.stat().st_size, "lipSync": False,
        "faceMode": "none (plain: screen and narration only)", "output": str(output)})
    print(f"Video ready: {output} ({actual:.2f} s)", flush=True)


def composite(config, work, face, output, synced):
    timing = json.loads((work / "durations.json").read_text())
    duration = timing["totalSeconds"]
    assets = caption_assets(config, work)
    # Input0 screen,1 narration,2 face,3/4 emerald rings, then one caption per scene.
    args = ["ffmpeg", "-hide_banner", "-y", "-i", work / "screen_raw.webm", "-i", work / "narration.wav"]
    args += (["-i", face] if synced else ["-loop", "1", "-framerate", "1", "-i", work / "face_still.jpg"])
    for size in (340, 450):
        args += ["-loop", "1", "-framerate", "1", "-i", assets / f"ring-{size}.png"]
    for i in range(len(config["scenes"])):
        args += ["-loop", "1", "-framerate", "1", "-i", assets / f"caption-{i}.png"]
    first_end = timing["scenes"][0]["endSeconds"]
    last_start = timing["scenes"][-1]["startSeconds"]
    ends = f"lt(t,{first_end:.6f})+gte(t,{last_start:.6f})"
    middle = f"gte(t,{first_end:.6f})*lt(t,{last_start:.6f})"
    filters = ["[0:v]scale=1920:1200:flags=lanczos,setsar=1,fps=25[screen]"]
    # RGBA circle preserves actual face pixels; nothing about a live verdict is changed.
    filters += ["[2:v]setpts=PTS-STARTPTS,fps=25,split=2[faceS][faceL]"]
    for name, size in (("S", 340), ("L", 450)):
        filters.append(f"[face{name}]scale={size}:{size}:force_original_aspect_ratio=increase,crop={size}:{size},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(pow(X-W/2,2)+pow(Y-H/2,2),pow(W/2-1,2)),255,0)'[circle{name}]")
    filters += [f"[screen][4:v]overlay=W-w-35:H-h-35:enable='{ends}'[ringL]",
                f"[ringL][circleL]overlay=W-w-41:H-h-41:enable='{ends}'[large]"]
    if synced:
        filters += [f"[large][3:v]overlay=W-w-35:H-h-35:enable='{middle}'[ringS]",
                    f"[ringS][circleS]overlay=W-w-41:H-h-41:enable='{middle}'[pip]"]
    else:
        # Consume unused branch so ffmpeg graph remains well-formed.
        filters += ["[circleS]nullsink", "[3:v]nullsink", "[large]null[pip]"]
    previous = "pip"
    for i, scene in enumerate(timing["scenes"]):
        out = f"cap{i}"
        filters.append(f"[{previous}][{5+i}:v]overlay=0:0:enable='gte(t,{scene['startSeconds']:.6f})*lt(t,{scene['endSeconds']:.6f})'[{out}]")
        previous = out
    filters.append(f"[1:a]afade=t=in:st=0:d=0.12,afade=t=out:st={max(0,duration-.3):.6f}:d=0.3[audio]")
    graph = work / "composite.ffgraph"
    graph.write_text(";\n".join(filters))
    args += ["-filter_complex_script", graph, "-map", f"[{previous}]", "-map", "[audio]", "-t", str(duration),
             "-c:v", "libx264", "-preset", os.environ.get("VIDEO_PRESET", "fast"), "-crf", "20", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-threads", "4", output]
    run(args)
    actual = probe(output)
    size = output.stat().st_size
    if not 100 <= actual <= 120:
        raise RuntimeError(f"Final duration {actual:.3f}s outside100–120s")
    if size >= 512 * 1024 * 1024:
        raise RuntimeError("Video exceeds512MiB")
    save_json(work / "verification.json", {"durationSeconds": actual, "bytes": size, "lipSync": synced,
        "faceMode": "synced circular PiP" if synced else "still portrait on title and end cards only",
        "output": str(output)})
    print(f"Video ready: {output} ({actual:.2f} s, {size/1024/1024:.1f} MiB)", flush=True)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("scenes", type=Path)
    p.add_argument("face", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--work-dir", type=Path)
    p.add_argument("--no-lipsync", action="store_true", help="Use a still face on opening/closing cards only")
    p.add_argument("--synced-face", type=Path, help="Reuse a previously produced lip-synced video")
    p.add_argument("--tts-only", action="store_true")
    p.add_argument("--record-only", action="store_true")
    p.add_argument("--composite-only", action="store_true")
    args = p.parse_args()
    config_path = args.scenes.resolve()
    config = json.loads(config_path.read_text())
    if not config.get("scenes"):
        raise RuntimeError("scenes.json has no scenes")
    if len({s["id"] for s in config["scenes"]}) != len(config["scenes"]):
        raise RuntimeError("Scene IDs must be unique")
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    work = (args.work_dir or output.with_suffix(".work")).resolve()
    work.mkdir(parents=True, exist_ok=True)
    save_json(work / "scenes.used.json", config)
    if args.tts_only:
        tts(config, work)
        return
    if args.record_only:
        record(config_path, work)
        return
    if not args.composite_only:
        tts(config, work)
        record(config_path, work)
    if config.get("plain"):
        composite_plain(config, work, output)
        return
    synced = args.synced_face
    if not args.no_lipsync and not synced:
        synced = lipsync(args.face.resolve(), work)
    if not synced:
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "2", "-i", args.face.resolve(),
             "-frames:v", "1", "-vf", "scale=720:720:force_original_aspect_ratio=increase,crop=720:720", work / "face_still.jpg"])
    composite(config, work, synced or args.face.resolve(), output, bool(synced))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"Pipeline stopped: {exc}", file=sys.stderr)
        sys.exit(1)
