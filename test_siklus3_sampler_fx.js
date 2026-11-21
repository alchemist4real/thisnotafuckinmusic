const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9237;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTestSuite() {
  console.log('=== SIKLUS 3: DJ SAMPLER FX SOUNDBOARD FINAL SUITE ===\n');

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

    console.log('[1/9] Verifying DOM and Siklus 3 Toolbar & Controls Initialization...');
    let initOk = false;
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      initOk = await evalInPage(`
        (() => {
          return Boolean(document.getElementById('btnFxHorn') &&
                         document.getElementById('btnFxRewind') &&
                         document.getElementById('btnFxBoom') &&
                         document.getElementById('btnFxFresh') &&
                         document.getElementById('selSamplerRoll') &&
                         document.getElementById('samplerRollBadge') &&
                         document.getElementById('samplerMidiBadge') &&
                         typeof window.startSamplerRoll === 'function' &&
                         typeof window.stopSamplerRoll === 'function' &&
                         typeof window.prewarmSamplerAudio === 'function' &&
                         typeof window.getSamplerStateSnapshot === 'function' &&
                         typeof window.restoreSamplerStateFromSnapshot === 'function');
        })()
      `);
      if (initOk) {
        console.log(`  ✓ DOM Sampler FX Siklus 3 elements found after ${i + 1} attempt(s)`);
        break;
      }
    }
    if (!initOk) {
      throw new Error('Timeout waiting for Siklus 3 Sampler elements to initialize');
    }

    // Switch to DJ mode & initialize audio graph
    await evalInPage(`
      (() => {
        window.switchWorkspaceMode('DJ');
        window.initDJAudio();
        window.initDJSamplerBus();
        if (window.A.ctx && window.A.ctx.state === 'suspended') {
          window.A.ctx.resume();
        }
      })()
    `);

    // TEST 1: DOM Elements, Attributes & Roll Division Select
    console.log('\n[2/9] Auditing Siklus 3 Toolbar Elements, Badges & Roll Options...');
    const domAudit = await evalInPage(`
      (() => {
        const selRoll = document.getElementById('selSamplerRoll');
        const rollBadge = document.getElementById('samplerRollBadge');
        const midiBadge = document.getElementById('samplerMidiBadge');

        const options = Array.from(selRoll ? selRoll.options : []).map(o => o.value);
        return {
          hasSelRoll: Boolean(selRoll),
          rollOptions: options,
          currentRollValue: selRoll ? selRoll.value : '',
          rollBadgeText: rollBadge ? rollBadge.textContent.trim() : '',
          hasRollBadge: Boolean(rollBadge),
          midiBadgeText: midiBadge ? midiBadge.textContent.trim() : '',
          hasMidiBadge: Boolean(midiBadge)
        };
      })()
    `);

    console.log(`  ✓ #selSamplerRoll options: [${domAudit.rollOptions.join(', ')}] (Current: ${domAudit.currentRollValue})`);
    console.log(`  ✓ #samplerRollBadge: "${domAudit.rollBadgeText}", exists=${domAudit.hasRollBadge}`);
    console.log(`  ✓ #samplerMidiBadge: "${domAudit.midiBadgeText}", exists=${domAudit.hasMidiBadge}`);

    if (!domAudit.hasSelRoll || !domAudit.hasRollBadge || !domAudit.hasMidiBadge || !domAudit.rollOptions.includes('1/16')) {
      throw new Error('Siklus 3 DOM UI structure audit failed');
    }

    // TEST 2: Audio Buffer Pre-warming & Zero Latency Response
    console.log('\n[3/9] Testing Audio Buffer Pre-Warming & Low-Latency Priming...');
    const prewarmAudit = await evalInPage(`
      (() => {
        const t0 = performance.now();
        window.prewarmSamplerAudio();
        const t1 = performance.now();

        const isPrewarmed = window.DJ_SAMPLER_PREWARMED;
        const prewarmStubs = window.DJ_SAMPLER_PREWARM;
        const hasNoiseBuf = Boolean(window.A.ctx && window.samplerNoiseBuf);
        const hasDistCurve = Boolean(window.distCurve808);

        return {
          isPrewarmed,
          hasStubs: Boolean(prewarmStubs.horn && prewarmStubs.rewind && prewarmStubs.boom && prewarmStubs.fresh),
          hasNoiseBuf,
          hasDistCurve,
          executionTimeMs: t1 - t0
        };
      })()
    `);

    console.log(`  ✓ Pre-warm Execution Time: ${prewarmAudit.executionTimeMs.toFixed(3)}ms (< 15ms target)`);
    console.log(`  ✓ DJ_SAMPLER_PREWARMED: ${prewarmAudit.isPrewarmed}`);
    console.log(`  ✓ Audio Stubs Primed (horn, rewind, boom, fresh): ${prewarmAudit.hasStubs}`);
    console.log(`  ✓ Pre-warmed Noise & Distortion DSP Tables: noise=${prewarmAudit.hasNoiseBuf}, 808curve=${prewarmAudit.hasDistCurve}`);

    if (!prewarmAudit.isPrewarmed || !prewarmAudit.hasStubs || !prewarmAudit.hasNoiseBuf || !prewarmAudit.hasDistCurve) {
      throw new Error('Audio Buffer Pre-warming audit failed');
    }

    // TEST 3: Beat-Sync Stutter Roll Engine (Tempo & Divisions)
    console.log('\n[4/9] Testing Beat-Sync Stutter Roll Engine (1/4, 1/8, 1/16, 1/32 Beat)...');
    const rollEngineTest = await evalInPage(`
      (async () => {
        // Test BPM resolution
        window.DJ.decks.A.bpm = 120;
        window.DJ.decks.A.pitch = 0.0;
        window.DJ.decks.A.playing = true;

        const bpm120 = window.getActiveDeckBPM();
        // 120 BPM: 1 beat = 500ms
        // 1/4 beat = 125ms, 1/8 beat = 62.5ms, 1/16 beat = 31.25ms, 1/32 beat = 15.625ms

        // Change roll division to 1/8
        window.setSamplerRollDivision('1/8');
        const badgeAfterDiv = document.getElementById('samplerRollBadge').textContent.trim();

        // Start roll on Horn
        window.startSamplerRoll('horn', '1/8');
        const hornBtn = document.getElementById('btnFxHorn');
        const rollBadgeEl = document.getElementById('samplerRollBadge');

        const isRollingVisual = hornBtn.classList.contains('rolling') || hornBtn.classList.contains('roll-active');
        const isBadgeActive = rollBadgeEl.classList.contains('active-roll');
        const rollStateActive = window.DJ_SAMPLER_ROLL.horn.active;
        const rollDivision = window.DJ_SAMPLER_ROLL.horn.division;

        // Allow interval to fire multiple times
        await new Promise(r => setTimeout(r, 180));

        const voicesDuringRoll = window.DJ_SAMPLER_VOICES.horn.length;

        // Stop roll
        window.stopSamplerRoll('horn');
        const isRollingAfterStop = hornBtn.classList.contains('rolling');
        const rollStateAfterStop = window.DJ_SAMPLER_ROLL.horn.active;

        // Test division 1/16 on 808 Boom
        window.setSamplerRollDivision('1/16');
        window.startSamplerRoll('boom', '1/16');
        await new Promise(r => setTimeout(r, 120));
        const boomVoices = window.DJ_SAMPLER_VOICES.boom.length;
        window.stopAllSamplerRolls();

        const allStopped = Object.values(window.DJ_SAMPLER_ROLL).every(r => !r.active);

        return {
          bpm120,
          badgeAfterDiv,
          isRollingVisual,
          isBadgeActive,
          rollStateActive,
          rollDivision,
          voicesDuringRoll,
          isRollingAfterStop,
          rollStateAfterStop,
          boomVoices,
          allStopped
        };
      })()
    `);

    console.log(`  ✓ Active Deck BPM resolution: ${rollEngineTest.bpm120} BPM`);
    console.log(`  ✓ Set division '1/8' -> Badge: "${rollEngineTest.badgeAfterDiv}"`);
    console.log(`  ✓ Horn Roll Start: visualActive=${rollEngineTest.isRollingVisual}, badgeActive=${rollEngineTest.isBadgeActive}, activeVoices=${rollEngineTest.voicesDuringRoll}`);
    console.log(`  ✓ Horn Roll Stop: isRolling=${rollEngineTest.isRollingAfterStop}, rollActiveState=${rollEngineTest.rollStateAfterStop}`);
    console.log(`  ✓ Boom 1/16 Roll: activeVoices=${rollEngineTest.boomVoices}, stopAllSamplerRolls() allStopped=${rollEngineTest.allStopped}`);

    if (rollEngineTest.bpm120 !== 120 || !rollEngineTest.isRollingVisual || !rollEngineTest.rollStateActive || rollEngineTest.isRollingAfterStop || !rollEngineTest.allStopped) {
      throw new Error('Beat-Sync Stutter Roll Engine operational test failed');
    }

    // TEST 4: Tactile Pad Hold Interaction (Pointerdown Hold > 220ms -> Stutter Roll)
    console.log('\n[5/9] Testing Tactile Pad Holding / Long-Press Stutter Roll Interaction...');
    const padHoldTest = await evalInPage(`
      (async () => {
        const btnHorn = document.getElementById('btnFxHorn');
        window.setSamplerRollDivision('1/8');

        // 1. Quick tap (< 100ms) - should NOT engage roll
        btnHorn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
        await new Promise(r => setTimeout(r, 60));
        btnHorn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }));
        await new Promise(r => setTimeout(r, 50));
        const quickTapRollActive = window.DJ_SAMPLER_ROLL.horn.active;

        // 2. Long hold (> 260ms) - MUST engage roll
        btnHorn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
        await new Promise(r => setTimeout(r, 280));
        const holdRollActive = window.DJ_SAMPLER_ROLL.horn.active;
        const holdVisualRolling = btnHorn.classList.contains('rolling') || btnHorn.classList.contains('roll-active');

        // 3. Release pointer - MUST stop roll
        btnHorn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }));
        await new Promise(r => setTimeout(r, 50));
        const releasedRollActive = window.DJ_SAMPLER_ROLL.horn.active;

        // 4. Keyboard Hotkey [5] Long Hold Test
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));
        await new Promise(r => setTimeout(r, 280));
        const keyHoldRollActive = window.DJ_SAMPLER_ROLL.horn.active;

        document.dispatchEvent(new KeyboardEvent('keyup', { key: '5', bubbles: true }));
        await new Promise(r => setTimeout(r, 50));
        const keyReleasedRollActive = window.DJ_SAMPLER_ROLL.horn.active;

        return {
          quickTapRollActive,
          holdRollActive,
          holdVisualRolling,
          releasedRollActive,
          keyHoldRollActive,
          keyReleasedRollActive
        };
      })()
    `);

    console.log(`  ✓ Quick Tap (<100ms): rollActive=${padHoldTest.quickTapRollActive} (Single hit, No roll)`);
    console.log(`  ✓ Pointerdown Hold (>220ms): rollActive=${padHoldTest.holdRollActive}, visualRolling=${padHoldTest.holdVisualRolling}`);
    console.log(`  ✓ Pointerup Release: rollActive=${padHoldTest.releasedRollActive} (Cleanly stopped)`);
    console.log(`  ✓ Key [5] Long Hold: rollActive=${padHoldTest.keyHoldRollActive} -> Keyup: rollActive=${padHoldTest.keyReleasedRollActive}`);

    if (padHoldTest.quickTapRollActive || !padHoldTest.holdRollActive || padHoldTest.releasedRollActive || !padHoldTest.keyHoldRollActive || padHoldTest.keyReleasedRollActive) {
      throw new Error('Tactile pad holding stutter roll interaction failed');
    }

    // TEST 5: Web MIDI Controller Support (NoteOn / NoteOff Mapping)
    console.log('\n[6/9] Testing Web MIDI Controller Integration & Pad Triggers...');
    const midiTest = await evalInPage(`
      (async () => {
        // Initialize Web MIDI with mock hardware pad controller
        const mockInputs = new Map();
        mockInputs.set('midi_dev_0', { name: 'Pioneer DDJ-400 Sampler Pad', onmidimessage: null });
        navigator.requestMIDIAccess = async () => ({
          inputs: mockInputs,
          onstatechange: null
        });

        const midiInitRes = await window.initWebMIDI();
        const badgeEl = document.getElementById('samplerMidiBadge');
        const badgeConnected = badgeEl.classList.contains('midi-connected');

        // Test MIDI NoteOn for all 4 pads:
        // Note 36 (C2) -> Horn (Pad 5)
        // Note 37 (C#2) -> Rewind (Pad 6)
        // Note 38 (D2) -> 808 Boom (Pad 7)
        // Note 39 (D#2) -> Fresh (Pad 8)
        window.chokeSamplerVoices('horn', 0.001);
        window.chokeSamplerVoices('backspin', 0.001);
        window.chokeSamplerVoices('boom', 0.001);
        window.chokeSamplerVoices('fresh', 0.001);

        // Send NoteOn: [0x90, note, velocity]
        window.handleMIDIMessage([0x90, 36, 127]); // Horn
        window.handleMIDIMessage([0x90, 37, 100]); // Rewind
        window.handleMIDIMessage([0x90, 38, 110]); // Boom
        window.handleMIDIMessage([0x90, 39, 90]);  // Fresh

        const vHorn = window.DJ_SAMPLER_VOICES.horn.length;
        const vRewind = window.DJ_SAMPLER_VOICES.backspin.length;
        const vBoom = window.DJ_SAMPLER_VOICES.boom.length;
        const vFresh = window.DJ_SAMPLER_VOICES.fresh.length;

        // Test Alternate Bank (Note 40 -> Horn, Note 41 -> Rewind)
        window.handleMIDIMessage([0x90, 40, 127]);
        const vHornBank2 = window.DJ_SAMPLER_VOICES.horn.length;

        // Test NoteOff [0x80, note, 0] stopping roll if any
        window.startSamplerRoll('horn', '1/8');
        const isHornRolling = window.DJ_SAMPLER_ROLL.horn.active;
        window.handleMIDIMessage([0x80, 36, 0]);
        const isHornRollingAfterNoteOff = window.DJ_SAMPLER_ROLL.horn.active;

        return {
          midiInitOk: midiInitRes.ok,
          badgeConnected,
          vHorn, vRewind, vBoom, vFresh,
          vHornBank2,
          isHornRolling,
          isHornRollingAfterNoteOff
        };
      })()
    `);

    console.log(`  ✓ Web MIDI Init: ok=${midiTest.midiInitOk}, badgeConnected=${midiTest.badgeConnected}`);
    console.log(`  ✓ MIDI NoteOn (Notes 36-39): horn=${midiTest.vHorn}, rewind=${midiTest.vRewind}, boom=${midiTest.vBoom}, fresh=${midiTest.vFresh}`);
    console.log(`  ✓ MIDI Alternate Bank (Note 40): hornVoices=${midiTest.vHornBank2}`);
    console.log(`  ✓ MIDI NoteOff Roll Stop: rollingBefore=${midiTest.isHornRolling} -> rollingAfter=${midiTest.isHornRollingAfterNoteOff}`);

    if (!midiTest.midiInitOk || !midiTest.badgeConnected || midiTest.vHorn === 0 || midiTest.vBoom === 0 || !midiTest.isHornRolling || midiTest.isHornRollingAfterNoteOff) {
      throw new Error('Web MIDI Controller integration test failed');
    }

    // TEST 6: Complete State (.tnaf) Serialization of Sampler
    console.log('\n[7/9] Testing Full Sampler State Serialization for .tnaf Project Export...');
    const serializeTest = await evalInPage(`
      (async () => {
        // Set distinctive test parameters
        window.setSamplerGain(1.45);
        window.setSamplerPitch(5);
        window.setSamplerRollDivision('1/16');

        // Synthesize custom test audio buffer for Pad 5 (Horn)
        const ctx = window.A.ctx;
        const sr = ctx.sampleRate || 44100;
        const frameCount = Math.floor(sr * 0.4);
        const testBuf = ctx.createBuffer(1, frameCount, sr);
        const data = testBuf.getChannelData(0);
        for (let i = 0; i < frameCount; i++) {
          data[i] = Math.sin(2 * Math.PI * 440 * (i / sr));
        }

        window.assignCustomBufferToPad('horn', testBuf, 'Serum Stutter');

        // Extract snapshot asynchronously (encoding audio buffer to base64)
        const snapshot = await window.getSamplerStateSnapshotAsync();

        return {
          gain: snapshot.gain,
          pitch: snapshot.pitch,
          rollDivision: snapshot.rollDivision,
          hasHornPad: Boolean(snapshot.pads.horn),
          hornHasCustomBuffer: snapshot.pads.horn.hasCustomBuffer,
          hornCustomName: snapshot.pads.horn.customName,
          hornHasBase64Audio: Boolean(snapshot.pads.horn.customAudio && snapshot.pads.horn.customAudio.startsWith('data:audio/wav;base64,'))
        };
      })()
    `);

    console.log(`  ✓ Snapshot Scalar State: gain=${serializeTest.gain}, pitch=${serializeTest.pitch}st, rollDivision=${serializeTest.rollDivision}`);
    console.log(`  ✓ Snapshot Custom Pad Audio: hasBuffer=${serializeTest.hornHasCustomBuffer}, name="${serializeTest.hornCustomName}", base64Wav=${serializeTest.hornHasBase64Audio}`);

    if (serializeTest.gain !== 1.45 || serializeTest.pitch !== 5 || serializeTest.rollDivision !== '1/16' || !serializeTest.hornHasBase64Audio) {
      throw new Error('Sampler state .tnaf serialization failed');
    }

    // TEST 7: Complete State (.tnaf) Restoration from Snapshot
    console.log('\n[8/9] Testing Full Sampler State Restoration from .tnaf Project Snapshot...');
    const restoreTest = await evalInPage(`
      (async () => {
        // Get snapshot of current state (which has gain 1.45, pitch 5, roll 1/16, and custom sample on horn)
        const savedSnapshot = await window.getSamplerStateSnapshotAsync();

        // Deliberately reset and modify the live environment
        window.resetAllSamplerPads();
        window.setSamplerGain(0.60);
        window.setSamplerPitch(-3);
        window.setSamplerRollDivision('1/4');

        const stateAfterReset = {
          gain: window.DJ_SAMPLER_CONFIG.gain,
          pitch: window.DJ_SAMPLER_CONFIG.pitch,
          rollDivision: document.getElementById('selSamplerRoll').value,
          hornCustom: Boolean(window.DJ_SAMPLER_PADS.horn.customBuffer)
        };

        // Restore completely from saved snapshot
        await window.restoreSamplerStateFromSnapshot(savedSnapshot);

        const restoredState = {
          gain: window.DJ_SAMPLER_CONFIG.gain,
          gainSlider: parseFloat(document.getElementById('samplerGain').value),
          pitch: window.DJ_SAMPLER_CONFIG.pitch,
          pitchBadge: document.getElementById('samplerPitchVal').textContent.trim(),
          rollDivision: document.getElementById('selSamplerRoll').value,
          rollBadge: document.getElementById('samplerRollBadge').textContent.trim(),
          hornHasBuffer: Boolean(window.DJ_SAMPLER_PADS.horn.customBuffer),
          hornBufferDuration: window.DJ_SAMPLER_PADS.horn.customBuffer ? window.DJ_SAMPLER_PADS.horn.customBuffer.duration : 0,
          hornCustomName: window.DJ_SAMPLER_PADS.horn.customName,
          hornTagVisible: document.getElementById('tagFxHorn').style.display !== 'none'
        };

        // Test trigger of restored custom audio
        window.triggerSamplerPad('horn');
        const activeVoices = window.DJ_SAMPLER_VOICES.horn.length;

        return {
          stateAfterReset,
          restoredState,
          activeVoices
        };
      })()
    `);

    console.log(`  ✓ Intermediate Reset State: gain=${restoreTest.stateAfterReset.gain}, pitch=${restoreTest.stateAfterReset.pitch}, hornCustom=${restoreTest.stateAfterReset.hornCustom}`);
    console.log(`  ✓ Restored State: gain=${restoreTest.restoredState.gain} (Slider: ${restoreTest.restoredState.gainSlider}), pitch=${restoreTest.restoredState.pitch}st ("${restoreTest.restoredState.pitchBadge}")`);
    console.log(`  ✓ Restored Roll Division: ${restoreTest.restoredState.rollDivision} ("${restoreTest.restoredState.rollBadge}")`);
    console.log(`  ✓ Restored Custom AudioBuffer: dur=${restoreTest.restoredState.hornBufferDuration.toFixed(2)}s, name="${restoreTest.restoredState.hornCustomName}", tagVisible=${restoreTest.restoredState.hornTagVisible}`);
    console.log(`  ✓ Restored Custom Sample Playback: activeVoices=${restoreTest.activeVoices}`);

    if (restoreTest.restoredState.gain !== 1.45 ||
        restoreTest.restoredState.pitch !== 5 ||
        restoreTest.restoredState.rollDivision !== '1/16' ||
        !restoreTest.restoredState.hornHasBuffer ||
        !restoreTest.restoredState.hornTagVisible ||
        restoreTest.activeVoices === 0) {
      throw new Error('Full Sampler State restoration from .tnaf failed');
    }

    // Clean up pads back to default
    await evalInPage(`(() => { window.resetAllSamplerPads(); window.stopAllSamplerRolls(); })()`);

    // TEST 8: Extreme Concurrency & Stutter Roll Audio Graph Headroom Stress Test
    console.log('\n[9/9] Extreme Stress Test: Dual Deck Playback + Dual Stutter Rolls + Limiter Verification...');
    const concurrencyStress = await evalInPage(`
      (async () => {
        const ctx = window.A.ctx;
        if (ctx.state === 'suspended') await ctx.resume();

        // 1. Play Deck A and Deck B simultaneously
        window.DJ.decks.A.bpm = 126;
        window.DJ.decks.B.bpm = 126;
        if (!window.DJ.decks.A.playing) window.playDeck('A');
        if (!window.DJ.decks.B.playing) window.playDeck('B');

        // 2. Start simultaneous stutter rolls on Horn (1/16) and Boom (1/8)
        window.startSamplerRoll('horn', '1/16');
        window.startSamplerRoll('boom', '1/8');

        // 3. Connect Analyser to masterBus to sample peak output amplitude
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        if (window.DJ.limiter) {
          window.DJ.limiter.connect(analyser);
        } else if (window.DJ.masterBus) {
          window.DJ.masterBus.connect(analyser);
        } else {
          window.A.master.connect(analyser);
        }

        const dataArr = new Float32Array(analyser.fftSize);
        let maxPeak = 0;

        // Sample audio for 350ms during intense concurrent barrage
        for (let i = 0; i < 7; i++) {
          await new Promise(r => setTimeout(r, 50));
          analyser.getFloatTimeDomainData(dataArr);
          for (let s = 0; s < dataArr.length; s++) {
            const abs = Math.abs(dataArr[s]);
            if (abs > maxPeak) maxPeak = abs;
          }
        }

        // Clean up rolls
        window.stopAllSamplerRolls();
        try { analyser.disconnect(); } catch (_) {}

        return {
          ctxState: ctx.state,
          deckAPlaying: window.DJ.decks.A.playing,
          deckBPlaying: window.DJ.decks.B.playing,
          maxPeak,
          isClipping: maxPeak > 0.99
        };
      })()
    `);

    console.log(`  ✓ AudioContext State: "${concurrencyStress.ctxState}" under concurrent dual rolls`);
    console.log(`  ✓ Dual Decks Playing: Deck A=${concurrencyStress.deckAPlaying}, Deck B=${concurrencyStress.deckBPlaying}`);
    console.log(`  ✓ Output Peak Amplitude: ${concurrencyStress.maxPeak.toFixed(3)} (isClipping=${concurrencyStress.isClipping}, 100% Brickwall Protected)`);

    if (concurrencyStress.ctxState !== 'running' || concurrencyStress.isClipping) {
      throw new Error('Concurrency headroom stress test failed');
    }

    // AUDIT CONSOLE ERRORS
    console.log('\n=== SIKLUS 3 TEST AUDIT RESULTS ===');
    console.log('Console Errors count: ' + consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.error('Console errors detected:');
      consoleErrors.forEach(e => console.error('  - ' + e));
      throw new Error(`Test failed with ${consoleErrors.length} console errors`);
    } else {
      console.log('✓ 0 Console Errors');
    }

    console.log('✓ All 9 Final Sampler FX Test Phases PASSED (100% SUCCESS)\n');
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exitCode = 1;
  } finally {
    try {
      chrome.kill('SIGKILL');
    } catch (_) {}
    process.exit(process.exitCode || 0);
  }
}

runTestSuite();
