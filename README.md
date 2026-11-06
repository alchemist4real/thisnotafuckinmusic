# 🎹 thisnotafuckinmusic

> **A Retro Windows 98 Dual-Hand Gesture Synthesizer & Lo-Fi Video Recorder**  
> Control polyphonic chords, voicings, continuous filter sweeps, volume, and visual energy waves entirely through hand gestures in your browser.

![Windows 98 Style](https://img.shields.io/badge/UI-Windows%2098-lightgrey?style=flat-square)
![Web Audio API](https://img.shields.io/badge/Audio-Web%20Audio%20API-blue?style=flat-square)
![MediaPipe Hands](https://img.shields.io/badge/CV-MediaPipe%20Hands-orange?style=flat-square)
![Pure Client-Side](https://img.shields.io/badge/Architecture-100%25%20Client--Side-green?style=flat-square)

---

## 🌟 Highlights

- **Dual-Hand Computer Vision Control**: Powered by `@mediapipe/hands`, completely client-side in real-time.
- **Accurate Harmonic Theory Engine**: Select any chromatic key (C through B), scale degree (I to VII), and swap between Major & Minor modes on the fly.
- **Dynamic Sound Energy Wave (`drawEnergy`)**: Real-time multi-harmonic ribbon animation across the video canvas responding to chord degree colors, volume thickness, and filter chaos.
- **Real-Time OSD Heads-Up Display**: 8-segment volume meter (`VOL ■■■■■□□□`), live filter sweep readout (`FILTER: +XX%`), and octave status badges.
- **Authentic Windows 98 Desktop Aesthetic**: Dockable tool windows, bevelled 3D buttons, pixel typography, interactive chord diagrams (Piano, Guitar, Ukulele), and chord sheet editor.
- **Retro WebGL Shaders**: Authentic Camcorder CRT, Digicam, Black & White, and Nightshot green infrared filters.
- **Built-in Audio/Video Tape Recorder**: Capture your performance directly to WebM or MP4 with limiter protection, microphone pass-through, and zero audio clipping.

---

## 🖐️ Gesture Control Mapping

Based on the interactive model of [Gesture Synth](https://github.com/ericwei97-cloud/gesture-synth):

### 👈 Left Hand · Chord Selection & Mode

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

---

### 👉 Right Hand · Expression, Voicing, Filter & Volume

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

---

## ⌨️ Keyboard Shortcuts

If you prefer playing with the keyboard or don't have a webcam handy:

- <kbd>1</kbd>–<kbd>7</kbd>: Play chord degree I through VII
- <kbd>Q</kbd>: Triad voicing
- <kbd>W</kbd>: 1st Inversion voicing
- <kbd>E</kbd>: 7th chord voicing
- <kbd>R</kbd>: Dominant / Diminished 7th voicing
- <kbd>T</kbd>: -8ve Bass drop
- <kbd>Y</kbd>: Toggle Major ↔ Minor mode
- <kbd>Space</kbd>: Mute / Stop
- <kbd>Z</kbd> / <kbd>X</kbd>: Shift Octave down / up
- <kbd>Shift</kbd> + <kbd>C</kbd>: Start / Stop Camera
- <kbd>Shift</kbd> + <kbd>R</kbd>: Start / Stop Recording
- <kbd>Shift</kbd> + <kbd>S</kbd>: Take a snapshot photo

---

## 🚀 Quick Start

No installation or build steps required!

1. Clone or download this repository:
   ```bash
   git clone https://github.com/alchemist4real/thisnotafuckinmusic.git
   ```
2. Open `index.html` in any modern web browser (Google Chrome, Microsoft Edge, or Safari recommended for camera & MediaRecorder support).
3. Click **Start camera**, hold up your hands, and start creating music!

### Hosting on GitHub Pages
1. Go to repository **Settings** $\rightarrow$ **Pages**.
2. Under **Build and deployment**, set branch to `main` and folder to `/ (root)`.
3. Save, and your synthesizer will be live worldwide instantly!

---

## 📜 Credits & Acknowledgments

- Gesture mapping and dynamic harmonic synthesis logic inspired by **Eric Wei's** [Gesture Synth](https://github.com/ericwei97-cloud/gesture-synth).
- Computer vision tracking powered by Google's [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker).
- Sound engine built with native [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).

---

## 📄 License

MIT License © 2026 alchemist4real
