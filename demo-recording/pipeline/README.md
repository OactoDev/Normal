# Normal demo video pipeline

One command generates per-scene ElevenLabs speech, records real app interactions,
optionally lip-syncs the supplied face, and exports a captioned 1920×1200 H.264 MP4.
The example scene file produces a 1:44 Sapling demo. It never approves or executes a plan.

```bash
./demo-recording/pipeline/make_video.sh \
  demo-recording/pipeline/scenes.json \
  "$HOME/Downloads/Movie on 24-10-2026 at 12.35.mov" \
  demo-recording/sapling/Normal_Sapling_Quest.mp4
```

Requirements: Python 3 with Pillow; Node.js + Playwright; ffmpeg/ffprobe; a running
Normal app at `http://localhost:3100`. The example matches the `normal-demo`
launcher in the workspace's `.claude/launch.json`. Browser capture uses a temporary
headless Chrome context; no sign-in is needed for the local app. Set `EXE` for
another installed Chromium executable and `PLAYWRIGHT_MODULE` for another installed
Playwright package. The default macOS Chrome executable is auto-selected.

Secrets are read only from `~/.config/elevenlabs/kris_api_key`; the key is never
written into the repository, printed, or placed on the command line. Speech uses
`eleven_multilingual_v2` and voice `rsG3bwQLHQmLztP16wvR`. Requests send narration
text to ElevenLabs. Cached MP3 originals avoid repeat paid requests when rerunning;
`atempo` applies the configured speech speed without changing voice pitch.

Wav2Lip uses the installation at `~/.cache/kris-lipsync/` with its own Python venv
and `Wav2Lip/checkpoints/wav2lip_gan.pth`. The included compatibility wrapper enables
Apple MPS, handles current librosa, accelerates detection at 360 px while preserving
720 px output, and passes ffmpeg arguments safely for paths containing spaces.
Set `WAV2LIP_HOME`, `WAV2LIP_PYTHON`, or `WAV2LIP_WRAPPER` to override installation
paths. A centered720 px crop is made forward+reverse before inference.

Use `--no-lipsync` for a still portrait on the title/end cards only, or
`--synced-face /absolute/path/to/synced_face.mp4` to reuse already generated lip sync.
The supplied synced face must use the same final `narration.wav` timing.

Each stage can run independently with the same three positional arguments:

- `--tts-only`: cached per-scene audio → padded scene WAVs, `durations.json`, `narration.wav`.
- `--record-only`: actual UI actions → `screen_raw.webm`, `marks.json`, and scene screenshots.
- `--composite-only --synced-face …`: existing screen/audio/face → final video.
- `--composite-only --no-lipsync`: existing screen/audio → final video, portrait only on cards.

Generated files live beside the output in `<output-name>.work/`; override with
`--work-dir`. Keep this directory and all generated media out of Git. The final
`verification.json` records duration, file size, and face mode. The exporter checks
100–120 seconds and under 512 MiB. Title/end holds pad a short narration to 104 seconds;
if narration exceeds 119 seconds the script stops for a real edit. Do not fake or
speed up live verdicts to fit a scene.

## Scenes

`scenes.json` contains narration, UI action, lower-third caption, and optional
`leadSeconds`/`holdSeconds` per scene. `speechSpeed` defaults 1.0; this example uses 0.9
for clear delivery. The `targetSeconds` setting defaults 104.

Supported actions:

- `title` / `end-card`: rendered branded HTML with optional repository link.
- `goto-tab {tab, primeScenario?}`: open the app and tab; optionally make an actual
  preliminary scenario run so the Policy Gate can be explained before the next run.
- `scroll {testId}`: show an existing UI section.
- `run-scenario {sev, expected, showReview?, hoverBlocked?}`: click the app's named
  scenario preset, run the real diagnosis, and assert the returned verdict.
  `showReview` generates a plan and shows merchant approval controls, leaving them untouched.
- `click {testId|selector, waitForTestId?, focusTestId?}`: real UI click and wait.

Recorder screenshots/marks retain actual live verdicts, probabilities, latencies,
and endpoint responses. Unexpected results stop the recording; reword supported
stress evidence or remove an unreliable scene, then rerun speech if narration changes.
The recorder does not fill forms: scenario presets are app buttons. It never
presses Escape or clicks an approval/execute control. Cursor highlighting and
email redaction are visual recording aids only.

Captions are rendered as transparent PNGs with Pillow, so ffmpeg needs no drawtext
or subtitles module. Set `VIDEO_FONT` to a local TrueType font on another platform.
`VIDEO_PRESET=veryfast` trades a little file size for faster export.
