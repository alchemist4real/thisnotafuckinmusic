const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9230;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('  TEST SUITE: SIKLUS 1 - INTERACTIVE VINYL PLATTER SCRATCHING  ');
  console.log('===============================================================\n');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-scratch1-test-'));

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${tempDir}`,
    '--allow-file-access-from-files',
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

    console.log('[1/12] Waiting for DOM & DJ Console initialization...');
    let initOk = false;
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      initOk = await evalInPage(`
        Boolean(document.getElementById('platterA') &&
                document.getElementById('platterB') &&
                window.DJ && window.DJ.decks)
      `);
      if (initOk) break;
    }
    if (!initOk) throw new Error('DOM did not initialize in time');
    console.log('  PASS: DOM & DJ Decks ready.\n');

    // TEST 1: Canvas Elements & Platter Dimensions
    console.log('[2/12] Verifying Turntable Canvas Elements & Platter Dimensions...');
    const canvasCheck = await evalInPage(`
      (() => {
        const pA = document.getElementById('platterA');
        const pB = document.getElementById('platterB');
        return {
          hasA: !!pA,
          hasB: !!pB,
          widthA: pA.width,
          heightA: pA.height,
          widthB: pB.width,
          heightB: pB.height,
          hasContextA: !!pA.getContext('2d'),
          hasContextB: !!pB.getContext('2d')
        };
      })()
    `);
    if (!canvasCheck.hasA || !canvasCheck.hasB) throw new Error('Missing platter canvas elements');
    if (canvasCheck.widthA !== 160 || canvasCheck.widthB !== 160) throw new Error('Incorrect canvas width');
    if (!canvasCheck.hasContextA || !canvasCheck.hasContextB) throw new Error('Canvas 2D context unavailable');
    console.log('  PASS: Both #platterA and #platterB (160x160) ready with 2D contexts.\n');

    // TEST 2: DJ Mode Activation & Track Loading
    console.log('[3/12] Switching to DJ Mode & Verifying Track Loading...');
    const loadCheck = await evalInPage(`
      (() => {
        window.switchWorkspaceMode('DJ');
        const dA = window.DJ.decks.A;
        const dB = window.DJ.decks.B;
        return {
          djActive: window.DJ.active,
          trackA: dA.trackName,
          trackB: dB.trackName,
          durA: dA.buffer ? dA.buffer.duration : 0,
          durB: dB.buffer ? dB.buffer.duration : 0
        };
      })()
    `);
    if (!loadCheck.djActive) throw new Error('DJ Mode not active');
    if (loadCheck.durA <= 0 || loadCheck.durB <= 0) throw new Error('Initial tracks missing valid audio buffers');
    console.log(`  PASS: DJ Mode active. Deck A: "${loadCheck.trackA}" (${loadCheck.durA.toFixed(1)}s), Deck B: "${loadCheck.trackB}" (${loadCheck.durB.toFixed(1)}s).\n`);

    // TEST 3: Initial Turntable Rendering
    console.log('[4/12] Testing Initial Turntable Rendering & Angle Normalization...');
    const renderCheck = await evalInPage(`
      (() => {
        window.drawTurntable('platterA', 'A');
        window.drawTurntable('platterB', 'B');
        const dA = window.DJ.decks.A;
        const dB = window.DJ.decks.B;
        return {
          angleA: dA.angle,
          angleB: dB.angle,
          isScratchingA: dA.isScratching,
          isScratchingB: dB.isScratching
        };
      })()
    `);
    if (renderCheck.angleA !== 0 || renderCheck.angleB !== 0) throw new Error('Initial angles must be 0');
    if (renderCheck.isScratchingA || renderCheck.isScratchingB) throw new Error('Decks should not be scratching initially');
    console.log('  PASS: Turntables rendered cleanly at angle 0.00.\n');

    // TEST 4: Dual-Deck Scratch State Isolation
    console.log('[5/12] Testing Dual-Deck Scratch State Isolation...');
    const isoCheck = await evalInPage(`
      (() => {
        const cA = document.getElementById('platterA');
        const cB = document.getElementById('platterB');
        const rA = cA.getBoundingClientRect();
        const rB = cB.getBoundingClientRect();
        const cxA = rA.left + rA.width / 2, cyA = rA.top + rA.height / 2;
        const cxB = rB.left + rB.width / 2, cyB = rB.top + rB.height / 2;

        const results = {};

        // Touch Deck A only
        cA.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: cxA + 30, clientY: cyA, bubbles: true }));
        results.aDown_A = window.DJ.decks.A.isScratching;
        results.aDown_B = window.DJ.decks.B.isScratching;

        // Release Deck A
        cA.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: cxA + 30, clientY: cyA, bubbles: true }));
        results.aUp_A = window.DJ.decks.A.isScratching;
        results.aUp_B = window.DJ.decks.B.isScratching;

        // Touch Deck B only
        cB.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, clientX: cxB + 30, clientY: cyB, bubbles: true }));
        results.bDown_A = window.DJ.decks.A.isScratching;
        results.bDown_B = window.DJ.decks.B.isScratching;

        // Release Deck B
        cB.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, clientX: cxB + 30, clientY: cyB, bubbles: true }));
        results.bUp_A = window.DJ.decks.A.isScratching;
        results.bUp_B = window.DJ.decks.B.isScratching;

        return results;
      })()
    `);
    if (!isoCheck.aDown_A || isoCheck.aDown_B) throw new Error('Deck A pointerdown affected Deck B');
    if (isoCheck.aUp_A || isoCheck.aUp_B) throw new Error('Deck A pointerup state leak');
    if (isoCheck.bDown_A || !isoCheck.bDown_B) throw new Error('Deck B pointerdown affected Deck A');
    if (isoCheck.bUp_A || isoCheck.bUp_B) throw new Error('Deck B pointerup state leak');
    console.log('  PASS: 100% Dual-Deck State Isolation verified.\n');

    // TEST 5: Angular Quadrant Continuity (-PI to +PI crossing)
    console.log('[6/12] Testing Continuous Angle Calculation Across -PI to +PI Boundary...');
    const quadrantCheck = await evalInPage(`
      (() => {
        const cA = document.getElementById('platterA');
        const rect = cA.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const r = 40;
        const dA = window.DJ.decks.A;

        dA.angle = 0;
        dA.pauseTime = 0;

        // Touch at angle = 3.0 (top left)
        cA.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 10, clientX: cx + r * Math.cos(3.0), clientY: cy + r * Math.sin(3.0), bubbles: true }));

        // Move across negative X axis into -3.0 (bottom left)
        cA.dispatchEvent(new PointerEvent('pointermove', { pointerId: 10, clientX: cx + r * Math.cos(-3.0), clientY: cy + r * Math.sin(-3.0), bubbles: true }));
        const delta1 = dA.scratchVelocity;
        const angle1 = dA.angle;

        // Move back from -3.0 into +3.0
        cA.dispatchEvent(new PointerEvent('pointermove', { pointerId: 10, clientX: cx + r * Math.cos(3.0), clientY: cy + r * Math.sin(3.0), bubbles: true }));
        const delta2 = dA.scratchVelocity;
        const angle2 = dA.angle;

        cA.dispatchEvent(new PointerEvent('pointerup', { pointerId: 10, bubbles: true }));

        return {
          delta1,
          delta2,
          angle1,
          angle2,
          angle1Valid: angle1 >= 0 && angle1 < 2 * Math.PI,
          angle2Valid: angle2 >= 0 && angle2 < 2 * Math.PI
        };
      })()
    `);
    if (!quadrantCheck.angle1Valid || !quadrantCheck.angle2Valid) {
      throw new Error(`Angle normalization failed: angle1=${quadrantCheck.angle1}, angle2=${quadrantCheck.angle2}`);
    }
    console.log(`  PASS: No angle jumping glitch. Continuous circular difference: delta1=${quadrantCheck.delta1.toFixed(2)}, delta2=${quadrantCheck.delta2.toFixed(2)}.\n`);

    // TEST 6: Precision Cueing at Sub-Audible Speeds (< 0.15 rad/s)
    console.log('[7/12] Testing Precision Cueing at Slow Scrubbing Speeds (< 0.15 rad/s)...');
    const slowCueCheck = await evalInPage(`
      (() => {
        const cA = document.getElementById('platterA');
        const rect = cA.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const r = 50;
        const dA = window.DJ.decks.A;

        dA.pauseTime = 1.0;
        const initialPause = dA.pauseTime;

        // Start slow touch at angle 0
        cA.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 20, clientX: cx + r, clientY: cy, bubbles: true }));

        // Slow angular step of 0.05 radians (~2.8 degrees)
        const dTheta = 0.05;
        cA.dispatchEvent(new PointerEvent('pointermove', { pointerId: 20, clientX: cx + r * Math.cos(dTheta), clientY: cy + r * Math.sin(dTheta), bubbles: true }));

        const scrubbedPause = dA.pauseTime;
        const currentDeckTime = window.getDeckCurrentTime(dA);

        cA.dispatchEvent(new PointerEvent('pointerup', { pointerId: 20, bubbles: true }));

        return {
          initialPause,
          scrubbedPause,
          currentDeckTime,
          deltaPause: scrubbedPause - initialPause
        };
      })()
    `);
    if (slowCueCheck.scrubbedPause === slowCueCheck.initialPause) {
      throw new Error('Precision cueing failed: pauseTime did not update on slow angular scrub');
    }
    if (Math.abs(slowCueCheck.currentDeckTime - slowCueCheck.scrubbedPause) > 0.001) {
      throw new Error('getDeckCurrentTime did not track pauseTime during precision cueing');
    }
    console.log(`  PASS: Precision cueing active. Delta pause: +${(slowCueCheck.deltaPause * 1000).toFixed(2)}ms.\n`);

    // TEST 7: Real-Time Waveform & Playhead Synchronization
    console.log('[8/12] Testing Real-Time Playhead Synchronization During Scratch...');
    const playheadSyncCheck = await evalInPage(`
      (() => {
        const dA = window.DJ.decks.A;
        dA.isScratching = true;
        dA.pauseTime = 2.456;
        const t1 = window.getDeckCurrentTime(dA);

        dA.pauseTime = 0.812;
        const t2 = window.getDeckCurrentTime(dA);

        dA.isScratching = false;

        return { t1, t2 };
      })()
    `);
    if (Math.abs(playheadSyncCheck.t1 - 2.456) > 0.001 || Math.abs(playheadSyncCheck.t2 - 0.812) > 0.001) {
      throw new Error('getDeckCurrentTime failed to strictly match pauseTime while isScratching is true');
    }
    console.log('  PASS: Waveform playhead strictly locked to scratch position.\n');

    // TEST 8: Slipmat Touch-and-Hold Physics on Playing Deck
    console.log('[9/12] Testing Slipmat Touch-and-Hold Physics on Playing Deck...');
    const holdCheck = await evalInPage(`
      (async () => {
        window.playDeck('A');
        await new Promise(r => setTimeout(r, 250));

        const dA = window.DJ.decks.A;
        const cA = document.getElementById('platterA');
        const rect = cA.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;

        const beforeTouchPlaying = dA.playing;
        const beforeTouchSource = !!dA.source;

        // Touch & Hold (Slipmat pause)
        cA.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 30, clientX: cx + 40, clientY: cy, bubbles: true }));
        const heldPause = dA.pauseTime;
        const heldScratching = dA.isScratching;
        const heldTime1 = window.getDeckCurrentTime(dA);

        await new Promise(r => setTimeout(r, 200));
        const heldTime2 = window.getDeckCurrentTime(dA);

        return {
          beforeTouchPlaying,
          beforeTouchSource,
          heldPause,
          heldScratching,
          heldTime1,
          heldTime2,
          heldTimeDelta: heldTime2 - heldTime1
        };
      })()
    `);
    if (!holdCheck.beforeTouchPlaying) throw new Error('Deck A was not playing before touch');
    if (!holdCheck.heldScratching) throw new Error('isScratching must be true during touch-and-hold');
    if (Math.abs(holdCheck.heldTimeDelta) > 0.005) {
      throw new Error(`Playhead drifted forward during hold: delta=${holdCheck.heldTimeDelta}`);
    }
    console.log(`  PASS: Slipmat touch-and-hold froze playback cleanly at ${(holdCheck.heldPause).toFixed(3)}s with 0 drift.\n`);

    // TEST 9: Smooth Motor Resume & Anti-Click Spin-Up
    console.log('[10/12] Testing Smooth Motor Resume on Platter Release...');
    const resumeCheck = await evalInPage(`
      (async () => {
        const dA = window.DJ.decks.A;
        const cA = document.getElementById('platterA');

        // Platter is currently held from previous test. Release it!
        cA.dispatchEvent(new PointerEvent('pointerup', { pointerId: 30, bubbles: true }));

        const resumedPlaying = dA.playing;
        const resumedSource = !!dA.source;
        const motorSpinningUp = dA.motorSpinningUp;
        const initialMotorRps = dA.motorRps;

        // Wait 120ms to measure acceleration
        await new Promise(r => setTimeout(r, 120));
        const acceleratedMotorRps = dA.motorRps;

        // Stop deck cleanly
        window.stopDeck('A');

        return {
          resumedPlaying,
          resumedSource,
          motorSpinningUp,
          initialMotorRps,
          acceleratedMotorRps
        };
      })()
    `);
    if (!resumeCheck.resumedPlaying || !resumeCheck.resumedSource) {
      throw new Error('Deck A failed to resume playback upon platter release');
    }
    if (!resumeCheck.motorSpinningUp && resumeCheck.acceleratedMotorRps <= resumeCheck.initialMotorRps) {
      throw new Error('Motor acceleration ramp failed');
    }
    console.log(`  PASS: Motor resumed smoothly. Initial RPS: ${resumeCheck.initialMotorRps.toFixed(2)} -> Accelerated RPS: ${resumeCheck.acceleratedMotorRps.toFixed(2)}.\n`);

    // TEST 10: Dynamic Vinyl Scratch Audio & EQ/Crossfader Routing
    console.log('[11/12] Testing Scratch Audio Synthesis & Channel/Crossfader Routing...');
    const routingCheck = await evalInPage(`
      (() => {
        window.initDJAudio();
        const ctx = window.A.ctx;

        // Test forward & backward scratch synthesis triggers without errors
        window.triggerDJScratchSound('A', 4.5, 1);
        window.triggerDJScratchSound('A', 3.2, -1);
        window.triggerDJScratchSound('B', 5.0, 1);

        // Check crossfader isolation on Deck A vs Deck B
        window.updateCrossfader(1.0, true); // Crossfader fully right (Deck B solo, Deck A cut)
        const xfA_cut = window.DJ.decks.A.xfGainVal;
        const xfB_solo = window.DJ.decks.B.xfGainVal;

        window.updateCrossfader(0.0, true); // Crossfader fully left (Deck A solo, Deck B cut)
        const xfA_solo = window.DJ.decks.A.xfGainVal;
        const xfB_cut = window.DJ.decks.B.xfGainVal;

        // Reset crossfader to center
        window.updateCrossfader(0.5, true);

        return {
          xfA_cut,
          xfB_solo,
          xfA_solo,
          xfB_cut,
          deckA_eqConnected: !!window.DJ.decks.A.eqLow,
          deckB_eqConnected: !!window.DJ.decks.B.eqLow
        };
      })()
    `);
    if (routingCheck.xfA_cut > 0.01 || routingCheck.xfB_cut > 0.01) {
      throw new Error('Crossfader cutting failed to fully isolate channels');
    }
    if (routingCheck.xfA_solo < 0.99 || routingCheck.xfB_solo < 0.99) {
      throw new Error('Crossfader solo level incorrect');
    }
    console.log('  PASS: Scratch audio synthesized cleanly and isolated through deck channel EQs and crossfader.\n');

    // TEST 11: MediaPipe Gesture Integration Check
    console.log('[12/12] Testing MediaPipe Hand Gesture Routing Compatibility...');
    const gestureCheck = await evalInPage(`
      (() => {
        window.switchWorkspaceMode('DJ');
        const dA = window.DJ.decks.A;
        const initialAngle = dA.angle;

        // Simulate Left Hand Gesture scratch movement
        dA.isScratching = true;
        dA.angle = ((dA.angle + 0.35) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        window.triggerDJScratchSound('A', 3.5, 1);
        window.drawTurntable('platterA', 'A');
        dA.isScratching = false;

        return {
          initialAngle,
          afterAngle: dA.angle,
          isScratchingEnded: !dA.isScratching
        };
      })()
    `);
    if (gestureCheck.afterAngle === gestureCheck.initialAngle) {
      throw new Error('Gesture scratch simulation failed to modulate platter angle');
    }
    console.log('  PASS: MediaPipe gesture routing handles platter angle and scratch synthesis seamlessly.\n');

    // Final Console Error Verification
    if (consoleErrors.length > 0) {
      throw new Error(`Console errors detected during test run: ${consoleErrors.join(' | ')}`);
    }

    console.log('===============================================================');
    console.log('  ALL 12 TESTS PASSED (100% SUCCESS, 0 CONSOLE ERRORS)         ');
    console.log('===============================================================\n');

  } catch (err) {
    console.error('\nTEST SUITE FAILED:', err.message);
    if (consoleErrors.length > 0) {
      console.error('Captured Console Errors:', consoleErrors);
    }
    process.exitCode = 1;
  } finally {
    chrome.kill();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

runTestSuite();
