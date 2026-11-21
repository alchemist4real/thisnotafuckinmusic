const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9237;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTestSuite() {
  console.log('================================================================');
  console.log(' SIKLUS 3: DUAL-HAND TELEPROMPTER GESTURE HINTS (FINAL SIKLUS)');
  console.log(' Stage Monitor HUD, Voicing Advisor, ChordPro/LRC, Calibration');
  console.log('================================================================');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-tp-s3-suite-'));
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${tempDir}`,
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

    await new Promise(r => ws.addEventListener('open', r));

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type;
        const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        if (type === 'error' && !text.includes('Failed to load resource') && !text.includes('fonts.googleapis')) {
          consoleErrors.push(text);
        } else if (type === 'warning') {
          consoleWarnings.push(text);
        }
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: targetUrl });
    await sleep(2500);

    const testPasses = [];
    const testFails = [];

    function assert(desc, condition, detail = '') {
      if (condition) {
        testPasses.push(desc);
        console.log(`  [PASS] ${desc}`);
      } else {
        testFails.push({ desc, detail });
        console.error(`  [FAIL] ${desc} :: ${detail}`);
      }
    }

    // Enable Guided Mode for test suite
    await send('Runtime.evaluate', {
      expression: `(() => {
        if (!S.guidedMode) {
          const tb = document.getElementById('tbGuided');
          if (tb) tb.click();
        }
      })()`
    });

    // -------------------------------------------------------------
    // TEST SUITE 1: High-Contrast Stage Monitor HUD Mode
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 1: High-Contrast Stage Monitor HUD Mode ---');

    const hudInit = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          defaultHud: typeof getHudMode === 'function' ? getHudMode() : null,
          hasSetHud: typeof setHudMode === 'function',
          hasToggleHud: typeof toggleHudMode === 'function',
          hasDrawOverlay: typeof drawHudCrtOverlay === 'function',
          btnExists: !!document.getElementById('tbGuidedHud')
        };
      })()`,
      returnByValue: true
    });
    const hi = hudInit.result.value;

    assert('T1.1 Stage Monitor HUD functions defined', hi.hasSetHud && hi.hasToggleHud && hi.hasDrawOverlay);
    assert('T1.2 Default HUD mode is OFF', hi.defaultHud === false);
    assert('T1.3 Toolbar HUD button exists in DOM', hi.btnExists);

    const hudOn = await send('Runtime.evaluate', {
      expression: `(() => {
        setHudMode(true);
        const btn = document.getElementById('tbGuidedHud');
        return {
          state: getHudMode(),
          sHudMode: S.hudMode,
          btnText: btn ? btn.textContent : '',
          btnActive: btn ? btn.classList.contains('active') : false,
          btnAria: btn ? btn.getAttribute('aria-pressed') : ''
        };
      })()`,
      returnByValue: true
    });
    const ho = hudOn.result.value;

    assert('T1.4 setHudMode(true) activates HUD mode', ho.state === true && ho.sHudMode === true);
    assert('T1.5 Toolbar HUD button reflects ON label', ho.btnText.includes('HUD: ON'));
    assert('T1.6 Toolbar HUD button has active class and aria-pressed="true"', ho.btnActive === true && ho.btnAria === 'true');

    const hudOff = await send('Runtime.evaluate', {
      expression: `(() => {
        setHudMode(false);
        const btn = document.getElementById('tbGuidedHud');
        return {
          state: getHudMode(),
          sHudMode: S.hudMode,
          btnText: btn ? btn.textContent : '',
          btnActive: btn ? btn.classList.contains('active') : false,
          btnAria: btn ? btn.getAttribute('aria-pressed') : ''
        };
      })()`,
      returnByValue: true
    });
    const hf = hudOff.result.value;

    assert('T1.7 setHudMode(false) deactivates HUD mode', hf.state === false && hf.sHudMode === false);
    assert('T1.8 Toolbar HUD button reflects OFF label', hf.btnText.includes('HUD: OFF') && !hf.btnActive);

    const hudToggle = await send('Runtime.evaluate', {
      expression: `(() => {
        const s1 = toggleHudMode();
        const s2 = toggleHudMode();
        return { s1, s2 };
      })()`,
      returnByValue: true
    });
    assert('T1.9 toggleHudMode cleanly toggles state back and forth', hudToggle.result.value.s1 === true && hudToggle.result.value.s2 === false);

    const hudBtnClick = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.getElementById('tbGuidedHud');
        if (btn) btn.click();
        const afterClick = getHudMode();
        if (btn) btn.click();
        const afterSecond = getHudMode();
        return { afterClick, afterSecond };
      })()`,
      returnByValue: true
    });
    assert('T1.10 Clicking toolbar HUD button toggles mode', hudBtnClick.result.value.afterClick === true && hudBtnClick.result.value.afterSecond === false);

    // -------------------------------------------------------------
    // TEST SUITE 2: Dual-Hand Chord Voicing Advisor
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Dual-Hand Chord Voicing Advisor ---');

    const pcTest = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          c: getChordPitchClasses('C'),
          g: getChordPitchClasses('G'),
          am: getChordPitchClasses('Am'),
          f: getChordPitchClasses('F'),
          cmaj7: getChordPitchClasses('Cmaj7'),
          gb: getChordPitchClasses('G/B'),
          invalid: getChordPitchClasses('--')
        };
      })()`,
      returnByValue: true
    });
    const pc = pcTest.result.value;

    assert('T2.1 C chord pitch classes resolved [0, 4, 7]', JSON.stringify(pc.c) === JSON.stringify([0, 4, 7]));
    assert('T2.2 G chord pitch classes resolved [2, 7, 11]', JSON.stringify(pc.g) === JSON.stringify([2, 7, 11]));
    assert('T2.3 Am chord pitch classes resolved [0, 4, 9]', JSON.stringify(pc.am) === JSON.stringify([0, 4, 9]));
    assert('T2.4 F chord pitch classes resolved [0, 5, 9]', JSON.stringify(pc.f) === JSON.stringify([0, 5, 9]));
    assert('T2.5 Cmaj7 7th chord resolved with B [0, 4, 7, 11]', JSON.stringify(pc.cmaj7) === JSON.stringify([0, 4, 7, 11]));
    assert('T2.6 Slash chord G/B retains bass note B (11)', pc.gb.includes(11));
    assert('T2.7 Unmapped / invalid chord returns empty array safely', Array.isArray(pc.invalid) && pc.invalid.length === 0);

    const vlScores = await send('Runtime.evaluate', {
      expression: `(() => {
        const c_am = computeVoiceLeadingScore([0, 4, 7], [0, 4, 9]); // C -> Am
        const c_g  = computeVoiceLeadingScore([0, 4, 7], [2, 7, 11]); // C -> G
        const c_d  = computeVoiceLeadingScore([0, 4, 7], [2, 6, 9]);  // C -> D
        return { c_am, c_g, c_d };
      })()`,
      returnByValue: true
    });
    const vs = vlScores.result.value;

    assert('T2.8 C → Am voice leading score is 2 (minimal step)', vs.c_am === 2);
    assert('T2.9 C → G voice leading score is 3 (smooth step)', vs.c_g === 3);
    assert('T2.10 C → D voice leading score is 5 (moderate step)', vs.c_d === 5);

    const advAnalysis = await send('Runtime.evaluate', {
      expression: `(() => {
        const advSmooth = getDualHandVoicingAdvisor('C', 'Am');
        const advModerate = getDualHandVoicingAdvisor('C', 'D');
        const advWide = getDualHandVoicingAdvisor('C', 'Bbm7');
        return { advSmooth, advModerate, advWide };
      })()`,
      returnByValue: true
    });
    const aa = advAnalysis.result.value;

    assert('T2.11 C → Am classified as "Smooth" voice leading', aa.advSmooth.rating === 'Smooth' && aa.advSmooth.score <= 3);
    assert('T2.12 C → Am identifies 2 shared common tones (C and E)', aa.advSmooth.sharedNotes === 2);
    assert('T2.13 Smooth transition gives actionable minimal-movement tip', aa.advSmooth.tip.includes('minimal'));
    assert('T2.14 Smooth transition includes leftHand anchor & rightHand recommendation',
      aa.advSmooth.recommendedVoicing.transitionType === 'minimal' &&
      aa.advSmooth.recommendedVoicing.leftHand.length > 0 &&
      aa.advSmooth.recommendedVoicing.rightHand.length > 0
    );
    assert('T2.15 C → D classified as "Moderate" voice leading (Score 5)', aa.advModerate.rating === 'Moderate');
    assert('T2.16 C → Bbm7 provides actionable position guidance', !!aa.advWide.rating && !!aa.advWide.tip);

    const curAdv = await send('Runtime.evaluate', {
      expression: `(() => {
        teleprompterIdx = 0;
        const adv = getCurrentVoicingAdvisor();
        return adv ? { current: adv.currentChord, next: adv.nextChord, rating: adv.rating } : null;
      })()`,
      returnByValue: true
    });
    assert('T2.17 getCurrentVoicingAdvisor returns active→next analysis for teleprompter', curAdv.result.value !== null && !!curAdv.result.value.rating);

    const layoutAdvisor = await send('Runtime.evaluate', {
      expression: `(() => {
        const l = getTeleprompterLayout(1280, 720, 1.0);
        return {
          hasVoicingAdvisor: !!l.voicingAdvisor,
          x: l.voicingAdvisor ? l.voicingAdvisor.x : 0,
          w: l.voicingAdvisor ? l.voicingAdvisor.w : 0,
          h: l.voicingAdvisor ? l.voicingAdvisor.h : 0,
          withinCenter: l.voicingAdvisor ? (l.voicingAdvisor.x >= l.leftX + l.cardW && (l.voicingAdvisor.x + l.voicingAdvisor.w) <= l.rightX) : false
        };
      })()`,
      returnByValue: true
    });
    const la = layoutAdvisor.result.value;
    assert('T2.18 Teleprompter layout includes voicingAdvisor box', la.hasVoicingAdvisor && la.w > 0 && la.h > 0);
    assert('T2.19 Voicing Advisor positioned within stage center clearance', la.withinCenter);

    // -------------------------------------------------------------
    // TEST SUITE 3: Chord Sheet Import/Export (.chordpro, .lrc, plaintext)
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: Chord Sheet Import/Export (.chordpro, .lrc, plaintext) ---');

    const sampleChordPro = `{title: Dangdut Asik}
{comment: Verse 1}
[Am]Kala ku pandang [Dm]kerlap-kerlip bintang
[E]Nan jauh disana [Am]sayup terdengar
{soc}
[Dm]Melodi cinta [Am]yang syahdu
{eoc}`;

    const parsedChordPro = await send('Runtime.evaluate', {
      expression: `(() => {
        return parseChordProText(${JSON.stringify(sampleChordPro)});
      })()`,
      returnByValue: true
    });
    const cpLines = parsedChordPro.result.value;

    assert('T3.1 parseChordProText parses 6 chords from ChordPro sample', cpLines.length === 6);
    assert('T3.2 ChordPro section header mapped correctly ({comment: Verse 1})', cpLines[0].section === 'Verse 1' && cpLines[0].chord === 'Am');
    assert('T3.3 ChordPro inline lyric segment correctly assigned', cpLines[0].lyric.includes('Kala ku pandang'));
    assert('T3.4 ChordPro second chord on line assigned following lyric', cpLines[1].chord === 'Dm' && cpLines[1].lyric.includes('kerlap-kerlip'));
    assert('T3.5 ChordPro chorus directive {soc} sets Chorus section', cpLines[4].section === 'Chorus' && cpLines[4].chord === 'Dm');

    const sampleLrc = `[00:04.50][C] Senandung nada indah
[00:08.20][G] Mengalun syahdu
[00:12.75][Am] Menembus batas malam
[00:16.00][F] Bersama melodi`;

    const parsedLrc = await send('Runtime.evaluate', {
      expression: `(() => {
        return parseLrcText(${JSON.stringify(sampleLrc)});
      })()`,
      returnByValue: true
    });
    const lrcLines = parsedLrc.result.value;

    assert('T3.6 parseLrcText parses 4 timestamped chord lines', lrcLines.length === 4);
    assert('T3.7 First LRC line parsed timestamp 4.5s with C chord', lrcLines[0].chord === 'C' && Math.abs(lrcLines[0].timestamp - 4.5) < 0.05);
    assert('T3.8 Second LRC line parsed timestamp 8.2s with G chord', lrcLines[1].chord === 'G' && Math.abs(lrcLines[1].timestamp - 8.2) < 0.05);
    assert('T3.9 Third LRC line parsed timestamp 12.75s with Am chord', lrcLines[2].chord === 'Am' && Math.abs(lrcLines[2].timestamp - 12.75) < 0.05);

    const samplePlaintext = `[Intro]
C  G  Am  F
Lirik intro yang santai

[Reff]
C           G
Senandung nada indah
Am          F
Menembus malam`;

    const parsedPlain = await send('Runtime.evaluate', {
      expression: `(() => {
        return parsePlaintextChordSheet(${JSON.stringify(samplePlaintext)});
      })()`,
      returnByValue: true
    });
    const ptLines = parsedPlain.result.value;

    assert('T3.10 parsePlaintextChordSheet parses chords from plaintext', ptLines.length >= 4);
    assert('T3.11 Plaintext recognizes section header [Intro]', ptLines[0].section === 'Intro' && ptLines[0].chord === 'C');

    // Test importChordSheet with auto-detection
    const importAutoCP = await send('Runtime.evaluate', {
      expression: `(() => {
        const res = importChordSheet(${JSON.stringify(sampleChordPro)});
        return {
          count: res.length,
          tpCount: teleprompterLines.length,
          format: S._importedFormat
        };
      })()`,
      returnByValue: true
    });
    assert('T3.12 importChordSheet auto-detects ChordPro and populates teleprompterLines',
      importAutoCP.result.value.count === 6 &&
      importAutoCP.result.value.tpCount === 6 &&
      importAutoCP.result.value.format === 'chordpro'
    );

    const importAutoLrc = await send('Runtime.evaluate', {
      expression: `(() => {
        const res = importChordSheet(${JSON.stringify(sampleLrc)});
        return {
          count: res.length,
          tpCount: teleprompterLines.length,
          format: S._importedFormat
        };
      })()`,
      returnByValue: true
    });
    assert('T3.13 importChordSheet auto-detects LRC and populates teleprompterLines',
      importAutoLrc.result.value.count === 4 &&
      importAutoLrc.result.value.tpCount === 4 &&
      importAutoLrc.result.value.format === 'lrc'
    );

    // Test exportChordSheet across all 3 formats
    const exportedCP = await send('Runtime.evaluate', {
      expression: `exportChordSheet('chordpro')`,
      returnByValue: true
    });
    const ecp = exportedCP.result.value;
    assert('T3.14 exportChordSheet("chordpro") produces inline [Chord] and {comment} text',
      ecp.includes('[C]') && ecp.includes('[G]') && ecp.includes('{comment:')
    );

    const exportedLrc = await send('Runtime.evaluate', {
      expression: `exportChordSheet('lrc')`,
      returnByValue: true
    });
    const elrc = exportedLrc.result.value;
    assert('T3.15 exportChordSheet("lrc") produces [mm:ss.cs] timestamps and [Chord]',
      elrc.includes('[00:') && elrc.includes('[C]')
    );

    const exportedPlain = await send('Runtime.evaluate', {
      expression: `exportChordSheet('plaintext')`,
      returnByValue: true
    });
    const ept = exportedPlain.result.value;
    assert('T3.16 exportChordSheet("plaintext") produces clean section headers and chords',
      ept.includes('C') && ept.includes('G')
    );

    // Round-trip verification: re-importing exported ChordPro gives identical progression
    const roundTrip = await send('Runtime.evaluate', {
      expression: `(() => {
        const exported = exportChordSheet('chordpro');
        const reimported = parseChordProText(exported);
        return {
          origLen: teleprompterLines.length,
          reLen: reimported.length,
          chordsMatch: teleprompterLines.every((l, idx) => l.chord === reimported[idx].chord)
        };
      })()`,
      returnByValue: true
    });
    const rt = roundTrip.result.value;
    assert('T3.17 Round-trip fidelity: export to ChordPro and re-parse matches progression 100%',
      rt.origLen === rt.reLen && rt.chordsMatch === true
    );

    // -------------------------------------------------------------
    // TEST SUITE 4: Adaptive Gesture Sensitivity Calibration
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 4: Adaptive Gesture Sensitivity Calibration ---');

    const calibInit = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          sens: getGestureSensitivity(),
          state: getCalibrationState()
        };
      })()`,
      returnByValue: true
    });
    assert('T4.1 Default gesture sensitivity is 0.5 (50% threshold)', calibInit.result.value.sens === 0.5);

    const calibSet = await send('Runtime.evaluate', {
      expression: `(() => {
        const sHigh = setGestureSensitivity(0.85);
        const sLow = setGestureSensitivity(0.15);
        const sClampMin = setGestureSensitivity(0.01);
        const sClampMax = setGestureSensitivity(1.50);
        setGestureSensitivity(0.50); // reset
        return { sHigh, sLow, sClampMin, sClampMax };
      })()`,
      returnByValue: true
    });
    const cs = calibSet.result.value;
    assert('T4.2 setGestureSensitivity sets value accurately (0.85, 0.15)', cs.sHigh === 0.85 && cs.sLow === 0.15);
    assert('T4.3 setGestureSensitivity clamps out-of-range values to [0.1, 0.9]', cs.sClampMin === 0.1 && cs.sClampMax === 0.9);

    const autoCalib = await send('Runtime.evaluate', {
      expression: `(() => {
        resetCalibrationHistory();
        const emptyState = getCalibrationState();

        // Feed 5 high-confidence detections (>0.90)
        recordKeyPointConfidence(0.95);
        recordKeyPointConfidence(0.92);
        recordKeyPointConfidence(0.98);
        recordKeyPointConfidence(0.94);
        recordKeyPointConfidence(0.96);

        const readyState = getCalibrationState();
        const autoSens = autoCalibrateSensitivity();

        return {
          emptyReady: emptyState.readyToCalibrate,
          recordCount: readyState.historyCount,
          avgConf: readyState.avgConfidence,
          readyToCalibrate: readyState.readyToCalibrate,
          autoSens
        };
      })()`,
      returnByValue: true
    });
    const ac = autoCalib.result.value;

    assert('T4.4 Calibration history empty before recording', ac.emptyReady === false);
    assert('T4.5 recordKeyPointConfidence records 5 samples', ac.recordCount === 5);
    assert('T4.6 Average confidence computed accurately (>0.90)', ac.avgConf >= 0.90 && ac.readyToCalibrate === true);
    assert('T4.7 autoCalibrateSensitivity adapts sensitivity inversely based on high confidence', ac.autoSens >= 0.1 && ac.autoSens <= 0.5);

    const resetHistory = await send('Runtime.evaluate', {
      expression: `(() => {
        resetCalibrationHistory();
        return getCalibrationState();
      })()`,
      returnByValue: true
    });
    assert('T4.8 resetCalibrationHistory clears buffer', resetHistory.result.value.historyCount === 0);

    // Test gesture accuracy integration with sensitivity
    const sensAccuracy = await send('Runtime.evaluate', {
      expression: `(() => {
        setGestureSensitivity(0.2); // lenient
        const accLenient = getGestureAccuracy();
        setGestureSensitivity(0.8); // strict
        const accStrict = getGestureAccuracy();
        setGestureSensitivity(0.5); // restore
        return {
          lenientThreshold: accLenient.matchThreshold,
          strictThreshold: accStrict.matchThreshold
        };
      })()`,
      returnByValue: true
    });
    const sa = sensAccuracy.result.value;
    assert('T4.9 Gesture match threshold scales with sensitivity (lenient < strict)', sa.lenientThreshold < sa.strictThreshold);

    // -------------------------------------------------------------
    // TEST SUITE 5: Keyboard Shortcuts & Canvas Click Interaction
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 5: Keyboard Shortcuts & Canvas Click Interaction ---');

    const keyH = await send('Runtime.evaluate', {
      expression: `(() => {
        setHudMode(false);
        const ev = new KeyboardEvent('keydown', { key: 'h', bubbles: true, cancelable: true });
        window.dispatchEvent(ev);
        const afterKeyH = getHudMode();
        window.dispatchEvent(ev);
        const afterSecondH = getHudMode();
        return { afterKeyH, afterSecondH };
      })()`,
      returnByValue: true
    });
    assert('T5.1 Key "h" toggles Stage Monitor HUD mode ON and OFF', keyH.result.value.afterKeyH === true && keyH.result.value.afterSecondH === false);

    const clickHudBadge = await send('Runtime.evaluate', {
      expression: `(() => {
        setHudMode(false);
        const out = document.getElementById('out');
        const l = getTeleprompterLayout(out.width, out.height, out.height / 720);
        const hb = l.topRibbon.hudBadge;

        // Simulate click at hudBadge center
        const clickX = hb.x + hb.w / 2;
        const clickY = hb.y + hb.h / 2;
        const rect = out.getBoundingClientRect();
        const clientX = rect.left + (clickX / out.width) * rect.width;
        const clientY = rect.top + (clickY / out.height) * rect.height;

        const ev = new MouseEvent('click', { clientX, clientY, bubbles: true });
        out.dispatchEvent(ev);
        const afterClick = getHudMode();

        out.dispatchEvent(ev);
        const afterSecond = getHudMode();

        return { afterClick, afterSecond };
      })()`,
      returnByValue: true
    });
    assert('T5.2 Clicking canvas top ribbon HUD badge toggles HUD mode', clickHudBadge.result.value.afterClick === true && clickHudBadge.result.value.afterSecond === false);

    const clickAdvisor = await send('Runtime.evaluate', {
      expression: `(() => {
        const out = document.getElementById('out');
        const l = getTeleprompterLayout(out.width, out.height, out.height / 720);
        const va = l.voicingAdvisor;

        const clickX = va.x + va.w / 2;
        const clickY = va.y + va.h / 2;
        const rect = out.getBoundingClientRect();
        const clientX = rect.left + (clickX / out.width) * rect.width;
        const clientY = rect.top + (clickY / out.height) * rect.height;

        let threw = false;
        try {
          const ev = new MouseEvent('click', { clientX, clientY, bubbles: true });
          out.dispatchEvent(ev);
        } catch (_) { threw = true; }

        return { threw };
      })()`,
      returnByValue: true
    });
    assert('T5.3 Clicking Voicing Advisor on canvas executes safely without errors', clickAdvisor.result.value.threw === false);

    // -------------------------------------------------------------
    // TEST SUITE 6: Multi-Theme Canvas HUD & Voicing Rendering
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 6: Multi-Theme Canvas HUD & Voicing Rendering ---');

    const renderTest = await send('Runtime.evaluate', {
      expression: `(() => {
        setHudMode(true);
        const out = document.getElementById('out');
        const themes = ['matrix', 'amber', 'navy'];
        const results = {};

        themes.forEach(th => {
          setTeleprompterTheme(th);
          try {
            drawTeleprompter(out.width, out.height, out.height / 720);
            results[th] = true;
          } catch (e) {
            results[th] = e.message;
          }
        });

        const ctx = (typeof octx !== 'undefined' && octx) ? octx : out.getContext('2d');
        // Test standalone drawHudCrtOverlay
        let hudStandalonePass = false;
        let hudErr = '';
        try {
          drawHudCrtOverlay(ctx, out.width, out.height, getTeleprompterTheme(), out.height / 720);
          hudStandalonePass = true;
        } catch (e) { hudErr = e.message; }

        // Test drawVoicingAdvisor standalone
        let advisorStandalonePass = false;
        let advErr = '';
        try {
          const adv = getDualHandVoicingAdvisor('C', 'G');
          drawVoicingAdvisor(ctx, 200, 500, 300, 24, adv, getTeleprompterTheme(), 1.0);
          advisorStandalonePass = true;
        } catch (e) { advErr = e.message; }

        return { results, hudStandalonePass, advisorStandalonePass };
      })()`,
      returnByValue: true
    });
    const rend = renderTest.result.value;

    assert('T6.1 Retro Matrix Green with HUD renders cleanly', rend.results.matrix === true);
    assert('T6.2 Cyberpunk Amber CRT with HUD renders cleanly', rend.results.amber === true);
    assert('T6.3 Classic Win98 Navy with HUD renders cleanly', rend.results.navy === true);
    assert('T6.4 drawHudCrtOverlay standalone execution passes without exceptions', rend.hudStandalonePass === true);
    assert('T6.5 drawVoicingAdvisor standalone execution passes without exceptions', rend.advisorStandalonePass === true);

    // Capture visual screenshot of verified Siklus 3 state
    const ss = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'test_siklus3_teleprompter_verified.png'), Buffer.from(ss.data, 'base64'));
    assert('T6.6 Visual screenshot captured to test_siklus3_teleprompter_verified.png', true);

    // -------------------------------------------------------------
    // TEST SUITE 7: Center Clearance Lane Compliance Across All Viewports
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 7: Center Clearance Lane Compliance Across All Viewports ---');

    const viewports = [
      { name: '1280x720 (Standard HD)', w: 1280, h: 720 },
      { name: '1920x1080 (Full HD)', w: 1920, h: 1080 },
      { name: '960x720 (4:3 Camcorder)', w: 960, h: 720 },
      { name: '640x360 (Small Preview)', w: 640, h: 360 },
      { name: '600x800 (Narrow Mobile)', w: 600, h: 800 }
    ];

    for (let i = 0; i < viewports.length; i++) {
      const vp = viewports[i];
      const vpRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const l = getTeleprompterLayout(${vp.w}, ${vp.h}, ${vp.h / 720});
          return {
            ratio: l.centerClearance.ratio,
            pass: l.centerClearance.pass50Pct,
            hasAdv: !!l.voicingAdvisor,
            hasHud: !!l.topRibbon.hudBadge
          };
        })()`,
        returnByValue: true
      });
      const vpr = vpRes.result.value;
      const pct = (vpr.ratio * 100).toFixed(1);
      assert(`T7.${i + 1} Viewport ${vp.name} clearance is ${pct}% (>= 50%) with Voicing Advisor & HUD`,
        vpr.pass === true && vpr.ratio >= 0.50 && vpr.hasAdv && vpr.hasHud
      );
    }

    // -------------------------------------------------------------
    // TEST SUITE 8: Zero Console Errors
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 8: Zero Console Errors ---');
    assert('T8.1 Zero console errors recorded during Siklus 3 test execution', consoleErrors.length === 0, consoleErrors.join('; '));

    console.log('\n================================================================');
    console.log(` TOTAL TESTS PASS: ${testPasses.length}`);
    console.log(` TOTAL TESTS FAIL: ${testFails.length}`);
    console.log(` CONSOLE ERRORS:   ${consoleErrors.length}`);
    console.log('================================================================\n');

    if (testFails.length > 0 || consoleErrors.length > 0) {
      console.error('FAILED TESTS:');
      testFails.forEach(f => console.error(`  - ${f.desc} :: ${f.detail}`));
      if (consoleErrors.length > 0) {
        console.error('CONSOLE ERRORS:');
        consoleErrors.forEach(e => console.error(`  - ${e}`));
      }
      process.exit(1);
    } else {
      console.log('ALL SIKLUS 3 TESTS PASSED WITH 100% SUCCESS RATE AND 0 CONSOLE ERRORS!');
      process.exit(0);
    }

  } catch (err) {
    console.error('Test Suite Error:', err);
    process.exit(1);
  } finally {
    try { chrome.kill(); } catch (_) {}
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}

runTestSuite();
