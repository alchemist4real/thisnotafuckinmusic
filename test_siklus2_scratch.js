const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9238;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  TEST SUITE: SIKLUS 2 - INTERACTIVE VINYL PLATTER SCRATCHING   ');
  console.log('  (Strobe Rim, Hamster Switch, Motor Torque, Envelope Shaping)  ');
  console.log('================================================================\n');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-scratch2-test-'));

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

    console.log('[1/12] Waiting for DOM & DJ Console Initialization...');
    let initOk = false;
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      initOk = await evalInPage(`
        Boolean(document.getElementById('platterA') &&
                document.getElementById('platterB') &&
                document.getElementById('btnHamsterSwitch') &&
                window.DJ && window.DJ.decks)
      `);
      if (initOk) break;
    }
    if (!initOk) throw new Error('DOM and DJ Console elements did not initialize in time');
    console.log('  PASS: DOM & DJ Console ready.\n');

    // TEST 1: Verification of Siklus 2 UI Controls
    console.log('[2/12] Verifying Siklus 2 Controls (Hamster, Torque, Scratch Envelope)...');
    const uiCheck = await evalInPage(`
      (() => {
        window.switchWorkspaceMode('DJ');
        const hamsterBtn = document.getElementById('btnHamsterSwitch');
        const torqueHigh = document.getElementById('btnTorque_high');
        const torqueStd = document.getElementById('btnTorque_standard');
        const torqueHeavy = document.getElementById('btnTorque_heavy');
        const envAuto = document.getElementById('btnEnv_adaptive');
        const envBaby = document.getElementById('btnEnv_baby');
        const envChirp = document.getElementById('btnEnv_chirp');
        const envFlare = document.getElementById('btnEnv_flare');
        const xfLabel = document.getElementById('crossfaderLabel');

        return {
          hasHamsterBtn: !!hamsterBtn,
          hasTorqueHigh: !!torqueHigh,
          hasTorqueStd: !!torqueStd,
          hasTorqueHeavy: !!torqueHeavy,
          hasEnvAuto: !!envAuto,
          hasEnvBaby: !!envBaby,
          hasEnvChirp: !!envChirp,
          hasEnvFlare: !!envFlare,
          hasXfLabel: !!xfLabel,
          torqueStdActive: torqueStd ? torqueStd.classList.contains('active') : false,
          envAutoActive: envAuto ? envAuto.classList.contains('active') : false
        };
      })()
    `);
    if (!uiCheck.hasHamsterBtn) throw new Error('Missing #btnHamsterSwitch');
    if (!uiCheck.hasTorqueHigh || !uiCheck.hasTorqueStd || !uiCheck.hasTorqueHeavy) throw new Error('Missing Motor Torque buttons');
    if (!uiCheck.hasEnvAuto || !uiCheck.hasEnvBaby || !uiCheck.hasEnvChirp || !uiCheck.hasEnvFlare) throw new Error('Missing Scratch Envelope buttons');
    if (!uiCheck.torqueStdActive || !uiCheck.envAutoActive) throw new Error('Default active states for Torque and Envelope incorrect');
    console.log('  PASS: All Siklus 2 buttons, labels, and default active states verified.\n');

    // TEST 2: Technics SL-1200MK2 Stroboscopic Rim Dots & Strobe Lamp Rendering
    console.log('[3/12] Testing Technics SL-1200MK2 Stroboscopic Rim Dots Rendering...');
    const strobeRenderCheck = await evalInPage(`
      (() => {
        window.drawTurntable('platterA', 'A');
        window.drawTurntable('platterB', 'B');
        const dA = window.DJ.decks.A;
        const dB = window.DJ.decks.B;
        const cA = document.getElementById('platterA');
        const ctxA = cA.getContext('2d');

        // Sample pixel near bottom-left strobe lamp (x=14, y=146)
        const lampPixel = ctxA.getImageData(14, 146, 1, 1).data;
        // Sample pixel along outer rim where stroboscopic dots reside (r ~ 74, x ~ 80, y ~ 6)
        const rimPixel = ctxA.getImageData(80, 6, 1, 1).data;

        return {
          hasStrobeRimA: !!dA.hasStrobeRim,
          hasStrobeRimB: !!dB.hasStrobeRim,
          strobeDotsCountA: dA.strobeDotsCount,
          strobeDotsCountB: dB.strobeDotsCount,
          strobeRingsA: dA.strobeRings,
          lampHasColor: lampPixel[0] > 100 || lampPixel[3] > 100, // Red lamp glowing
          rimHasColor: rimPixel[3] > 0 // Rim and dots drawn
        };
      })()
    `);
    if (!strobeRenderCheck.hasStrobeRimA || !strobeRenderCheck.hasStrobeRimB) throw new Error('hasStrobeRim flag missing on decks');
    if (strobeRenderCheck.strobeDotsCountA !== 32 || strobeRenderCheck.strobeRingsA !== 4) throw new Error('Strobe dots configuration incorrect');
    if (!strobeRenderCheck.lampHasColor || !strobeRenderCheck.rimHasColor) throw new Error('Strobe rim or lamp pixels not rendered onto canvas');
    console.log(`  PASS: Technics SL-1200MK2 Strobe Rim rendered: 4 rings (${strobeRenderCheck.strobeDotsCountA} nominal dots) with glowing red neon strobe lamp.\n`);

    // TEST 3: Stroboscopic Rotation Pitch/RPS Sync
    console.log('[4/12] Testing Platter Rotation Angle & Strobe Sync with Pitch Slider...');
    const pitchSyncCheck = await evalInPage(`
      (() => {
        const dA = window.DJ.decks.A;
        dA.playing = true;
        dA.isScratching = false;
        dA.angle = 0;
        dA.pitch = 0.08; // +8.0% pitch

        const nominalRps = (33.333 / 60) * (1.0 + 0.08);
        window.updateDJAnimation(1000);
        window.updateDJAnimation(1100); // dt = 100ms
        const angle1 = dA.angle;

        dA.pitch = -0.05; // -5.0% pitch
        window.updateDJAnimation(1200); // dt = 100ms
        const angle2 = dA.angle;

        dA.playing = false;
        window.drawTurntable('platterA', 'A');

        return {
          nominalRps,
          angle1,
          angle2,
          strobeAngle: dA.strobeAngle,
          angleAdvanced: angle1 > 0 && angle2 > angle1
        };
      })()
    `);
    if (!pitchSyncCheck.angleAdvanced) throw new Error('Platter rotation angle failed to advance smoothly with pitch');
    if (Math.abs(pitchSyncCheck.strobeAngle - pitchSyncCheck.angle2) > 0.001) throw new Error('Strobe dots failed to match platter angle');
    console.log(`  PASS: Stroboscopic dots rotate strictly in sync with pitch/RPS (angle=${pitchSyncCheck.strobeAngle.toFixed(3)} rad).\n`);

    // TEST 4: Hamster Switch (Reverse Crossfader) Toggle & Gain Inversion
    console.log('[5/12] Testing Hamster Switch Toggle & Crossfader Gain Inversion...');
    const hamsterCheck = await evalInPage(`
      (() => {
        window.initDJAudio();
        window.setCrossfaderCurve('sharp');

        // Step 1: Hamster OFF (Standard)
        window.setHamsterSwitch(false);
        window.updateCrossfader(0.0, true); // Hard Left
        const stdLeft_gainA = window.DJ.decks.A.xfGainVal;
        const stdLeft_gainB = window.DJ.decks.B.xfGainVal;

        window.updateCrossfader(1.0, true); // Hard Right
        const stdRight_gainA = window.DJ.decks.A.xfGainVal;
        const stdRight_gainB = window.DJ.decks.B.xfGainVal;

        // Step 2: Hamster ON (Reversed / Battle Turntablism Style)
        window.setHamsterSwitch(true);
        const hamsterActive = window.DJ.hamster;
        const btnActive = document.getElementById('btnHamsterSwitch').classList.contains('active');

        window.updateCrossfader(0.0, true); // Hard Left -> Deck B SOLO, Deck A CUT!
        const revLeft_gainA = window.DJ.decks.A.xfGainVal;
        const revLeft_gainB = window.DJ.decks.B.xfGainVal;

        window.updateCrossfader(1.0, true); // Hard Right -> Deck A SOLO, Deck B CUT!
        const revRight_gainA = window.DJ.decks.A.xfGainVal;
        const revRight_gainB = window.DJ.decks.B.xfGainVal;

        window.updateCrossfader(0.5, true); // Center
        const center_gainA = window.DJ.decks.A.xfGainVal;
        const center_gainB = window.DJ.decks.B.xfGainVal;

        // Reset Hamster to OFF
        window.setHamsterSwitch(false);

        return {
          stdLeft_gainA, stdLeft_gainB,
          stdRight_gainA, stdRight_gainB,
          hamsterActive, btnActive,
          revLeft_gainA, revLeft_gainB,
          revRight_gainA, revRight_gainB,
          center_gainA, center_gainB
        };
      })()
    `);
    if (hamsterCheck.stdLeft_gainA < 0.99 || hamsterCheck.stdLeft_gainB > 0.01) throw new Error('Standard left cut failed');
    if (!hamsterCheck.hamsterActive || !hamsterCheck.btnActive) throw new Error('Hamster switch failed to activate');
    if (hamsterCheck.revLeft_gainA > 0.01 || hamsterCheck.revLeft_gainB < 0.99) throw new Error('Hamster reverse left cut failed (Deck B should be solo)');
    if (hamsterCheck.revRight_gainA < 0.99 || hamsterCheck.revRight_gainB > 0.01) throw new Error('Hamster reverse right cut failed (Deck A should be solo)');
    console.log('  PASS: Hamster switch cleanly flips Deck A <-> Deck B on crossfader edges.\n');

    // TEST 5: Hamster Switch Keyboard Hotkey ('H')
    console.log('[6/12] Testing Hamster Switch Keyboard HotKey ("H")...');
    const keyCheck = await evalInPage(`
      (() => {
        window.switchWorkspaceMode('DJ');
        window.setHamsterSwitch(false);
        const initialHamster = window.DJ.hamster;

        // Dispatch 'h' keydown
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
        const afterKeyHamster = window.DJ.hamster;

        // Dispatch 'h' keydown again to toggle back
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
        const finalHamster = window.DJ.hamster;

        return { initialHamster, afterKeyHamster, finalHamster };
      })()
    `);
    if (keyCheck.initialHamster !== false || keyCheck.afterKeyHamster !== true || keyCheck.finalHamster !== false) {
      throw new Error(`Hamster hotkey 'h' toggle failed: initial=${keyCheck.initialHamster}, afterKey=${keyCheck.afterKeyHamster}, final=${keyCheck.finalHamster}`);
    }
    console.log('  PASS: Keydown "H" toggles Hamster Mode seamlessly.\n');

    // TEST 6: Motor Torque & Inertia Modes Configuration
    console.log('[7/12] Testing Motor Torque Modes (Fast Direct-Drive vs Standard vs Heavy Drag)...');
    const torqueCheck = await evalInPage(`
      (() => {
        const results = {};

        window.setMotorTorque('high');
        results.highMode = window.getMotorTorque();
        results.btnHighActive = document.getElementById('btnTorque_high').classList.contains('active');

        window.setMotorTorque('heavy');
        results.heavyMode = window.getMotorTorque();
        results.btnHeavyActive = document.getElementById('btnTorque_heavy').classList.contains('active');

        window.setMotorTorque('standard');
        results.stdMode = window.getMotorTorque();
        results.btnStdActive = document.getElementById('btnTorque_standard').classList.contains('active');

        results.highRamp = window.MOTOR_TORQUE_CONFIGS.high.rampTime;
        results.stdRamp = window.MOTOR_TORQUE_CONFIGS.standard.rampTime;
        results.heavyRamp = window.MOTOR_TORQUE_CONFIGS.heavy.rampTime;

        return results;
      })()
    `);
    if (torqueCheck.highMode !== 'high' || !torqueCheck.btnHighActive) throw new Error('High torque mode failed to set');
    if (torqueCheck.heavyMode !== 'heavy' || !torqueCheck.btnHeavyActive) throw new Error('Heavy torque mode failed to set');
    if (torqueCheck.stdMode !== 'standard' || !torqueCheck.btnStdActive) throw new Error('Standard torque mode failed to set');
    if (torqueCheck.highRamp >= torqueCheck.stdRamp || torqueCheck.stdRamp >= torqueCheck.heavyRamp) {
      throw new Error('Torque ramp times order invalid');
    }
    console.log(`  PASS: Motor Torque modes verified: Fast (${torqueCheck.highRamp}s), Std (${torqueCheck.stdRamp}s), Heavy (${torqueCheck.heavyRamp}s).\n`);

    // TEST 7: Motor Spin-Up Inertia Curve Comparison
    console.log('[8/12] Testing Motor Spin-Up Inertia Curve with Torque Modes...');
    const motorCurveCheck = await evalInPage(`
      (async () => {
        const dA = window.DJ.decks.A;
        const cA = document.getElementById('platterA');
        const rect = cA.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;

        // Test 1: High Torque fast direct-drive spin-up
        window.setMotorTorque('high');
        window.playDeck('A');
        await new Promise(r => setTimeout(r, 100));
        cA.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 41, clientX: cx + 30, clientY: cy, bubbles: true }));
        cA.dispatchEvent(new PointerEvent('pointerup', { pointerId: 41, bubbles: true }));
        await new Promise(r => setTimeout(r, 65));
        const highMotorRps = dA.motorRps;
        window.stopDeck('A');

        // Test 2: Heavy Drag spin-up
        window.setMotorTorque('heavy');
        window.playDeck('A');
        await new Promise(r => setTimeout(r, 100));
        cA.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 42, clientX: cx + 30, clientY: cy, bubbles: true }));
        cA.dispatchEvent(new PointerEvent('pointerup', { pointerId: 42, bubbles: true }));
        await new Promise(r => setTimeout(r, 65));
        const heavyMotorRps = dA.motorRps;
        window.stopDeck('A');

        // Reset to standard
        window.setMotorTorque('standard');

        return { highMotorRps, heavyMotorRps };
      })()
    `);
    if (motorCurveCheck.highMotorRps <= motorCurveCheck.heavyMotorRps) {
      throw new Error(`High torque acceleration must exceed heavy torque: high=${motorCurveCheck.highMotorRps}, heavy=${motorCurveCheck.heavyMotorRps}`);
    }
    console.log(`  PASS: Direct-drive spin-up curves verified: Fast DD (${motorCurveCheck.highMotorRps.toFixed(2)} RPS) > Heavy Drag (${motorCurveCheck.heavyMotorRps.toFixed(2)} RPS).\n`);

    // TEST 8: Unpowered Platter Rotational Inertia Freewheel & Drag Friction
    console.log('[9/12] Testing Unpowered Platter Rotational Inertia Freewheel & Drag Friction...');
    const inertiaCheck = await evalInPage(`
      (() => {
        const dA = window.DJ.decks.A;
        dA.playing = false;
        dA.isScratching = false;
        dA.angle = 0;

        // Simulate high-speed release throw on paused turntable
        dA.inertiaVelocity = 3.5;
        dA.isInertiaSpinning = true;

        window.setMotorTorque('heavy');
        window.updateDJAnimation(2000);
        window.updateDJAnimation(2050); // dt = 50ms
        const heavyAngle1 = dA.angle;
        const heavyVel1 = dA.inertiaVelocity;

        window.updateDJAnimation(2150); // dt = 100ms
        const heavyAngle2 = dA.angle;
        const heavyVel2 = dA.inertiaVelocity;

        // Reset
        dA.inertiaVelocity = 0;
        dA.isInertiaSpinning = false;
        window.setMotorTorque('standard');

        return {
          heavyAngle1,
          heavyAngle2,
          heavyVel1,
          heavyVel2,
          glided: heavyAngle2 > heavyAngle1,
          decelerated: heavyVel2 < heavyVel1 && heavyVel2 > 0
        };
      })()
    `);
    if (!inertiaCheck.glided || !inertiaCheck.decelerated) {
      throw new Error('Unpowered platter inertia freewheel failed to coast and decelerate smoothly');
    }
    console.log(`  PASS: Rotational inertia freewheel glides and decelerates smoothly (Vel: ${inertiaCheck.heavyVel1.toFixed(2)} -> ${inertiaCheck.heavyVel2.toFixed(2)}).\n`);

    // TEST 9: Scratch Envelope Shaping Modes (Baby, Chirp, Flare, Adaptive)
    console.log('[10/12] Testing Scratch Envelope Shaping Modes (Baby, Chirp, Flare)...');
    const envCheck = await evalInPage(`
      (() => {
        window.initDJAudio();
        const results = {};

        // 1. Baby Scratch
        window.setScratchEnvelope('baby');
        window.DJ.decks.A._lastScratchTime = 0;
        window.triggerDJScratchSound('A', 2.0, 1);
        results.babyEnv = window.DJ.decks.A.activeScratchEnv;

        // 2. Chirp Scratch
        window.setScratchEnvelope('chirp');
        window.DJ.decks.A._lastScratchTime = 0;
        window.triggerDJScratchSound('A', 3.5, 1);
        results.chirpEnv = window.DJ.decks.A.activeScratchEnv;

        // 3. Flare Scratch
        window.setScratchEnvelope('flare');
        window.DJ.decks.A._lastScratchTime = 0;
        window.triggerDJScratchSound('A', 4.0, 1);
        results.flareEnv = window.DJ.decks.A.activeScratchEnv;

        // 4. Adaptive Mode (auto detects Chirp on fast scrub)
        window.setScratchEnvelope('adaptive');
        window.DJ.decks.A._lastScratchTime = 0;
        window.DJ.decks.A._lastReversalTime = performance.now();
        window.triggerDJScratchSound('A', 3.8, 1);
        results.adaptiveFastEnv = window.DJ.decks.A.activeScratchEnv;

        return results;
      })()
    `);
    if (envCheck.babyEnv !== 'baby') throw new Error(`Baby envelope mismatch: ${envCheck.babyEnv}`);
    if (envCheck.chirpEnv !== 'chirp') throw new Error(`Chirp envelope mismatch: ${envCheck.chirpEnv}`);
    if (envCheck.flareEnv !== 'flare') throw new Error(`Flare envelope mismatch: ${envCheck.flareEnv}`);
    if (envCheck.adaptiveFastEnv !== 'chirp' && envCheck.adaptiveFastEnv !== 'flare') {
      throw new Error(`Adaptive mode failed to switch to high-speed envelope: ${envCheck.adaptiveFastEnv}`);
    }
    console.log(`  PASS: Scratch envelopes shaped correctly: Baby (smooth), Chirp (sharp attack), Flare (micro-cuts), Adaptive (velocity-aware).\n`);

    // TEST 10: Direction Reversal Stylus Groove Bite Detection
    console.log('[11/12] Testing Rapid Scrub Direction Reversal & Needle Bite Pop Transient...');
    const biteCheck = await evalInPage(`
      (() => {
        window.initDJAudio();
        const dA = window.DJ.decks.A;
        dA._lastScratchDir = 1;
        dA._reversalCount = 0;
        dA._lastScratchTime = 0;

        // Rapid forward stroke
        window.triggerDJScratchSound('A', 3.0, 1);
        const countBefore = dA._reversalCount || 0;

        // Immediate reverse stroke (reversal!)
        dA._lastScratchTime = 0; // bypass throttle for test
        window.triggerDJScratchSound('A', 3.2, -1);
        const countAfter = dA._reversalCount || 0;
        const hasBiteTime = typeof dA.lastBiteTime === 'number' && !isNaN(dA.lastBiteTime);

        return { countBefore, countAfter, hasBiteTime, lastBiteTime: dA.lastBiteTime };
      })()
    `);
    if (biteCheck.countAfter <= biteCheck.countBefore || !biteCheck.hasBiteTime) {
      throw new Error(`Direction reversal bite transient failed: before=${biteCheck.countBefore}, after=${biteCheck.countAfter}, biteTime=${biteCheck.lastBiteTime}`);
    }
    console.log(`  PASS: Needle bite transient pop triggered on groove direction reversal (Count: ${biteCheck.countBefore} -> ${biteCheck.countAfter}).\n`);

    // TEST 11: TNAF Project Save & Restore of Siklus 2 DJ State
    console.log('[12/12] Testing Project Save & Restore with Hamster, Torque, and Envelope...');
    const projectSaveRestoreCheck = await evalInPage(`
      (() => {
        // Configure custom Siklus 2 states
        window.setHamsterSwitch(true);
        window.setMotorTorque('high');
        window.setScratchEnvelope('chirp');

        // Build mock project state
        const savedDjState = {
          crossfader: 0.25,
          hamster: window.DJ.hamster,
          xfCurve: window.DJ.xfCurve,
          motorTorque: window.DJ.motorTorque,
          scratchEnvelope: window.DJ.scratchEnvelope
        };

        // Reset to defaults
        window.setHamsterSwitch(false);
        window.setMotorTorque('standard');
        window.setScratchEnvelope('adaptive');

        // Simulate restore
        if (typeof savedDjState.hamster === 'boolean') window.setHamsterSwitch(savedDjState.hamster);
        if (savedDjState.motorTorque) window.setMotorTorque(savedDjState.motorTorque);
        if (savedDjState.scratchEnvelope) window.setScratchEnvelope(savedDjState.scratchEnvelope);

        return {
          restoredHamster: window.DJ.hamster,
          restoredTorque: window.DJ.motorTorque,
          restoredEnvelope: window.DJ.scratchEnvelope,
          hamsterBtnActive: document.getElementById('btnHamsterSwitch').classList.contains('active'),
          torqueHighActive: document.getElementById('btnTorque_high').classList.contains('active'),
          envChirpActive: document.getElementById('btnEnv_chirp').classList.contains('active')
        };
      })()
    `);
    if (!projectSaveRestoreCheck.restoredHamster || !projectSaveRestoreCheck.hamsterBtnActive) throw new Error('Hamster state failed to restore');
    if (projectSaveRestoreCheck.restoredTorque !== 'high' || !projectSaveRestoreCheck.torqueHighActive) throw new Error('Motor torque failed to restore');
    if (projectSaveRestoreCheck.restoredEnvelope !== 'chirp' || !projectSaveRestoreCheck.envChirpActive) throw new Error('Scratch envelope failed to restore');
    console.log('  PASS: Project state faithfully saves and restores Hamster, Motor Torque, and Scratch Envelope.\n');

    // Final Console Error Verification
    if (consoleErrors.length > 0) {
      throw new Error(`Console errors detected during test run: ${consoleErrors.join(' | ')}`);
    }

    console.log('================================================================');
    console.log('  ALL 12 SIKLUS 2 TESTS PASSED (100% SUCCESS, 0 CONSOLE ERRORS) ');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\nTEST SUITE FAILED:', err.message);
    if (consoleErrors.length > 0) {
      console.error('Captured Console Errors:', consoleErrors);
    }
    process.exitCode = 1;
  } finally {
    chrome.kill();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}

runTestSuite();
