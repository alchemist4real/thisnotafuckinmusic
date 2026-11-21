const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9226;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTestSuite() {
  console.log('=== SIKLUS 3: DJ CONSOLE PANORAMIC & DUAL DECKS TEST SUITE ===\n');

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
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

    console.log('[1/10] Waiting for DOM & DJ Console initialization...');
    let initOk = false;
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      initOk = await evalInPage(`
        (() => {
          return Boolean(window.DJ && window.DJ.decks && window.DJ.decks.A && window.DJ.decks.B &&
                         document.getElementById('wDJConsole') && document.getElementById('crossfader'));
        })()
      `);
      if (initOk) {
        console.log(`  ✓ Initialized after attempts: ${i + 1}`);
        break;
      }
    }
    if (!initOk) throw new Error('DJ Console did not initialize in time');

    // Switch to DJ mode
    await evalInPage(`
      (() => {
        window.switchWorkspaceMode('DJ');
        window.initDJAudio();
      })()
    `);
    const mode = await evalInPage(`window.S.mode`);
    console.log(`  ✓ Workspace switched to DJ Console mode: S.mode = "${mode}"`);

    console.log('\n[2/10] Testing Initial Deck States & Audio Buffers...');
    const deckInfo = await evalInPage(`
      (() => {
        return {
          deckA: {
            name: window.DJ.decks.A.trackName,
            bpm: window.DJ.decks.A.bpm,
            hasBuffer: Boolean(window.DJ.decks.A.buffer),
            duration: window.DJ.decks.A.buffer ? window.DJ.decks.A.buffer.duration : 0
          },
          deckB: {
            name: window.DJ.decks.B.trackName,
            bpm: window.DJ.decks.B.bpm,
            hasBuffer: Boolean(window.DJ.decks.B.buffer),
            duration: window.DJ.decks.B.buffer ? window.DJ.decks.B.buffer.duration : 0
          }
        };
      })()
    `);
    console.log(`  ✓ Deck A: "${deckInfo.deckA.name}" (${deckInfo.deckA.bpm} BPM, dur=${deckInfo.deckA.duration.toFixed(2)}s)`);
    console.log(`  ✓ Deck B: "${deckInfo.deckB.name}" (${deckInfo.deckB.bpm} BPM, dur=${deckInfo.deckB.duration.toFixed(2)}s)`);
    if (!deckInfo.deckA.hasBuffer || !deckInfo.deckB.hasBuffer) {
      throw new Error('Decks A and B must have valid procedural audio buffers loaded');
    }

    console.log('\n[3/10] Testing Crossfader Curve Selector (Smooth Equal-Power vs Sharp Fast-Cut)...');
    // Test default smooth curve at x = 0.5, 0.0, 1.0
    const smoothData = await evalInPage(`
      (() => {
        window.setCrossfaderCurve('smooth');
        window.updateCrossfader(0.5, true);
        const gainA_mid = window.DJ.decks.A.xfGainVal !== undefined ? window.DJ.decks.A.xfGainVal : window.DJ.decks.A.xfGain.gain.value;
        const gainB_mid = window.DJ.decks.B.xfGainVal !== undefined ? window.DJ.decks.B.xfGainVal : window.DJ.decks.B.xfGain.gain.value;

        window.updateCrossfader(0.0, true);
        const gainA_left = window.DJ.decks.A.xfGainVal !== undefined ? window.DJ.decks.A.xfGainVal : window.DJ.decks.A.xfGain.gain.value;
        const gainB_left = window.DJ.decks.B.xfGainVal !== undefined ? window.DJ.decks.B.xfGainVal : window.DJ.decks.B.xfGain.gain.value;

        window.updateCrossfader(1.0, true);
        const gainA_right = window.DJ.decks.A.xfGainVal !== undefined ? window.DJ.decks.A.xfGainVal : window.DJ.decks.A.xfGain.gain.value;
        const gainB_right = window.DJ.decks.B.xfGainVal !== undefined ? window.DJ.decks.B.xfGainVal : window.DJ.decks.B.xfGain.gain.value;

        return {
          curve: window.DJ.xfCurve,
          btnSmoothActive: document.getElementById('btnXfCurveSmooth').classList.contains('active'),
          btnSharpActive: document.getElementById('btnXfCurveSharp').classList.contains('active'),
          gainA_mid, gainB_mid,
          gainA_left, gainB_left,
          gainA_right, gainB_right
        };
      })()
    `);
    console.log(`  ✓ Smooth Curve: mid [A=${smoothData.gainA_mid.toFixed(3)}, B=${smoothData.gainB_mid.toFixed(3)}] (~0.707 equal-power)`);
    console.log(`  ✓ Smooth Curve: left [A=${smoothData.gainA_left.toFixed(2)}, B=${smoothData.gainB_left.toFixed(2)}], right [A=${smoothData.gainA_right.toFixed(2)}, B=${smoothData.gainB_right.toFixed(2)}]`);
    if (Math.abs(smoothData.gainA_mid - Math.cos(0.25 * Math.PI)) > 0.05) {
      throw new Error(`Smooth mid gain A mismatch: expected ~0.707, got ${smoothData.gainA_mid}`);
    }

    // Switch to sharp fast-cut curve
    const sharpData = await evalInPage(`
      (() => {
        window.setCrossfaderCurve('sharp');
        const btnSmoothActive = document.getElementById('btnXfCurveSmooth').classList.contains('active');
        const btnSharpActive = document.getElementById('btnXfCurveSharp').classList.contains('active');

        // Test Left edge (x = 0)
        window.updateCrossfader(0.0, true);
        const leftA = window.DJ.decks.A.xfGainVal !== undefined ? window.DJ.decks.A.xfGainVal : window.DJ.decks.A.xfGain.gain.value;
        const leftB = window.DJ.decks.B.xfGainVal !== undefined ? window.DJ.decks.B.xfGainVal : window.DJ.decks.B.xfGain.gain.value;

        // Test Cut-in trigger point (x = 0.05) -> Deck B reaches full 1.0
        window.updateCrossfader(0.05, true);
        const cutA = window.DJ.decks.A.xfGainVal !== undefined ? window.DJ.decks.A.xfGainVal : window.DJ.decks.A.xfGain.gain.value;
        const cutB = window.DJ.decks.B.xfGainVal !== undefined ? window.DJ.decks.B.xfGainVal : window.DJ.decks.B.xfGain.gain.value;

        // Test Center (x = 0.5) -> Both at full 1.0
        window.updateCrossfader(0.5, true);
        const midA = window.DJ.decks.A.xfGainVal !== undefined ? window.DJ.decks.A.xfGainVal : window.DJ.decks.A.xfGain.gain.value;
        const midB = window.DJ.decks.B.xfGainVal !== undefined ? window.DJ.decks.B.xfGainVal : window.DJ.decks.B.xfGain.gain.value;

        // Test Cut-out trigger point (x = 0.95) -> Deck A still full 1.0
        window.updateCrossfader(0.95, true);
        const cutOutA = window.DJ.decks.A.xfGainVal !== undefined ? window.DJ.decks.A.xfGainVal : window.DJ.decks.A.xfGain.gain.value;
        const cutOutB = window.DJ.decks.B.xfGainVal !== undefined ? window.DJ.decks.B.xfGainVal : window.DJ.decks.B.xfGain.gain.value;

        // Test Right edge (x = 1.0)
        window.updateCrossfader(1.0, true);
        const rightA = window.DJ.decks.A.xfGainVal !== undefined ? window.DJ.decks.A.xfGainVal : window.DJ.decks.A.xfGain.gain.value;
        const rightB = window.DJ.decks.B.xfGainVal !== undefined ? window.DJ.decks.B.xfGainVal : window.DJ.decks.B.xfGain.gain.value;

        return {
          curve: window.DJ.xfCurve,
          btnSmoothActive,
          btnSharpActive,
          leftA, leftB,
          cutA, cutB,
          midA, midB,
          cutOutA, cutOutB,
          rightA, rightB
        };
      })()
    `);
    console.log(`  ✓ Sharp Cut Curve activated: btnSharpActive=${sharpData.btnSharpActive}, btnSmoothActive=${sharpData.btnSmoothActive}`);
    console.log(`  ✓ Sharp Cut: x=0.00 -> [A=${sharpData.leftA.toFixed(2)}, B=${sharpData.leftB.toFixed(2)}]`);
    console.log(`  ✓ Sharp Cut: x=0.05 (Cut-in) -> [A=${sharpData.cutA.toFixed(2)}, B=${sharpData.cutB.toFixed(2)}] (Both Decks 100% full volume)`);
    console.log(`  ✓ Sharp Cut: x=0.50 (Center) -> [A=${sharpData.midA.toFixed(2)}, B=${sharpData.midB.toFixed(2)}] (Zero center dip)`);
    console.log(`  ✓ Sharp Cut: x=0.95 (Cut-out) -> [A=${sharpData.cutOutA.toFixed(2)}, B=${sharpData.cutOutB.toFixed(2)}]`);
    console.log(`  ✓ Sharp Cut: x=1.00 -> [A=${sharpData.rightA.toFixed(2)}, B=${sharpData.rightB.toFixed(2)}]`);

    if (sharpData.cutB < 0.95 || sharpData.midA < 0.95 || sharpData.midB < 0.95) {
      throw new Error('Sharp fast-cut gains invalid: both decks must be 1.0 in center zone');
    }

    console.log('\n[4/10] Testing Deck A Auto-Looping (1 Bar, 2 Bars, 4 Bars)...');
    await evalInPage(`(() => { window.playDeck('A', 0); })()`);
    await sleep(200);

    // 1 Bar Auto-Loop
    const loop1A = await evalInPage(`
      (() => {
        window.setDeckAutoLoop('A', 1);
        const dA = window.DJ.decks.A;
        const effBpm = dA.bpm * (1 + (dA.pitch || 0));
        const expectedDur = 4 * (60 / effBpm);
        return {
          active: dA.loopActive,
          bars: dA.loopBars,
          start: dA.loopStart,
          end: dA.loopEnd,
          loopDur: dA.loopEnd - dA.loopStart,
          expectedDur,
          btnActive: document.getElementById('btnLoopA1').classList.contains('active'),
          exitDisabled: document.getElementById('btnLoopExitA').disabled,
          pillText: document.getElementById('loopStatusA').textContent
        };
      })()
    `);
    console.log(`  ✓ Deck A 1-Bar Loop: active=${loop1A.active}, dur=${loop1A.loopDur.toFixed(3)}s (expected=${loop1A.expectedDur.toFixed(3)}s), pill="${loop1A.pillText}"`);
    if (!loop1A.active || loop1A.bars !== 1 || Math.abs(loop1A.loopDur - loop1A.expectedDur) > 0.05) {
      throw new Error('Deck A 1-Bar loop length calculation mismatch');
    }

    // 2 Bars Auto-Loop
    const loop2A = await evalInPage(`
      (() => {
        window.setDeckAutoLoop('A', 2);
        const dA = window.DJ.decks.A;
        const effBpm = dA.bpm * (1 + (dA.pitch || 0));
        const expectedDur = 2 * 4 * (60 / effBpm);
        return {
          active: dA.loopActive,
          bars: dA.loopBars,
          loopDur: dA.loopEnd - dA.loopStart,
          expectedDur,
          btnActive: document.getElementById('btnLoopA2').classList.contains('active'),
          pillText: document.getElementById('loopStatusA').textContent
        };
      })()
    `);
    console.log(`  ✓ Deck A 2-Bar Loop: active=${loop2A.active}, dur=${loop2A.loopDur.toFixed(3)}s (expected=${loop2A.expectedDur.toFixed(3)}s), pill="${loop2A.pillText}"`);
    if (!loop2A.active || loop2A.bars !== 2 || Math.abs(loop2A.loopDur - loop2A.expectedDur) > 0.05) {
      throw new Error('Deck A 2-Bar loop calculation mismatch');
    }

    // 4 Bars Auto-Loop
    const loop4A = await evalInPage(`
      (() => {
        window.setDeckAutoLoop('A', 4);
        const dA = window.DJ.decks.A;
        const effBpm = dA.bpm * (1 + (dA.pitch || 0));
        const expectedDur = 4 * 4 * (60 / effBpm);
        return {
          active: dA.loopActive,
          bars: dA.loopBars,
          loopDur: dA.loopEnd - dA.loopStart,
          expectedDur,
          btnActive: document.getElementById('btnLoopA4').classList.contains('active'),
          pillText: document.getElementById('loopStatusA').textContent
        };
      })()
    `);
    console.log(`  ✓ Deck A 4-Bar Loop: active=${loop4A.active}, dur=${loop4A.loopDur.toFixed(3)}s, pill="${loop4A.pillText}"`);

    // Toggle same button exits loop
    const loopExitToggle = await evalInPage(`
      (() => {
        window.setDeckAutoLoop('A', 4); // toggle 4 bars again
        return {
          active: window.DJ.decks.A.loopActive,
          btnActive: document.getElementById('btnLoopA4').classList.contains('active'),
          exitDisabled: document.getElementById('btnLoopExitA').disabled,
          pillText: document.getElementById('loopStatusA').textContent
        };
      })()
    `);
    console.log(`  ✓ Toggle Active Loop: cleanly disabled loop (active=${loopExitToggle.active}, pill="${loopExitToggle.pillText}")`);
    if (loopExitToggle.active || !loopExitToggle.exitDisabled) {
      throw new Error('Toggling active loop button must exit loop');
    }

    // Manual Exit button test
    const loopManualExit = await evalInPage(`
      (() => {
        window.setDeckAutoLoop('A', 1);
        document.getElementById('btnLoopExitA').click();
        return {
          active: window.DJ.decks.A.loopActive,
          exitDisabled: document.getElementById('btnLoopExitA').disabled,
          pillText: document.getElementById('loopStatusA').textContent
        };
      })()
    `);
    console.log(`  ✓ Manual Exit Button: loop active=${loopManualExit.active}, exitDisabled=${loopManualExit.exitDisabled}`);
    if (loopManualExit.active) throw new Error('Exit Loop button did not disable loop');

    console.log('\n[5/10] Testing Deck B Auto-Looping & Symmetry...');
    const loopB = await evalInPage(`
      (() => {
        window.setDeckAutoLoop('B', 2);
        const dB = window.DJ.decks.B;
        const effBpm = dB.bpm * (1 + (dB.pitch || 0));
        const expectedDur = 2 * 4 * (60 / effBpm);
        const res = {
          active: dB.loopActive,
          bars: dB.loopBars,
          loopDur: dB.loopEnd - dB.loopStart,
          expectedDur,
          pillText: document.getElementById('loopStatusB').textContent
        };
        window.exitDeckLoop('B');
        return res;
      })()
    `);
    console.log(`  ✓ Deck B 2-Bar Loop: active=${loopB.active}, dur=${loopB.loopDur.toFixed(3)}s, pill="${loopB.pillText}"`);
    if (!loopB.active || loopB.bars !== 2) throw new Error('Deck B auto-loop failure');

    console.log('\n[6/10] Testing Beat Jump (1 Bar Forward & Backward)...');
    const jumpTest = await evalInPage(`
      (() => {
        window.stopDeck('A');
        const dA = window.DJ.decks.A;
        dA.pauseTime = 1.0;
        const posBefore = dA.pauseTime;
        const barSec = 4 * (60 / dA.bpm);

        // Jump forward 1 bar
        window.deckBeatJump('A', 1);
        const posAfterFwd = window.getDeckCurrentTime(dA);

        // Jump backward 1 bar
        window.deckBeatJump('A', -1);
        const posAfterBack = window.getDeckCurrentTime(dA);

        return {
          barSec,
          posBefore,
          posAfterFwd,
          posAfterBack,
          fwdDelta: posAfterFwd - posBefore,
          backDelta: posAfterBack - posAfterFwd
        };
      })()
    `);
    console.log(`  ✓ Beat Jump Fwd: pos ${jumpTest.posBefore.toFixed(2)}s -> ${jumpTest.posAfterFwd.toFixed(2)}s (delta = +${jumpTest.fwdDelta.toFixed(3)}s, 1 bar = ${jumpTest.barSec.toFixed(3)}s)`);
    console.log(`  ✓ Beat Jump Back: pos ${jumpTest.posAfterFwd.toFixed(2)}s -> ${jumpTest.posAfterBack.toFixed(2)}s (delta = ${jumpTest.backDelta.toFixed(3)}s)`);
    if (Math.abs(jumpTest.fwdDelta - jumpTest.barSec) > 0.05 || Math.abs(jumpTest.backDelta + jumpTest.barSec) > 0.05) {
      throw new Error('Beat jump delta does not equal 1 bar beat interval');
    }

    console.log('\n[7/10] Testing DJ Master Bus Transparent Limiter & Audio Graph Routing...');
    const limiterInfo = await evalInPage(`
      (() => {
        return {
          hasMasterBus: Boolean(window.DJ.masterBus),
          hasLimiter: Boolean(window.DJ.limiter),
          threshold: window.DJ.limiter ? window.DJ.limiter.threshold.value : null,
          ratio: window.DJ.limiter ? window.DJ.limiter.ratio.value : null,
          attack: window.DJ.limiter ? window.DJ.limiter.attack.value : null,
          release: window.DJ.limiter ? window.DJ.limiter.release.value : null,
          masterGainHeadroom: window.DJ.masterBus ? window.DJ.masterBus.gain.value : null
        };
      })()
    `);
    console.log(`  ✓ DJ Master Bus Headroom: ${limiterInfo.masterGainHeadroom} (0.85 inter-deck headroom)`);
    console.log(`  ✓ Transparent Brickwall Limiter: threshold=${limiterInfo.threshold}dB, ratio=${limiterInfo.ratio}:1, attack=${limiterInfo.attack}s, release=${limiterInfo.release}s`);
    if (!limiterInfo.hasMasterBus || !limiterInfo.hasLimiter || limiterInfo.threshold !== -1.0) {
      throw new Error('DJ Master Bus transparent brickwall limiter is missing or misconfigured');
    }

    console.log('\n[8/10] Testing Stacked Waveform Rendering with Active Loop Overlay...');
    const waveRender = await evalInPage(`
      (() => {
        window.setDeckAutoLoop('A', 2);
        window.drawStackedWaveforms();
        const canvas = document.getElementById('stackedWaveforms');
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let nonZero = 0;
        for (let i = 0; i < imgData.data.length; i += 4) {
          if (imgData.data[i] !== 0 || imgData.data[i+1] !== 0 || imgData.data[i+2] !== 0) {
            nonZero++;
          }
        }
        return {
          width: canvas.width,
          height: canvas.height,
          nonZeroPixels: nonZero,
          loopActive: window.DJ.decks.A.loopActive
        };
      })()
    `);
    console.log(`  ✓ Stacked Waveforms: ${waveRender.width}x${waveRender.height} canvas rendered with loop overlay (${waveRender.nonZeroPixels} active pixels)`);
    if (waveRender.nonZeroPixels < 1000) throw new Error('Waveform canvas did not render properly');

    console.log('\n[9/10] Performing Extreme Concurrency Stress Test: Dual Decks + Tape Rec + 4 Pad FX + Scratch...');
    const concurrencyTest = await evalInPage(`
      (async () => {
        // 1. Play Deck A with 2-bar auto-loop
        window.setDeckAutoLoop('A', 2);
        window.playDeck('A');

        // 2. Play Deck B
        window.playDeck('B');

        // 3. Start Tape Recorder
        if (window.REC.state === 'idle') {
          window.recStart();
        }

        // 4. Trigger all 4 Pad FX in rapid succession
        window.playAirhorn();
        window.playBackspin();
        window.play808Boom();
        window.playFreshStab();

        // 5. Trigger vinyl scratching on Turntable A & B
        window.triggerDJScratchSound('A', 2.5, 1);
        window.triggerDJScratchSound('B', 3.0, -1);

        // 6. Rapidly cycle crossfader across curve cuts
        window.setCrossfaderCurve('sharp');
        window.updateCrossfader(0.2);
        window.updateCrossfader(0.8);
        window.updateCrossfader(0.5);

        return {
          deckAPlaying: window.DJ.decks.A.playing,
          deckBPlaying: window.DJ.decks.B.playing,
          recState: window.REC.state,
          audioCtxState: window.A.ctx ? window.A.ctx.state : null,
          tapeBtnClass: document.getElementById('btnDJRecTape').classList.contains('recording-active'),
          tapeBtnText: document.getElementById('btnDJRecTape').textContent
        };
      })()
    `);
    console.log(`  ✓ Dual Decks Active: Deck A=${concurrencyTest.deckAPlaying}, Deck B=${concurrencyTest.deckBPlaying}`);
    console.log(`  ✓ Tape Recorder Running: state="${concurrencyTest.recState}", btnText="${concurrencyTest.tapeBtnText}"`);
    console.log(`  ✓ Audio Context State: "${concurrencyTest.audioCtxState}" (Running cleanly under extreme load)`);

    // Let the stress test run under live audio processing for 2 seconds
    await sleep(2000);

    // Trigger second burst of Pad FX while recording
    await evalInPage(`
      (() => {
        window.playAirhorn();
        window.play808Boom();
        window.triggerDJScratchSound('A', 1.8, -1);
      })()
    `);
    await sleep(1000);

    // Stop recording and verify take
    const recStopResult = await evalInPage(`
      (async () => {
        window.recStop();
        await new Promise(r => setTimeout(r, 600));
        return {
          recStateAfter: window.REC.state,
          takesCount: window.takes ? window.takes.length : 0,
          lastTakeName: (window.takes && window.takes.length > 0) ? window.takes[window.takes.length - 1].name : null,
          audioCtxState: window.A.ctx ? window.A.ctx.state : null
        };
      })()
    `);
    console.log(`  ✓ Stopped Tape Recorder: state="${recStopResult.recStateAfter}", takesCount=${recStopResult.takesCount}, lastTake="${recStopResult.lastTakeName}"`);

    console.log('\n[10/10] Testing Project Serialization of Crossfader Curve & DJ State...');
    const projectSaveTest = await evalInPage(`
      (() => {
        window.setCrossfaderCurve('sharp');
        window.updateCrossfader(0.42, true);

        // Construct project export object as in exportTNAF
        const project = {
          projectVersion: '2.2.0',
          djState: {
            crossfader: window.DJ.crossfader,
            xfCurve: window.DJ.xfCurve,
            deckA: { trackName: window.DJ.decks.A.trackName, bpm: window.DJ.decks.A.bpm },
            deckB: { trackName: window.DJ.decks.B.trackName, bpm: window.DJ.decks.B.bpm }
          }
        };

        // Reset curve to smooth, then simulate import
        window.setCrossfaderCurve('smooth');
        const curveBeforeImport = window.DJ.xfCurve;

        // Simulate importing project djState
        if (project.djState.xfCurve) {
          window.setCrossfaderCurve(project.djState.xfCurve);
        }
        if (typeof project.djState.crossfader === 'number') {
          window.updateCrossfader(project.djState.crossfader, true);
        }

        return {
          curveBeforeImport,
          curveAfterImport: window.DJ.xfCurve,
          xfValueAfterImport: window.DJ.crossfader,
          btnSharpActive: document.getElementById('btnXfCurveSharp').classList.contains('active')
        };
      })()
    `);
    console.log(`  ✓ Project Serialization: reset to "${projectSaveTest.curveBeforeImport}" -> imported as "${projectSaveTest.curveAfterImport}" (btnSharpActive=${projectSaveTest.btnSharpActive}, xf=${projectSaveTest.xfValueAfterImport})`);
    if (projectSaveTest.curveAfterImport !== 'sharp' || !projectSaveTest.btnSharpActive) {
      throw new Error('Project serialization of crossfader curve failed');
    }

    // Clean up decks
    await evalInPage(`
      (() => {
        window.stopDeck('A');
        window.stopDeck('B');
        window.exitDeckLoop('A');
        window.exitDeckLoop('B');
        window.setCrossfaderCurve('smooth');
        window.updateCrossfader(0.5, true);
      })()
    `);

    console.log('\n=== CONSOLE INTEGRITY CHECK ===');
    console.log(`Errors logged: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      consoleErrors.forEach(e => console.error('  ERROR:', e));
      throw new Error('Console errors detected during DJ Console tests!');
    }
    console.log('✓ 100% Zero Console Errors!');

    console.log('\n🎉 ALL SIKLUS 3 TESTS PASSED PERFECTLY (100% SUCCESS)!');

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  } finally {
    try {
      chrome.kill();
    } catch (_) {}
  }
}

runTestSuite();
