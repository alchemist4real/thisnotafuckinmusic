const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9235;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTestSuite() {
  console.log('=== SIKLUS 1: DJ SAMPLER FX SOUNDBOARD (4-PAD AUDIO INSTAN) TEST SUITE ===\n');

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

    console.log('[1/8] Waiting for DOM & DJ Sampler FX initialization...');
    let initOk = false;
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      initOk = await evalInPage(`
        (() => {
          return Boolean(document.getElementById('btnFxHorn') &&
                         document.getElementById('btnFxRewind') &&
                         document.getElementById('btnFxBoom') &&
                         document.getElementById('btnFxFresh') &&
                         typeof window.switchWorkspaceMode === 'function' &&
                         typeof window.initDJAudio === 'function');
        })()
      `);
      if (initOk) {
        console.log(`  ✓ DOM Sampler FX pads found after ${i + 1} attempt(s)`);
        break;
      }
    }
    if (!initOk) throw new Error('Sampler FX pads not found in DOM');

    // Switch to DJ mode and init Audio
    await evalInPage(`
      (async () => {
        window.switchWorkspaceMode('DJ');
        window.initDJAudio();
        if (window.A.ctx && window.A.ctx.state === 'suspended') {
          await window.A.ctx.resume();
        }
      })()
    `);
    const mode = await evalInPage(`window.S.mode`);
    console.log(`  ✓ Workspace active mode: S.mode = "${mode}"`);

    // TEST 1: DOM Elements, Tactile Retro Windows 98 Layout & Badges
    console.log('\n[2/8] Auditing HTML & Retro Windows 98 Tactile Structure...');
    const padLayout = await evalInPage(`
      (() => {
        const pads = ['btnFxHorn', 'btnFxRewind', 'btnFxBoom', 'btnFxFresh'];
        const data = {};
        for (const id of pads) {
          const el = document.getElementById(id);
          const led = el.querySelector('.pad-led');
          const kbadge = el.querySelector('.pad-kbadge');
          const lbl = el.querySelector('.pad-lbl');
          const cs = window.getComputedStyle(el);
          data[id] = {
            exists: Boolean(el),
            classes: el.className,
            dataKey: el.getAttribute('data-key'),
            hasLed: Boolean(led),
            ledClasses: led ? led.className : '',
            hasBadge: Boolean(kbadge),
            badgeText: kbadge ? kbadge.textContent.trim() : '',
            hasLabel: Boolean(lbl),
            labelText: lbl ? lbl.textContent.trim() : '',
            cursor: cs.cursor,
            userSelect: cs.userSelect || cs.webkitUserSelect
          };
        }
        return data;
      })()
    `);

    for (const [id, info] of Object.entries(padLayout)) {
      console.log(`  ✓ Pad #${id}: key=[${info.dataKey}] lbl="${info.labelText}" led=${info.hasLed} badge="${info.badgeText}"`);
      if (!info.exists || !info.hasLed || !info.hasBadge || !info.dataKey) {
        throw new Error(`Pad #${id} missing required tactile elements`);
      }
    }

    // TEST 2: Visual Active States & LED Flash on Button Click
    console.log('\n[3/8] Testing Visual Active States & LED Flash on Click...');
    const clickVisuals = await evalInPage(`
      (() => {
        const elHorn = document.getElementById('btnFxHorn');
        const ledHorn = elHorn.querySelector('.pad-led');

        // Initial state
        const beforeActive = elHorn.classList.contains('active');
        const beforeLit = ledHorn.classList.contains('lit');

        // Simulate click
        elHorn.click();

        const duringActive = elHorn.classList.contains('active');
        const duringLit = ledHorn.classList.contains('lit');

        return { beforeActive, beforeLit, duringActive, duringLit };
      })()
    `);
    console.log(`  ✓ Horn Click: before=[active:${clickVisuals.beforeActive}, lit:${clickVisuals.beforeLit}] -> during=[active:${clickVisuals.duringActive}, lit:${clickVisuals.duringLit}]`);
    if (!clickVisuals.duringActive || !clickVisuals.duringLit) {
      throw new Error('Horn button did not enter active/lit state upon click');
    }

    // TEST 3: Keyboard Hotkeys (Keys 5, 6, 7, 8) and Tactile Responses
    console.log('\n[4/8] Testing Keyboard Hotkeys [5, 6, 7, 8] & Tactile Feedback...');
    const hotkeyTest = await evalInPage(`
      (() => {
        const results = {};
        const keyMap = [
          { key: '5', id: 'btnFxHorn' },
          { key: '6', id: 'btnFxRewind' },
          { key: '7', id: 'btnFxBoom' },
          { key: '8', id: 'btnFxFresh' }
        ];

        for (const item of keyMap) {
          const btn = document.getElementById(item.id);
          const led = btn.querySelector('.pad-led');

          // Dispatch keydown
          const downEv = new KeyboardEvent('keydown', { key: item.key, bubbles: true });
          document.dispatchEvent(downEv);

          const isDownActive = btn.classList.contains('active');
          const isDownLit = led.classList.contains('lit');

          // Dispatch keyup
          const upEv = new KeyboardEvent('keyup', { key: item.key, bubbles: true });
          document.dispatchEvent(upEv);

          const isUpActive = btn.classList.contains('active');
          const isUpLitStillLit = led.classList.contains('lit'); // LED remains lit for sample duration

          results[item.key] = {
            id: item.id,
            isDownActive,
            isDownLit,
            isUpActive,
            isUpLitStillLit
          };
        }
        return results;
      })()
    `);

    for (const [key, res] of Object.entries(hotkeyTest)) {
      console.log(`  ✓ Key "${key}" -> #${res.id}: keydown=[active:${res.isDownActive}, lit:${res.isDownLit}] -> keyup=[active:${res.isUpActive}, lit:${res.isUpLitStillLit}]`);
      if (!res.isDownActive || !res.isDownLit || res.isUpActive) {
        throw new Error(`Hotkey ${key} tactile feedback failed`);
      }
    }

    // TEST 4: Audio Graph Routing (DJ.samplerBus, DJ.samplerLimiter, DJ.masterBus, A.recBus)
    console.log('\n[5/8] Auditing Audio Graph Architecture & Routing...');
    const audioRouting = await evalInPage(`
      (() => {
        window.initDJAudio();
        window.initDJSamplerBus();

        const sBus = window.DJ.samplerBus;
        const sLim = window.DJ.samplerLimiter;
        const mBus = window.DJ.masterBus;
        const mLim = window.DJ.limiter;
        const aMaster = window.A.master;
        const aRecBus = window.A.recBus;

        return {
          hasSamplerBus: Boolean(sBus),
          samplerBusGain: sBus ? sBus.gain.value : null,
          hasSamplerLimiter: Boolean(sLim),
          samplerLimiterThresh: sLim ? sLim.threshold.value : null,
          samplerLimiterRatio: sLim ? sLim.ratio.value : null,
          samplerLimiterAttack: sLim ? sLim.attack.value : null,
          hasMasterBus: Boolean(mBus),
          masterBusGain: mBus ? mBus.gain.value : null,
          hasMasterLimiter: Boolean(mLim),
          hasTapeRecBus: Boolean(aRecBus)
        };
      })()
    `);

    console.log(`  ✓ DJ.samplerBus: Gain = ${audioRouting.samplerBusGain} (Headroom allocation)`);
    console.log(`  ✓ DJ.samplerLimiter: Thresh = ${audioRouting.samplerLimiterThresh} dB, Ratio = ${audioRouting.samplerLimiterRatio}:1, Attack = ${audioRouting.samplerLimiterAttack}s (Brickwall)`);
    console.log(`  ✓ DJ.masterBus: Gain = ${audioRouting.masterBusGain}, Master Limiter = ${audioRouting.hasMasterLimiter}`);
    console.log(`  ✓ Tape Recorder A.recBus: Available = ${audioRouting.hasTapeRecBus}`);

    if (!audioRouting.hasSamplerBus || !audioRouting.hasSamplerLimiter || !audioRouting.hasMasterBus || !audioRouting.hasTapeRecBus) {
      throw new Error('Audio routing graph incomplete: missing required bus or limiter');
    }

    // TEST 5: DSP Engine Generators Execution & Voice Registry
    console.log('\n[6/8] Testing DSP Engine Generators (Airhorn, Rewind, 808 Boom, Fresh)...');
    const dspGenerators = await evalInPage(`
      (() => {
        window.stopAllSamplerFX();

        // 1. Play Airhorn
        window.playAirhorn();
        const hornVoices = window.DJ_SAMPLER_VOICES.horn.length;

        // 2. Play Rewind
        window.playBackspin();
        const rewindVoices = window.DJ_SAMPLER_VOICES.backspin.length;

        // 3. Play 808 Boom
        window.play808Boom();
        const boomVoices = window.DJ_SAMPLER_VOICES.boom.length;

        // 4. Play Fresh Scratch
        window.playFreshStab();
        const freshVoices = window.DJ_SAMPLER_VOICES.fresh.length;

        return { hornVoices, rewindVoices, boomVoices, freshVoices };
      })()
    `);

    console.log(`  ✓ Airhorn DSP: active voices = ${dspGenerators.hornVoices}`);
    console.log(`  ✓ Backspin DSP: active voices = ${dspGenerators.rewindVoices}`);
    console.log(`  ✓ 808 Boom DSP: active voices = ${dspGenerators.boomVoices}`);
    console.log(`  ✓ Fresh Scratch DSP: active voices = ${dspGenerators.freshVoices}`);

    if (dspGenerators.hornVoices === 0 || dspGenerators.rewindVoices === 0 || dspGenerators.boomVoices === 0 || dspGenerators.freshVoices === 0) {
      throw new Error('DSP engines failed to register active voices in DJ_SAMPLER_VOICES');
    }

    // TEST 6: Voice Choking & Memory Leak Transient Cleanup
    console.log('\n[7/8] Testing Voice Choking & Zero Memory Leak Cleanup...');
    const chokeTest = await evalInPage(`
      (async () => {
        // Retrigger 808 Boom 5 times in rapid succession
        for (let i = 0; i < 5; i++) {
          window.play808Boom();
        }
        // Because of monophonic choking, there should only be 1 active primary voice in queue
        const activeAfterSpam = window.DJ_SAMPLER_VOICES.boom.length;

        // Test emergency panic stop
        window.stopAllSamplerFX();
        const hornAfterPanic = window.DJ_SAMPLER_VOICES.horn.length;
        const boomAfterPanic = window.DJ_SAMPLER_VOICES.boom.length;

        return { activeAfterSpam, hornAfterPanic, boomAfterPanic };
      })()
    `);

    console.log(`  ✓ 808 Boom Monophonic Choking: active voices after 5 rapid triggers = ${chokeTest.activeAfterSpam} (Choked cleanly)`);
    console.log(`  ✓ Emergency stopAllSamplerFX(): horn=${chokeTest.hornAfterPanic}, boom=${chokeTest.boomAfterPanic}`);
    if (chokeTest.activeAfterSpam > 1 || chokeTest.hornAfterPanic !== 0 || chokeTest.boomAfterPanic !== 0) {
      throw new Error('Choke group or stopAllSamplerFX failed');
    }

    // TEST 7: Extreme Concurrency & Headroom Safety (Dual Decks + Pad Spam + Tape Rec)
    console.log('\n[8/8] Testing Concurrency Headroom & Tape Recorder Safety...');
    const stressTest = await evalInPage(`
      (async () => {
        if (window.A.ctx && window.A.ctx.state === 'suspended') {
          await window.A.ctx.resume();
        }

        // Start both decks playing
        window.playDeck('A', 0);
        window.playDeck('B', 0);

        // Start Tape Recorder
        if (window.REC.state === 'idle') {
          window.recStart();
        }

        // Spam all 4 pads 10 times concurrently
        for (let i = 0; i < 10; i++) {
          window.playAirhorn();
          window.playBackspin();
          window.play808Boom();
          window.playFreshStab();
        }

        // Allow Web Audio renderer to process audio quantums
        await new Promise(r => setTimeout(r, 150));

        // Check audio context and limiter states
        const ctxState = window.A.ctx.state;
        const deckAPlaying = window.DJ.decks.A.playing;
        const deckBPlaying = window.DJ.decks.B.playing;
        const recState = window.REC.state;

        // Measure audio output levels via analyser
        const fdata = new Float32Array(512);
        window.A.an.getFloatTimeDomainData(fdata);
        let maxPeak = 0;
        for (let i = 0; i < fdata.length; i++) {
          const abs = Math.abs(fdata[i]);
          if (abs > maxPeak) maxPeak = abs;
        }

        return {
          ctxState,
          deckAPlaying,
          deckBPlaying,
          recState,
          maxPeak,
          isClipping: maxPeak > 1.0
        };
      })()
    `);

    console.log(`  ✓ AudioContext State: "${stressTest.ctxState}" under intense load`);
    console.log(`  ✓ Concurrency: Deck A playing=${stressTest.deckAPlaying}, Deck B playing=${stressTest.deckBPlaying}, REC state="${stressTest.recState}"`);
    console.log(`  ✓ Output Peak Amplitude: ${stressTest.maxPeak.toFixed(3)} (isClipping=${stressTest.isClipping}, 100% Brickwall Protected)`);

    if (stressTest.ctxState !== 'running' || stressTest.isClipping) {
      throw new Error(`Audio overload failure: maxPeak = ${stressTest.maxPeak}`);
    }

    // Stop recording and decks
    await evalInPage(`
      (() => {
        window.recStop();
        window.stopDeck('A');
        window.stopDeck('B');
        window.stopAllSamplerFX();
      })()
    `);

    console.log('\n=== TEST AUDIT RESULTS ===');
    console.log(`Console Errors count: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Console Errors detected:\n' + consoleErrors.join('\n'));
      throw new Error('Test suite encountered console errors');
    }
    console.log('✓ 0 Console Errors');
    console.log('✓ All 8 Sampler FX Test Phases PASSED (100% SUCCESS)\n');

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
