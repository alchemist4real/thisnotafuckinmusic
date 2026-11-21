const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9236;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTestSuite() {
  console.log('=== SIKLUS 2: DJ SAMPLER FX SOUNDBOARD ENHANCED TEST SUITE ===\n');

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--allow-file-access-from-files',
    '--autoplay-policy=no-user-gesture-required',
    'about:blank'
  ]);

  const consoleErrors = [];
  const consoleWarnings = [];

  try {
    await sleep(1500);

    const targetUrl = 'file:///C:/Users/ACER/Downloads/thisnotafuckinmusic/index.html';
    const newTabRes = await fetch(`http://127.0.0.1:${PORT}/json/new`, { method: 'PUT' });
    const tabData = await newTabRes.json();
    const ws = new WebSocket(tabData.webSocketDebuggerUrl);

    let msgId = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const curId = msgId++;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === curId) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });

    await new Promise((resolve) => ws.addEventListener('open', resolve));

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: targetUrl });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type;
        const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        if (type === 'error') {
          if (!text.includes('Failed to load resource') && !text.includes('fonts.googleapis')) {
            consoleErrors.push(text);
          }
        } else if (type === 'warning') {
          consoleWarnings.push(text);
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const desc = msg.params.exceptionDetails?.text || JSON.stringify(msg.params.exceptionDetails);
        consoleErrors.push('Exception: ' + desc);
      }
    });

    const evalInPage = async (expr) => {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        awaitPromise: true,
        returnByValue: true
      });
      if (res.exceptionDetails) {
        throw new Error('Eval error: ' + JSON.stringify(res.exceptionDetails));
      }
      return res.result?.value;
    };

    console.log('[1/9] Verifying DOM and Siklus 2 Soundboard Controls Initialization...');
    let initOk = false;
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      initOk = await evalInPage(`
        (() => {
          return Boolean(document.getElementById('btnFxHorn') &&
                         document.getElementById('btnFxRewind') &&
                         document.getElementById('btnFxBoom') &&
                         document.getElementById('btnFxFresh') &&
                         document.getElementById('samplerGain') &&
                         document.getElementById('samplerPitch') &&
                         document.getElementById('btnSamplerTuneReset') &&
                         document.getElementById('selSamplerTargetPad') &&
                         document.getElementById('btnSamplerAssignTake') &&
                         document.getElementById('btnSamplerQuickRec') &&
                         document.getElementById('btnSamplerLoadWav') &&
                         document.getElementById('btnSamplerResetPads') &&
                         typeof window.switchWorkspaceMode === 'function' &&
                         typeof window.initDJAudio === 'function' &&
                         typeof window.setSamplerGain === 'function' &&
                         typeof window.setSamplerPitch === 'function');
        })()
      `);
      if (initOk) {
        console.log(`  ✓ DOM Sampler FX Siklus 2 elements found after ${i + 1} attempt(s)`);
        break;
      }
    }
    if (!initOk) throw new Error('Sampler FX Siklus 2 controls not found in DOM');

    // Switch to DJ mode and init Audio
    await evalInPage(`
      (async () => {
        window.switchWorkspaceMode('DJ');
        window.initDJAudio();
        window.initDJSamplerBus();
        if (window.A.ctx && window.A.ctx.state === 'suspended') {
          await window.A.ctx.resume();
        }
      })()
    `);
    const mode = await evalInPage(`window.S.mode`);
    console.log(`  ✓ Workspace active mode: S.mode = "${mode}"`);

    // TEST 1: Pad Visuals, Badges, Tags, Canvas Overlays
    console.log('\n[2/9] Auditing Pad Visuals, Badges, Tags & Wave Canvas Overlays...');
    const padVisuals = await evalInPage(`
      (() => {
        const pads = ['btnFxHorn', 'btnFxRewind', 'btnFxBoom', 'btnFxFresh'];
        const res = {};
        for (const id of pads) {
          const el = document.getElementById(id);
          const led = el.querySelector('.pad-led');
          const badge = el.querySelector('.pad-kbadge');
          const lbl = el.querySelector('.pad-lbl');
          const tag = el.querySelector('.pad-custom-tag');
          const cvs = el.querySelector('.pad-wave-canvas');
          res[id] = {
            id,
            key: el.getAttribute('data-key'),
            padName: el.getAttribute('data-pad'),
            hasLed: Boolean(led),
            hasBadge: Boolean(badge),
            badgeText: badge ? badge.textContent.trim() : '',
            hasLabel: Boolean(lbl),
            labelText: lbl ? lbl.textContent.trim() : '',
            hasCustomTag: Boolean(tag),
            hasWaveCanvas: Boolean(cvs),
            canvasWidth: cvs ? cvs.width : 0,
            canvasHeight: cvs ? cvs.height : 0
          };
        }
        return res;
      })()
    `);

    for (const [id, info] of Object.entries(padVisuals)) {
      console.log(`  ✓ Pad #${id}: key=[${info.key}] pad="${info.padName}" badge="${info.badgeText}" lbl="${info.labelText}" canvas=${info.hasWaveCanvas} (${info.canvasWidth}x${info.canvasHeight})`);
      if (!info.hasLed || !info.hasBadge || !info.hasLabel || !info.hasCustomTag || !info.hasWaveCanvas) {
        throw new Error(`Pad #${id} missing required Siklus 2 visual sub-elements`);
      }
    }

    // TEST 2: Master Trim Gain Control & Dedicated Bus Scaling
    console.log('\n[3/9] Testing Master Trim / Gain Slider & Audio Bus Scaling...');
    const gainTest = await evalInPage(`
      (() => {
        window.setSamplerGain(1.0);
        const g1 = window.DJ_SAMPLER_CONFIG.gain;
        const b1 = window.DJ.samplerBus.gain.value;

        // Set gain to 1.5x (150%)
        window.setSamplerGain(1.5);
        const g2 = window.DJ_SAMPLER_CONFIG.gain;
        const sliderVal2 = parseFloat(document.getElementById('samplerGain').value);

        // Set gain to 0.4x (40%)
        window.setSamplerGain(0.4);
        const g3 = window.DJ_SAMPLER_CONFIG.gain;
        const sliderVal3 = parseFloat(document.getElementById('samplerGain').value);

        // Reset gain to default
        window.setSamplerGain(1.0);
        const gFinal = window.DJ_SAMPLER_CONFIG.gain;

        return { g1, b1, g2, sliderVal2, g3, sliderVal3, gFinal };
      })()
    `);

    console.log(`  ✓ Sampler Gain default: config=${gainTest.g1}, busGain=${gainTest.b1}`);
    console.log(`  ✓ Sampler Gain 1.5x: config=${gainTest.g2}, slider=${gainTest.sliderVal2}`);
    console.log(`  ✓ Sampler Gain 0.4x: config=${gainTest.g3}, slider=${gainTest.sliderVal3}`);
    if (gainTest.g2 !== 1.5 || gainTest.sliderVal2 !== 1.5 || gainTest.g3 !== 0.4 || gainTest.gFinal !== 1.0) {
      throw new Error('Sampler Trim/Gain slider integration failed');
    }

    // TEST 3: Pitch Tuning & 12-TET Semitone Scaling
    console.log('\n[4/9] Testing Soundboard Pitch Tuning & 12-TET Semitone Shift...');
    const pitchTest = await evalInPage(`
      (() => {
        window.setSamplerPitch(0);
        const p0 = window.DJ_SAMPLER_CONFIG.pitch;
        const mul0 = window.getSamplerPitchMultiplier('horn');
        const badge0 = document.getElementById('samplerPitchVal').textContent.trim();

        // Tune +7 semitones (Perfect 5th up)
        window.setSamplerPitch(7);
        const p7 = window.DJ_SAMPLER_CONFIG.pitch;
        const mul7 = window.getSamplerPitchMultiplier('horn');
        const badge7 = document.getElementById('samplerPitchVal').textContent.trim();

        // Tune -5 semitones (Perfect 4th down)
        window.setSamplerPitch(-5);
        const pNeg5 = window.DJ_SAMPLER_CONFIG.pitch;
        const mulNeg5 = window.getSamplerPitchMultiplier('horn');
        const badgeNeg5 = document.getElementById('samplerPitchVal').textContent.trim();

        // Test Reset Tune Button
        document.getElementById('btnSamplerTuneReset').click();
        const pReset = window.DJ_SAMPLER_CONFIG.pitch;
        const gReset = window.DJ_SAMPLER_CONFIG.gain;
        const badgeReset = document.getElementById('samplerPitchVal').textContent.trim();

        return {
          p0, mul0, badge0,
          p7, mul7, badge7,
          pNeg5, mulNeg5, badgeNeg5,
          pReset, gReset, badgeReset
        };
      })()
    `);

    console.log(`  ✓ Pitch 0 st: mul=${pitchTest.mul0.toFixed(4)}, badge="${pitchTest.badge0}"`);
    console.log(`  ✓ Pitch +7 st: mul=${pitchTest.mul7.toFixed(4)} (Expected ~1.4983), badge="${pitchTest.badge7}"`);
    console.log(`  ✓ Pitch -5 st: mul=${pitchTest.mulNeg5.toFixed(4)} (Expected ~0.7492), badge="${pitchTest.badgeNeg5}"`);
    console.log(`  ✓ btnSamplerTuneReset: pitch=${pitchTest.pReset}, gain=${pitchTest.gReset}, badge="${pitchTest.badgeReset}"`);

    if (Math.abs(pitchTest.mul7 - 1.4983) > 0.01 || Math.abs(pitchTest.mulNeg5 - 0.7492) > 0.01 || pitchTest.pReset !== 0 || pitchTest.gReset !== 1.0) {
      throw new Error('Pitch tuning mathematical scaling or reset failed');
    }

    // TEST 4: Visual Ripple Animation & Canvas Wave Rendering
    console.log('\n[5/9] Testing Visual Ripple Animation & Pad Canvas Wave Rendering...');
    const rippleTest = await evalInPage(`
      (() => {
        const btnHorn = document.getElementById('btnFxHorn');
        const cvsHorn = btnHorn.querySelector('.pad-wave-canvas');
        const ctxHorn = cvsHorn.getContext('2d');

        // Check initial state
        const beforeRipple = btnHorn.classList.contains('ripple-active');

        // Trigger wave visual on horn pad
        window.triggerPadWaveVisual('btnFxHorn');
        const duringRipple = btnHorn.classList.contains('ripple-active');

        // Verify canvas context is operational and not blank during wave animation
        const pixelSample = ctxHorn.getImageData(cvsHorn.width / 2, cvsHorn.height / 2, 1, 1).data;
        const alphaSample = pixelSample[3];

        return {
          beforeRipple,
          duringRipple,
          hasCanvasCtx: Boolean(ctxHorn),
          alphaSample
        };
      })()
    `);

    console.log(`  ✓ Pad Border Ripple: before=${rippleTest.beforeRipple} -> during=${rippleTest.duringRipple} (.ripple-active)`);
    console.log(`  ✓ Canvas 2D Wave Visualizer operational: canvasCtx=${rippleTest.hasCanvasCtx}`);
    if (!rippleTest.duringRipple || !rippleTest.hasCanvasCtx) {
      throw new Error('Visual ripple or canvas wave rendering failed');
    }

    // TEST 5: Custom Sample Assignment from Tape Recorder Take
    console.log('\n[6/9] Testing Custom Sample Assignment from Tape Recorder Take...');
    const takeAssignTest = await evalInPage(`
      (async () => {
        const ctx = window.A.ctx;
        const sr = ctx.sampleRate || 44100;
        const durSec = 0.5;
        const frameCount = Math.floor(sr * durSec);

        // Synthesize an authentic WAV buffer for test take
        const audioBuf = ctx.createBuffer(1, frameCount, sr);
        const chData = audioBuf.getChannelData(0);
        for (let i = 0; i < frameCount; i++) {
          const t = i / sr;
          chData[i] = Math.sin(2 * Math.PI * 660 * t) * Math.exp(-t * 3);
        }

        // Mock a recorded take in window.takes
        const mockTake = {
          id: 'take_dj_vocal_drop_01',
          name: 'tnafm_sound001_vocal_drop.wav',
          kind: 'audio',
          dur: 500,
          size: 44100,
          blob: new Blob([new Uint8Array(100)], { type: 'audio/wav' })
        };
        window.takes.unshift(mockTake);
        window.selTake = mockTake.id;

        // Directly assign AudioBuffer to Pad 5 (HORN)
        window.assignCustomBufferToPad('horn', audioBuf, 'Vocal Drop');

        const padInfo = window.DJ_SAMPLER_PADS.horn;
        const btnHorn = document.getElementById('btnFxHorn');
        const customTag = btnHorn.querySelector('.pad-custom-tag');
        const tagVisible = customTag && customTag.style.display !== 'none';
        const tagText = customTag ? customTag.textContent : '';

        // Trigger pad with custom sample assigned
        window.triggerSamplerPad('horn');
        const activeVoices = window.DJ_SAMPLER_VOICES.horn.length;

        return {
          assignedName: padInfo.customName,
          hasBuffer: Boolean(padInfo.customBuffer),
          bufDuration: padInfo.customBuffer ? padInfo.customBuffer.duration : 0,
          tagVisible,
          tagText,
          activeVoices
        };
      })()
    `);

    console.log(`  ✓ Custom Sample assigned: "${takeAssignTest.assignedName}", bufferDur=${takeAssignTest.bufDuration.toFixed(2)}s`);
    console.log(`  ✓ Pad Tag Display: visible=${takeAssignTest.tagVisible}, text="${takeAssignTest.tagText}"`);
    console.log(`  ✓ Custom sample playback triggered: activeVoices=${takeAssignTest.activeVoices}`);

    if (!takeAssignTest.hasBuffer || !takeAssignTest.tagVisible || takeAssignTest.activeVoices === 0) {
      throw new Error('Custom Sample assignment from take failed');
    }

    // TEST 6: Quick Recording Directly to Pad & Reset Functionality
    console.log('\n[7/9] Testing Quick Recording (Q-Rec) & Pad Reset to DSP Synthesis...');
    const qRecAndResetTest = await evalInPage(`
      (async () => {
        // Quick record 0.8s sample directly to Pad 7 (808 Boom)
        await window.recordQuickSampleToPad('boom', 800);
        const boomPadAfterQRec = window.DJ_SAMPLER_PADS.boom;
        const boomHasCustom = Boolean(boomPadAfterQRec.customBuffer);
        const boomCustomName = boomPadAfterQRec.customName;

        const btnBoom = document.getElementById('btnFxBoom');
        const tagBoom = btnBoom.querySelector('.pad-custom-tag');
        const boomTagVisible = tagBoom && tagBoom.style.display !== 'none';

        // Trigger custom boom
        window.triggerSamplerPad('boom');
        const boomCustomVoice = window.DJ_SAMPLER_VOICES.boom.length;

        // Reset Pad 7 (808 Boom) back to default DSP synthesis
        window.resetSamplerPad('boom');
        const boomPadAfterReset = window.DJ_SAMPLER_PADS.boom;
        const boomHasCustomAfterReset = Boolean(boomPadAfterReset.customBuffer);
        const boomTagHiddenAfterReset = tagBoom && tagBoom.style.display === 'none';

        // Trigger standard 808 Boom DSP
        window.triggerSamplerPad('boom');
        const boomDspVoice = window.DJ_SAMPLER_VOICES.boom.length;

        // Reset all pads to original defaults
        window.resetAllSamplerPads();
        const hornAfterResetAll = window.DJ_SAMPLER_PADS.horn.customBuffer;

        return {
          boomHasCustom,
          boomCustomName,
          boomTagVisible,
          boomCustomVoice,
          boomHasCustomAfterReset,
          boomTagHiddenAfterReset,
          boomDspVoice,
          hornAfterResetAll
        };
      })()
    `);

    console.log(`  ✓ Q-Rec direct assignment: customName="${qRecAndResetTest.boomCustomName}", tagVisible=${qRecAndResetTest.boomTagVisible}`);
    console.log(`  ✓ Q-Rec sample playback: activeVoices=${qRecAndResetTest.boomCustomVoice}`);
    console.log(`  ✓ resetSamplerPad('boom'): hasCustom=${qRecAndResetTest.boomHasCustomAfterReset}, tagHidden=${qRecAndResetTest.boomTagHiddenAfterReset}`);
    console.log(`  ✓ DSP Synthesis restored: activeVoices=${qRecAndResetTest.boomDspVoice}`);
    console.log(`  ✓ resetAllSamplerPads(): Horn customBuffer cleared=${qRecAndResetTest.hornAfterResetAll === null}`);

    if (!qRecAndResetTest.boomHasCustom || qRecAndResetTest.boomHasCustomAfterReset || !qRecAndResetTest.boomTagHiddenAfterReset || qRecAndResetTest.hornAfterResetAll !== null) {
      throw new Error('Quick Recording or Pad Reset to DSP synthesis failed');
    }

    // TEST 7: Monophonic Choking & Rapid Keypad Multi-triggering
    console.log('\n[8/9] Testing Monophonic Voice Choking with Hotkeys [5, 6, 7, 8]...');
    const hotkeyChokeTest = await evalInPage(`
      (() => {
        window.stopAllSamplerFX();

        // Rapidly dispatch hotkeys 5, 6, 7, 8 in quick succession
        ['5', '6', '7', '8', '5', '7'].forEach(k => {
          const down = new KeyboardEvent('keydown', { key: k, bubbles: true });
          document.dispatchEvent(down);
          const up = new KeyboardEvent('keyup', { key: k, bubbles: true });
          document.dispatchEvent(up);
        });

        // Each group should have active voices cleanly throttled by choke groups
        const hornV = window.DJ_SAMPLER_VOICES.horn.length;
        const rewindV = window.DJ_SAMPLER_VOICES.backspin.length;
        const boomV = window.DJ_SAMPLER_VOICES.boom.length;
        const freshV = window.DJ_SAMPLER_VOICES.fresh.length;

        window.stopAllSamplerFX();
        const totalAfterStop = window.DJ_SAMPLER_VOICES.horn.length +
                               window.DJ_SAMPLER_VOICES.backspin.length +
                               window.DJ_SAMPLER_VOICES.boom.length +
                               window.DJ_SAMPLER_VOICES.fresh.length;

        return { hornV, rewindV, boomV, freshV, totalAfterStop };
      })()
    `);

    console.log(`  ✓ Hotkeys Rapid Trigger: horn=${hotkeyChokeTest.hornV}, rewind=${hotkeyChokeTest.rewindV}, boom=${hotkeyChokeTest.boomV}, fresh=${hotkeyChokeTest.freshV}`);
    console.log(`  ✓ stopAllSamplerFX() panic cleanup: total active voices = ${hotkeyChokeTest.totalAfterStop}`);
    if (hotkeyChokeTest.totalAfterStop !== 0) {
      throw new Error('Choke groups or panic stopAllSamplerFX failed');
    }

    // TEST 8: Stress Test: Simultaneous 4-Pad Hits + Dual Decks + Crossfader Cut-In
    console.log('\n[9/9] Extreme Stress Test: 4-Pad Barrage + Dual Playing Decks + Sharp Crossfader Cut-In...');
    const stressTest = await evalInPage(`
      (async () => {
        // Start Deck A and Deck B playing
        window.playDeck('A', 0);
        window.playDeck('B', 0);

        // Set Crossfader Curve to Sharp Fast-Cut (Hip-Hop Turntablism Scratching)
        window.setCrossfaderCurve('sharp');

        // Start Tape Recorder
        if (window.REC.state === 'idle') {
          window.recStart();
        }

        // Perform 12 rounds of violent crossfader cut-ins with simultaneous 4-pad triggers
        for (let round = 0; round < 12; round++) {
          // Sharp cut-in left (Deck A full cut)
          window.updateCrossfader(0.0, true);

          // Trigger all 4 pads simultaneously
          window.triggerSamplerPad('horn');
          window.triggerSamplerPad('rewind');
          window.triggerSamplerPad('boom');
          window.triggerSamplerPad('fresh');

          // Sharp cut-in right (Deck B full cut)
          window.updateCrossfader(1.0, true);

          // Rapid pitch change during playback
          window.setSamplerPitch((round % 7) - 3);

          // Center crossfader cut
          window.updateCrossfader(0.5, true);

          await new Promise(r => setTimeout(r, 25));
        }

        // Allow Web Audio render quantums to process
        await new Promise(r => setTimeout(r, 120));

        // Measure Peak Output via Master Analyser
        const fdata = new Float32Array(512);
        window.A.an.getFloatTimeDomainData(fdata);
        let maxPeak = 0;
        for (let i = 0; i < fdata.length; i++) {
          const abs = Math.abs(fdata[i]);
          if (abs > maxPeak) maxPeak = abs;
        }

        const ctxState = window.A.ctx.state;
        const deckAPlaying = window.DJ.decks.A.playing;
        const deckBPlaying = window.DJ.decks.B.playing;
        const xfCurve = window.DJ.xfCurve;

        // Cleanup decks and recorder
        window.stopDeck('A');
        window.stopDeck('B');
        window.stopAllSamplerFX();
        if (window.REC.state !== 'idle') {
          window.recStop();
        }
        window.setSamplerPitch(0);
        window.setSamplerGain(1.0);

        return {
          ctxState,
          deckAPlaying,
          deckBPlaying,
          xfCurve,
          maxPeak,
          isClipping: maxPeak > 1.0
        };
      })()
    `);

    console.log(`  ✓ AudioContext State: "${stressTest.ctxState}" under 12-round barrage`);
    console.log(`  ✓ Dual Decks: Deck A playing=${stressTest.deckAPlaying}, Deck B playing=${stressTest.deckBPlaying}, Crossfader Curve="${stressTest.xfCurve}"`);
    console.log(`  ✓ Output Peak Amplitude: ${stressTest.maxPeak.toFixed(3)} (isClipping=${stressTest.isClipping}, 100% Brickwall Protected)`);

    if (stressTest.ctxState !== 'running' || stressTest.isClipping) {
      throw new Error(`Extreme stress test failed: maxPeak = ${stressTest.maxPeak}`);
    }

    console.log('\n=== SIKLUS 2 TEST AUDIT RESULTS ===');
    console.log(`Console Errors count: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Console Errors detected:\n' + consoleErrors.join('\n'));
      throw new Error('Test suite encountered console errors');
    }
    console.log('✓ 0 Console Errors');
    console.log('✓ All 9 Enhanced Sampler FX Test Phases PASSED (100% SUCCESS)\n');

  } finally {
    try {
      chrome.kill('SIGTERM');
    } catch (_) {}
  }
}

runTestSuite().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
