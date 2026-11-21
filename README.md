# 🎹 thisnotafuckinmusic

> **A Retro Windows 98 Dual-Hand Gesture Synthesizer, DJ Console Pro & Lo-Fi Video Recorder**  
> Control polyphonic chords, voicings, continuous filter sweeps, volume, visual energy waves, acoustic strumming (genjrengan), teleprompter lyrics, and two-deck vinyl scratch DJing entirely through hand gestures and local storage in your browser.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/alchemist4real/thisnotafuckinmusic)

![Windows 98 Style](https://img.shields.io/badge/UI-Windows%2098-lightgrey?style=flat-square)
![Web Audio API](https://img.shields.io/badge/Audio-Web%20Audio%20API-blue?style=flat-square)
![MediaPipe Hands](https://img.shields.io/badge/CV-MediaPipe%20Hands-orange?style=flat-square)
![IndexedDB](https://img.shields.io/badge/Storage-100%25%20Local%20IndexedDB-yellow?style=flat-square)
![Pure Client-Side](https://img.shields.io/badge/Architecture-100%25%20Client--Side-green?style=flat-square)

---

## 🌟 Highlights & Features

### 🎸 1. Guitar / Synth Studio Mode
- **Golden Amber Signature Theme**: Authentic high-contrast warm industrial gold & sunflower amber palette (`#B87800` $\rightarrow$ `#FFC820`) replacing standard navy blue, with 7 selectable retro Windows 98 themes (*Golden Amber*, *Windows 98 Classic*, *Lilac Rose*, *Rainy Day*, *Desert Sand*, *Matrix Green*, and *Cyberpunk*).
- **Mode Genjreng (Acoustic Strumming Engine)**:
  - **Downstroke (`D`)**: Strings raked from low bass to high treble with full velocity ($26\text{ ms}$ interval).
  - **Upstroke (`U`)**: Strings raked from high treble to low bass with snappy articulation ($18\text{ ms}$ interval).
  - **Palm Chuk (`X` / `playChuk`)**: Woody acoustic string slap with bandpass noise decay.
  - **Rhythm Patterns**: *Pop Classic* (`D - D U - U D U`), *Straight 8s* (`D - D - D - D`), *Acoustic Folk* (`D X - U - X D U`), *Reggae/Ska* (`- U - U - U - U`), and *Double Time*.
  - **Air-Strumming**: Fretting hand (Left) chooses chord degree, strumming hand (Right) swipes vertically up/down in camera view to trigger strokes physically.
- **Guided Gesture Teleprompter**: On-camera lyrics and chord teleprompter with upcoming chord anticipation and high-visibility gesture badges.
- **Custom Gesture-to-Chord Mapping**: Remap any hand gesture (1 to 7 fingers/shapes) to any chord from your song sheet with one-click **Auto-fill from Sheet**.
- **Studio Vocal Preamp & Dynamic Mix Bus**:
  - **80Hz High-Pass Filter (`A.vocalHPF`)**: Eliminates desk rumble and microphone proximity mud.
  - **3.2kHz Presence Peaking EQ (`A.vocalEQ`)**: +3.2dB boost delivering crisp vocal articulation above thick synth chords.
  - **Opto Leveler Compressor (`A.vocalComp`)**: Smooth, upfront vocal level control.
  - **Isolated Synth Sub-Limiter (`A.synthLim`)**: Prevents synth chords from triggering gain-reduction pumping on your voice.
  - **Master Limiter (`A.lim`)**: Transparent broadcast peak protection.
- **Studio Quick-HUD**: Floating live parameter HUD appearing during Tab / Whole UI recording to adjust Synth Volume, Mic Gain, and Filter Tone on-the-fly.

---

### 🎧 2. DJ Console Pro 98 (<kbd>F2</kbd>)
- **Isolated Dual-Mode Architecture**: Toggle between Guitar Studio and DJ Console instantly via titlebar buttons or keyboard shortcut <kbd>F2</kbd>.
- **Dual Turntables & Platter Scratching**:
  - Interactive vinyl platters on **Deck A** and **Deck B**.
  - Direct tactile scratching via mouse drag, touchscreen touch, or Left-Hand air gestures.
  - Pitch fader ($\pm 8\%$), Master Tempo, and beat **SYNC**.
  - 4 instantaneous **Hot Cues** per deck.
- **2-Channel DJ Mixer**:
  - 3-Band Isolator EQs (High, Mid, Low) with one-click **Kill Bass** per channel.
  - Smooth equal-power cosine crossfader with Right-Hand air gesture support.
- **Stacked Moving Waveforms Canvas**: Real-time dual-color visual playhead tracking for beatmatching.
- **100% Local Storage Crate Engine (`tnafm_crate_db`)**:
  - Native client-side IndexedDB engine storing audio files, cue points, metadata, and playlists completely offline with zero cloud latency.
  - **10 Trending Procedural Tracks & DJ Tools**:
    1. *The Weeknd - Blinding 80s Synthwave* (171 BPM, Fm)
    2. *Drake - OVO Midnight 808 Trap* (140 BPM, Cm)
    3. *The Weeknd - Popular R&B Bounce* (99 BPM, C#m)
    4. *Drake - Rich Flex Dark Drill* (136 BPM, F#m)
    5. *The Weeknd - Starboy French House* (93 BPM, Gm)
    6. *Drake - Passionfruit Afro House* (104 BPM, Dm)
    7. *Kendrick Lamar - Not Like Us West Coast* (101 BPM, Gm)
    8. *Metro Boomin - Heroes Dark Trap* (138 BPM, Dm)
    9. *DJ Tool - Wikka Wikka Scratch Loops* (120 BPM, C)
    10. *Classic 90s Funky Drummer Breakbeat* (125 BPM, Am)
  - **Mini Waveform Preview & Audition Cue**:
    - Real-time 36-bar micro waveform rendering on every table row in Crate Explorer.
    - Dynamic Deck Active coloring: electric cyan (`#00E5FF`) for Deck A, vibrant amber (`#FF9100`) for Deck B.
    - One-click interactive audition preview (4-second Web Audio audition with animated playhead sweep) without loading or interrupting active decks.
  - **Transaction Concurrency & Deadlock Prevention (`CrateTxQueue`)**:
    - Asynchronous serialized execution queue for all readwrite operations preventing IndexedDB transaction collisions, inactive transaction timeouts, and deadlocks during concurrent captures, file imports, and deletions.
  - **Portable Batch Export & Restore Crate (`.cratebundle`)**:
    - One-click backup of the entire local audio crate into compressed gzip `.cratebundle` bundles or uncompressed `.json` multi-track archives.
    - Full preservation of PCM audio blobs (Base64 data URLs), metadata, and computed peak shapes with automatic drag-and-drop restore.
- **Cross-Mode Loop Bridge (`[⏺ Capture to Crate]`)**: Record a 4-bar loop of your live guitar chord progression into a studio-grade 16-bit PCM WAV, saved immediately into your local DJ Crate for scratching on Deck A or Deck B.

---

### 📹 3. WebGL Camcorder Shaders & Multi-Format Recording
- **Tactical Infrared RedShot (`uMode == 5`)**: Tactical 0-Lux ruby night vision with deep carmine shadows, ruby midtones, incandescent warm-white eye/skin bloom, and analog CCD sensor noise.
- **Authentic Sony 1999 Handycam NightShot Fix (`uMode == 3`)**: Milky pale sage-phosphor green (`#9AB8A2`), retroreflective eye glow, skin hotspot bloom, and authentic analog noise.
- **Kodak/Ilford Silver Halide B&W Film Fix (`uMode == 2`)**: Velvety deep blacks paired with radiant clean silver-white highlights.
- **Social Video Formats**: One-click recording in:
  - `9:16` (Instagram Reels, TikTok, YouTube Shorts, IG Stories)
  - `1:1` (Instagram Square Feed)
  - `4:5` (Instagram Portrait Feed)
  - `16:9` (Wide YouTube / Desktop)
  - `4:3` (Vintage TV / Camcorder)
- **Embossed Watermark Frame**: Translucent vintage HUD bezel reading `THISNOTAFUCKINMUSIC · HI-FI CAMCORDER` burned directly onto recordings.
- **Zen Full Video Mode (<kbd>F</kbd>)**: Clean, edge-to-edge camera stage view hiding all Windows 98 chrome. Native fullscreen via <kbd>F11</kbd>.
- **Modular Draggable & Resizable Window Manager**: Free-floating Windows 98 windows with close (`×`) and minimize (`_`) buttons, 3D resize grips, and persistent layouts in `localStorage`.

---

## 🖐️ Gesture Control Mapping

### 🎸 In Guitar / Synth Mode

#### 👈 Left Hand · Chord Degree & Mode
| Gesture | Musical Degree / Action | Description |
|---|---|---|
| **1 Finger (Index)** | **Degree I** | Tonic root chord |
| **2 Fingers** | **Degree II** | Supertonic |
| **3 Fingers** | **Degree III** | Mediant |
| **4 Fingers** | **Degree IV** | Subdominant |
| **5 Fingers** | **Degree V** | Dominant |
| **🤘 Index + Pinky** | **Degree VI** | Submediant |
| **🤟 Index + Pinky + Thumb** | **Degree VII** | Leading tone |
| **✊ Fist** | **Mute / Rest** | Instant silence |
| **Wrist Tilt (Horizontal)** | **Major ↔ Minor Mode** | **Tilt Inward** (`≥ 0`) = Major mode<br>**Tilt Outward** (`< 0`) = Minor mode |

#### 👉 Right Hand · Voicing, Tone & Air-Strumming
| Gesture / Position | Sound Control | Behavior |
|---|---|---|
| **1 Finger** | **Triad** | Root position 4-note spread voicing |
| **2 Fingers** | **1st Inversion** | Bass moves to the 3rd interval |
| **3 Fingers** | **7th Chord** | Major 7th (in Major) or Minor 7th (in Minor) |
| **4 Fingers** | **Dom7 / Dim7** | Dominant 7th (in Major) or Diminished 7th (in Minor) |
| **0 Fingers (Fist / Lowered)** | **Silent** | Mutes sound output when right hand is resting |
| **👍 Thumb Out** | **-8ve Bass** | Drops octave down for warm bass presence |
| **Vertical Height (Y Axis)** | **Continuous Volume** | Higher hand position = Louder; Lower = Softer |
| **Horizontal Tilt (X Axis)** | **Lowpass Filter Sweep** | **Tilt Inward**: Warm acoustic cut down to 250 Hz (Q 2.2)<br>**Tilt Outward**: Bright resonant EDM sweep up to 5000 Hz (Q 5.2) |
| **Vertical Motion (Swipe)** | **Air-Strumming** | Rapid swipe downwards = Downstroke (`D`); rapid swipe upwards = Upstroke (`U`) |

---

### 🎧 In DJ Console Mode (<kbd>F2</kbd>)
| Hand / Gesture | DJ Control | Behavior |
|---|---|---|
| **👈 Left Hand (Horizontal Motion)** | **Deck A Platter Scratch** | Move left/right to scrub and scratch vinyl Deck A |
| **👉 Right Hand (Horizontal Position)** | **Crossfader Curve** | Position across X-axis smoothly transitions audio from Deck A to Deck B |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| <kbd>F2</kbd> | **Toggle Workspace Mode** (Guitar/Synth 98 ⇄ DJ Console Pro 98) |
| <kbd>F</kbd> | **Toggle Zen Full Video Mode** |
| <kbd>F11</kbd> / <kbd>Shift</kbd>+<kbd>F</kbd> | **Toggle Browser Fullscreen** |
| <kbd>Esc</kbd> | **Exit Full Video Mode** |
| <kbd>1</kbd>–<kbd>7</kbd> | Play chord degree I through VII |
| <kbd>Q</kbd> | Triad voicing |
| <kbd>W</kbd> | 1st Inversion voicing |
| <kbd>E</kbd> | 7th chord voicing |
| <kbd>R</kbd> | Dominant / Diminished 7th voicing |
| <kbd>T</kbd> | -8ve Bass drop |
| <kbd>Y</kbd> | Toggle Major ↔ Minor mode |
| <kbd>Space</kbd> | Mute / Stop all audio voices |
| <kbd>Z</kbd> / <kbd>X</kbd> | Shift Octave down / up |
| <kbd>Shift</kbd> + <kbd>C</kbd> | Start / Stop Camera |
| <kbd>Shift</kbd> + <kbd>R</kbd> | Start / Stop Recording |
| <kbd>Shift</kbd> + <kbd>S</kbd> | Take a snapshot photo |
| <kbd>F6</kbd> / <kbd>Shift</kbd>+<kbd>F6</kbd> | Cycle active window focus (Forward / Backward) |
| <kbd>Ctrl</kbd> + <kbd>Tab</kbd> | Cycle active window focus (Win98 MDI style) |
| <kbd>Alt</kbd> + <kbd>F4</kbd> / <kbd>Ctrl</kbd>+<kbd>F4</kbd> | Close currently focused window |
| <kbd>Escape</kbd> | Close active modal dialog or active window |

---

### 🪟 Windows 98 Flexible Window Manager Engine (Siklus 3)

- **Flexible Multi-Window Workspace:** Dock or float any panel (`Recorder`, `Gesture guide`, `Chord picture`, `Chord sheet / Notepad`, `DJ Console Pro 98`, `Audio Crate Explorer`).
- **Retro MDI Window Management:**
  - **F6 / Shift+F6 & Ctrl+Tab:** Cycle focus cleanly across docked & floating windows with physical DOM focus (`tabindex="-1"`) and titlebar active highlights.
  - **Alt+F4 & Escape:** Close the currently focused window with prompt feedback in the status bar.
  - **Cascade & Tile:** Neatly arrange all open floating windows in stepped diagonal cascade or clean multi-column tiled grid from the `View` menu.
  - **High-DPI & Browser Zoom Precision (125%, 150%, 175%):** Cached initial coordinates prevent floating-point subpixel drift during pointer drag and multi-edge resize.
  - **Rapid Float/Dock State Memory:** Preserves remembered floating coordinates (`lastFloat`) across infinite rapid toggles, keeping `localStorage` 100% in sync without state corruption.

### 🎧 DJ Console Panoramic & Dual Decks Pro Engine (Siklus 3)

- **Crossfader Curve Selector (Smooth Blend vs Sharp Fast-Cut):**
  - **`~ Smooth` (Equal-Power Cosine/Sine Blend):** Designed for smooth House & Techno transitions with 18ms rate-smoothing, maintaining equal acoustic energy at the center point (~0.707 gain) without clipping.
  - **`⚡ Sharp Cut` (Hip-Hop Turntablism Scratching):** Fast-cut scratch curve with an ultra-responsive 5% cut-in threshold (both Decks blast at 100% full volume between 0.05 and 0.95 fader travel) and 5ms micro-ramps for instantaneous crab scratching with zero clicks.
- **Beat-Synchronized Auto-Looping (1 Bar, 2 Bars, 4 Bars):**
  - Instant quantized loop slicing aligned to the BPM beat grid.
  - Interactive loop buttons (`1B`, `2B`, `4B`), one-click toggle deactivation, and dedicated `EXIT` loop control.
  - Real-time visual loop highlight overlay with boundary markers and `[🔁 NB]` badge rendered on stacked moving waveforms.
- **Beat Jump Navigation:**
  - `⮜ 1B` and `1B ⮞` instant playback jumps backward or forward by 1 bar (4 beats).
  - Dynamically shifts the active loop window during playback without collapsing or stuttering.
- **Master Bus Transparent Brickwall Limiter:**
  - Dedicated `-1.0 dBFS` dynamic lookahead limiter on `DJ.masterBus` preventing inter-deck summation clipping and DAC distortion during extreme concurrency.
  - Auto-disconnecting transient voice nodes for Airhorn, Backspin, 808 Sub-Bass Boom, Fresh Scratch Stab, and vinyl scratches to guarantee 0 audio buffer underruns and 0 memory leaks under heavy stress.
- **Live Tape Recording Integration:**
  - Direct master mix routing capturing Deck A + Deck B + active scratch gestures + soundboard Pad FX cleanly into the lo-fi Tape Recorder.

---

## 🚀 Running Locally

Because this application runs 100% client-side with zero external build steps, you can serve it with any static web server:

### Option 1: Using Node.js `serve` / `npx`
```bash
npx serve .
# Or if installed:
npm start
```
Then open `http://localhost:3000` (or the port shown).

### Option 2: Using Python 3
```bash
python -m http.server 8080
```
Then open `http://localhost:8080` in Chrome, Edge, or any modern WebGL2-enabled browser.

---

## 👥 Credits & Big Thanks

- **Creator / Developer**: `alchemist4real`
- **OG Synth Wave & Inspiration**: Eric Wei ([Gesture Synth](https://github.com/ericwei97-cloud/gesture-synth))
- **Big Support & Resource**: Mu'afa & Pandya

---

## 📄 License

MIT License &copy; 2026 `alchemist4real`. Enjoy making retro music and video art!
