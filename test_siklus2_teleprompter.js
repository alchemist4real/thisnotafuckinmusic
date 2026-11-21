const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9236;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTestSuite() {
  console.log('================================================================');
  console.log(' SIKLUS 2: DUAL-HAND TELEPROMPTER GESTURE HINTS & CRT ENHANCEMENTS');
  console.log('================================================================');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-tp-s2-suite-'));
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

    // Enable Guided Mode for all subsequent tests
    await send('Runtime.evaluate', {
      expression: `(() => {
        if (!S.guidedMode) {
          const tb = document.getElementById('tbGuided');
          if (tb) tb.click();
        }
      })()`
    });

    // -------------------------------------------------------------
    // TEST 1: CRT Color Theme Switcher Engine
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 1: CRT Color Theme Switcher Engine ---');
    const t1 = await send('Runtime.evaluate', {
      expression: `(() => {
        const themes = window.TP_THEMES || {};
        const hasMatrix = !!themes.matrix && themes.matrix.glow === '#57FF6A';
        const hasAmber = !!themes.amber && themes.amber.glow === '#FFB000';
        const hasNavy = !!themes.navy && themes.navy.glow === '#22D3EE';

        // 1. Initial theme getter
        const initTheme = window.getTeleprompterTheme();

        // 2. Set Amber CRT
        window.setTeleprompterTheme('amber');
        const amberTheme = window.getTeleprompterTheme();
        const amberState = S.tpTheme;
        const amberBtnTxt = (document.getElementById('tbGuidedTheme') || {}).textContent || '';

        // 3. Set Classic Win98 Navy
        window.setTeleprompterTheme('navy');
        const navyTheme = window.getTeleprompterTheme();
        const navyState = S.tpTheme;
        const navyBtnTxt = (document.getElementById('tbGuidedTheme') || {}).textContent || '';

        // 4. Cycle theme
        window.cycleTeleprompterTheme(); // navy -> matrix
        const matrixAfterCycle = window.getTeleprompterTheme();

        // 5. Test toolbar button click
        const themeBtn = document.getElementById('tbGuidedTheme');
        if (themeBtn) themeBtn.click(); // matrix -> amber
        const stateAfterBtn = S.tpTheme;

        // Reset to matrix for subsequent tests
        window.setTeleprompterTheme('matrix');

        return {
          hasMatrix, hasAmber, hasNavy,
          initThemeId: initTheme.id,
          amberThemeId: amberTheme.id,
          amberState, amberBtnTxt,
          navyThemeId: navyTheme.id,
          navyState, navyBtnTxt,
          matrixAfterCycleId: matrixAfterCycle.id,
          stateAfterBtn
        };
      })()`,
      returnByValue: true
    });
    const r1 = t1.result.value;
    assert('T1.1 Retro Matrix Green theme defined (#57FF6A phosphor glow)', r1.hasMatrix === true);
    assert('T1.2 Cyberpunk Amber CRT theme defined (#FFB000 amber glow)', r1.hasAmber === true);
    assert('T1.3 Classic Win98 Navy theme defined (#22D3EE cyan glow)', r1.hasNavy === true);
    assert('T1.4 getTeleprompterTheme returns valid theme object', typeof r1.initThemeId === 'string');
    assert('T1.5 setTeleprompterTheme("amber") updates state and theme', r1.amberThemeId === 'amber' && r1.amberState === 'amber');
    assert('T1.6 Toolbar button reflects Amber CRT label', r1.amberBtnTxt.includes('Amber'));
    assert('T1.7 setTeleprompterTheme("navy") updates state to navy', r1.navyThemeId === 'navy' && r1.navyState === 'navy');
    assert('T1.8 Toolbar button reflects Win98 Navy label', r1.navyBtnTxt.includes('Navy'));
    assert('T1.9 cycleTeleprompterTheme cycles cleanly to matrix', r1.matrixAfterCycleId === 'matrix');
    assert('T1.10 Toolbar button click cycles teleprompter theme', r1.stateAfterBtn === 'amber');

    // -------------------------------------------------------------
    // TEST 2: Mini Fretboard & Keyboard Key Visualization (Left Hand)
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Mini Fretboard & Keyboard Key Visualization ---');
    const t2 = await send('Runtime.evaluate', {
      expression: `(() => {
        // 1. Test Fretboard data generation for open C chord
        const cData = window.getChordFretboardData('C');
        const cHasFrets = Array.isArray(cData?.frets) && cData.frets.length === 6;
        const cFret1String = cData?.frets[4] === 1; // B string 1st fret

        // 2. Test Fretboard data for G chord
        const gData = window.getChordFretboardData('G');
        const gHasFrets = Array.isArray(gData?.frets) && gData.frets.length === 6;

        // 3. Test Barre chord Bm
        const bmData = window.getChordFretboardData('Bm');
        const bmHasPcs = Array.isArray(bmData?.pcs) && bmData.pcs.length >= 3;

        // 4. Test Mode toggling
        const initMode = S.tpDiagMode;
        window.setTeleprompterDiagMode('keyboard');
        const modeKeys = S.tpDiagMode;
        window.toggleTeleprompterDiagMode();
        const modeFret = S.tpDiagMode;

        // 5. Test canvas rendering execution of mini fretboard & keyboard
        const outCanvas = document.getElementById('out');
        const ctx = outCanvas.getContext('2d');
        const theme = window.getTeleprompterTheme();
        let fretRenderOk = false;
        let keyRenderOk = false;
        try {
          window.drawMiniFretboard(ctx, 20, 20, 40, 34, cData, theme, 1);
          fretRenderOk = true;
        } catch (e) {
          fretRenderOk = false;
        }
        try {
          window.drawMiniKeyboard(ctx, 20, 20, 40, 34, cData, theme, 1);
          keyRenderOk = true;
        } catch (e) {
          keyRenderOk = false;
        }

        return {
          cHasFrets, cFret1String,
          gHasFrets,
          bmHasPcs,
          modeKeys, modeFret,
          fretRenderOk, keyRenderOk
        };
      })()`,
      returnByValue: true
    });
    const r2 = t2.result.value;
    assert('T2.1 getChordFretboardData returns 6-string fret positions for C chord', r2.cHasFrets === true);
    assert('T2.2 C chord correctly identifies index finger on 1st fret B string', r2.cFret1String === true);
    assert('T2.3 G chord returns valid 6-string open guitar frets', r2.gHasFrets === true);
    assert('T2.4 Minor/Barre chord yields valid pitch class array for piano keys', r2.bmHasPcs === true);
    assert('T2.5 setTeleprompterDiagMode("keyboard") sets diagram mode', r2.modeKeys === 'keyboard');
    assert('T2.6 toggleTeleprompterDiagMode toggles back to "fretboard"', r2.modeFret === 'fretboard');
    assert('T2.7 drawMiniFretboard renders without throwing exceptions', r2.fretRenderOk === true);
    assert('T2.8 drawMiniKeyboard renders without throwing exceptions', r2.keyRenderOk === true);

    // -------------------------------------------------------------
    // TEST 3: Real-Time Gesture Proximity & Accuracy Bar
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: Real-Time Gesture Proximity & Accuracy Bar ---');
    const t3 = await send('Runtime.evaluate', {
      expression: `(() => {
        // 1. Initial accuracy when hands not detected
        window.hands.L.lm = null;
        window.hands.L.f = null;
        window.hands.R.lm = null;
        window.hands.R.f = null;
        const accStandby = window.getGestureAccuracy();

        // 2. Set teleprompter to pad 1 (target chord C, pat [0, 1, 0, 0, 0])
        window.teleprompterIdx = 0;
        const curLine = window.teleprompterLines[0];
        const curLH = window.getLeftHandHint(curLine.chord);
        const targetPat = curLH.pat; // [0, 1, 0, 0, 0]

        // 3. Simulate 100% matching Left Hand (5/5 fingers match)
        window.hands.L.lm = [{ x: 0.2, y: 0.5 }];
        window.hands.L.seen = performance.now();
        window.hands.L.f = targetPat.map(v => v === 1);
        const accMatch100 = window.getGestureAccuracy();

        // 4. Simulate partial match (3/5 fingers match)
        window.hands.L.f = [!targetPat[0], targetPat[1], !targetPat[2], targetPat[3], targetPat[4]];
        const accMatch60 = window.getGestureAccuracy();

        // 5. Test accuracy meter rendering function
        const outCanvas = document.getElementById('out');
        const ctx = outCanvas.getContext('2d');
        const theme = window.getTeleprompterTheme();
        let meterRenderStandbyOk = false;
        let meterRenderActiveOk = false;
        try {
          window.drawGestureAccuracyMeter(ctx, 30, 30, 80, 12, accStandby.left, theme, 1);
          meterRenderStandbyOk = true;
          window.drawGestureAccuracyMeter(ctx, 30, 30, 80, 12, accMatch100.left, theme, 1);
          meterRenderActiveOk = true;
        } catch (e) {
          meterRenderStandbyOk = false;
        }

        // Clean up simulated hands
        window.hands.L.lm = null;
        window.hands.L.f = null;

        return {
          standbyLeftDetected: accStandby.left.detected,
          standbyRightDetected: accStandby.right.detected,
          standbyScore: accStandby.overall,
          match100Detected: accMatch100.left.detected,
          match100Score: accMatch100.left.score,
          match100Pct: accMatch100.left.pct,
          match100Fingers: accMatch100.left.matchFingers,
          match60Score: accMatch60.left.score,
          match60Pct: accMatch60.left.pct,
          meterRenderStandbyOk,
          meterRenderActiveOk
        };
      })()`,
      returnByValue: true
    });
    const r3 = t3.result.value;
    assert('T3.1 Standby mode correctly reflects hands not detected', r3.standbyLeftDetected === false && r3.standbyRightDetected === false);
    assert('T3.2 Standby overall score is 0%', r3.standbyScore === 0);
    assert('T3.3 Detected hand reports active status', r3.match100Detected === true);
    assert('T3.4 5/5 finger match produces 1.0 score (100% accuracy)', r3.match100Score === 1.0 && r3.match100Pct === 100);
    assert('T3.5 Match count correctly reports 5 fingers', r3.match100Fingers === 5);
    assert('T3.6 Partial match evaluates accurately (60% match)', r3.match60Score === 0.6 && r3.match60Pct === 60);
    assert('T3.7 Standby accuracy meter renders on canvas cleanly', r3.meterRenderStandbyOk === true);
    assert('T3.8 Active accuracy meter renders on canvas cleanly', r3.meterRenderActiveOk === true);

    // -------------------------------------------------------------
    // TEST 4: Auto-Scroll Speed Adjustment & Metronome Sync Engine
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 4: Auto-Scroll Speed & Metronome Sync Engine ---');
    const t4 = await send('Runtime.evaluate', {
      expression: `(() => {
        // 1. Initial Auto-Advance state
        const initAuto = S.tpAutoAdvance;

        // 2. Enable Auto-Advance with parameters
        window.setTeleprompterAutoAdvance(true, 1.5, true, 4);
        const state1 = {
          enabled: S.tpAutoAdvance,
          speed: S.tpScrollSpeed,
          sync: S.tpMetronomeSync,
          beats: S.tpBeatsPerChord
        };
        const btnTxt1 = (document.getElementById('tbGuidedAuto') || {}).textContent || '';

        // 3. Speed adjustment
        window.setTeleprompterScrollSpeed(2.0);
        const speed2 = S.tpScrollSpeed;

        // 4. Metronome sync toggle
        window.setTeleprompterMetronomeSync(false);
        const syncOff = S.tpMetronomeSync;
        const btnTxt2 = (document.getElementById('tbGuidedAuto') || {}).textContent || '';

        // 5. Toggle Auto-Advance OFF
        window.toggleTeleprompterAutoAdvance();
        const autoOff = S.tpAutoAdvance;
        const btnTxtOff = (document.getElementById('tbGuidedAuto') || {}).textContent || '';

        // 6. Test toolbar button click toggle
        const autoBtn = document.getElementById('tbGuidedAuto');
        if (autoBtn) autoBtn.click();
        const autoAfterBtn = S.tpAutoAdvance;
        if (autoBtn) autoBtn.click(); // turn back off

        return {
          initAuto,
          state1, btnTxt1,
          speed2,
          syncOff, btnTxt2,
          autoOff, btnTxtOff,
          autoAfterBtn
        };
      })()`,
      returnByValue: true
    });
    const r4 = t4.result.value;
    assert('T4.1 Default tpAutoAdvance is false', r4.initAuto === false);
    assert('T4.2 setTeleprompterAutoAdvance enables auto-advance', r4.state1.enabled === true);
    assert('T4.3 Metronome sync enabled with 1.5x speed', r4.state1.sync === true && r4.state1.speed === 1.5);
    assert('T4.4 Toolbar button reflects Metronome Sync state', r4.btnTxt1.includes('Sync'));
    assert('T4.5 setTeleprompterScrollSpeed updates speed to 2.0x', r4.speed2 === 2.0);
    assert('T4.6 setTeleprompterMetronomeSync(false) switches to timer mode', r4.syncOff === false);
    assert('T4.7 Toolbar button reflects Auto Timer mode', r4.btnTxt2.includes('Auto: 2x'));
    assert('T4.8 toggleTeleprompterAutoAdvance turns auto-advance OFF', r4.autoOff === false);
    assert('T4.9 Toolbar button reflects OFF state', r4.btnTxtOff.includes('OFF'));
    assert('T4.10 Clicking toolbar Auto-Advance button toggles state ON', r4.autoAfterBtn === true);

    // -------------------------------------------------------------
    // TEST 5: Interactive Auto-Advance Execution (Time-based Progression)
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 5: Interactive Auto-Advance Execution ---');
    const t5 = await send('Runtime.evaluate', {
      expression: `(() => {
        window.teleprompterIdx = 0;
        const startIdx = window.teleprompterIdx;

        // Configure fast auto-advance (e.g. speed 8.0x -> ~500ms per step)
        window.setTeleprompterAutoAdvance(true, 8.0, false, 4);
        window._tpLastAdvance = performance.now() - 600; // simulate elapsed time past stepDuration

        // Execute drawTeleprompter to trigger time check
        const outCanvas = document.getElementById('out');
        window.drawTeleprompter(outCanvas.width, outCanvas.height, outCanvas.height / 720);

        const idxAfterElapsed = window.teleprompterIdx;

        // Turn auto advance off
        window.setTeleprompterAutoAdvance(false);

        return { startIdx, idxAfterElapsed };
      })()`,
      returnByValue: true
    });
    const r5 = t5.result.value;
    assert('T5.1 Time elapsed beyond chord duration advances step automatically', r5.idxAfterElapsed === (r5.startIdx + 1) % 7);

    // -------------------------------------------------------------
    // TEST 6: Keyboard & Canvas Click Interaction (Siklus 2 Shortcuts)
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 6: Keyboard & Canvas Click Interaction ---');

    // 6.1 Theme shortcut 't'
    const t6_theme = await send('Runtime.evaluate', {
      expression: `(() => {
        window.setTeleprompterTheme('matrix');
        const preTheme = S.tpTheme;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        const postTheme = S.tpTheme;
        return { preTheme, postTheme };
      })()`,
      returnByValue: true
    });
    const r6_t = t6_theme.result.value;
    assert('T6.1 Key "t" cycles teleprompter CRT theme', r6_t.preTheme === 'matrix' && r6_t.postTheme === 'amber');

    // 6.2 Diagram mode shortcut 'v'
    const t6_diag = await send('Runtime.evaluate', {
      expression: `(() => {
        window.setTeleprompterDiagMode('fretboard');
        const preDiag = S.tpDiagMode;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', bubbles: true }));
        const postDiag = S.tpDiagMode;
        return { preDiag, postDiag };
      })()`,
      returnByValue: true
    });
    const r6_v = t6_diag.result.value;
    assert('T6.2 Key "v" toggles diagram mode between fretboard and keyboard', r6_v.preDiag === 'fretboard' && r6_v.postDiag === 'keyboard');

    // 6.3 Auto-advance shortcut 'a'
    const t6_auto = await send('Runtime.evaluate', {
      expression: `(() => {
        window.setTeleprompterAutoAdvance(false);
        const preAuto = S.tpAutoAdvance;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        const postAuto = S.tpAutoAdvance;
        window.setTeleprompterAutoAdvance(false); // reset
        return { preAuto, postAuto };
      })()`,
      returnByValue: true
    });
    const r6_a = t6_auto.result.value;
    assert('T6.3 Key "a" toggles teleprompter auto-advance state', r6_a.preAuto === false && r6_a.postAuto === true);

    // 6.4 Metronome sync shortcut 'm'
    const t6_metro = await send('Runtime.evaluate', {
      expression: `(() => {
        window.setTeleprompterMetronomeSync(false);
        const preMetro = S.tpMetronomeSync;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
        const postMetro = S.tpMetronomeSync;
        window.setTeleprompterMetronomeSync(false); // reset
        return { preMetro, postMetro };
      })()`,
      returnByValue: true
    });
    const r6_m = t6_metro.result.value;
    assert('T6.4 Key "m" toggles tempo metronome sync', r6_m.preMetro === false && r6_m.postMetro === true);

    // 6.5 Speed adjustments '+' and '-'
    const t6_spd = await send('Runtime.evaluate', {
      expression: `(() => {
        window.setTeleprompterScrollSpeed(1.0);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
        const spdPlus = S.tpScrollSpeed;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));
        const spdMinus = S.tpScrollSpeed;
        return { spdPlus, spdMinus };
      })()`,
      returnByValue: true
    });
    const r6_s = t6_spd.result.value;
    assert('T6.5 Key "+" increases auto-advance speed', r6_s.spdPlus === 1.25);
    assert('T6.6 Key "-" decreases auto-advance speed', r6_s.spdMinus === 1.0);

    // 6.7 Canvas click on Theme Badge & Auto Badge
    const t6_badges = await send('Runtime.evaluate', {
      expression: `(() => {
        const outCanvas = document.getElementById('out');
        const u = outCanvas.height / 720;
        const layout = window.getTeleprompterLayout(outCanvas.width, outCanvas.height, u);
        const tb = layout.topRibbon.themeBadge;
        const ab = layout.topRibbon.autoBadge;
        const da = layout.activeLH.diagArea;

        // Click Theme Badge
        window.setTeleprompterTheme('matrix');
        const preTheme = S.tpTheme;
        const rect = outCanvas.getBoundingClientRect();
        const clientX_theme = rect.left + ((tb.x + tb.w / 2) / outCanvas.width) * rect.width;
        const clientY_theme = rect.top + ((tb.y + tb.h / 2) / outCanvas.height) * rect.height;
        outCanvas.dispatchEvent(new MouseEvent('click', { clientX: clientX_theme, clientY: clientY_theme, bubbles: true }));
        const postTheme = S.tpTheme;

        // Click Auto Badge
        window.setTeleprompterAutoAdvance(false);
        const preAuto = S.tpAutoAdvance;
        const clientX_auto = rect.left + ((ab.x + ab.w / 2) / outCanvas.width) * rect.width;
        const clientY_auto = rect.top + ((ab.y + ab.h / 2) / outCanvas.height) * rect.height;
        outCanvas.dispatchEvent(new MouseEvent('click', { clientX: clientX_auto, clientY: clientY_auto, bubbles: true }));
        const postAuto = S.tpAutoAdvance;
        window.setTeleprompterAutoAdvance(false);

        // Click Diagram Area
        window.setTeleprompterDiagMode('fretboard');
        const preDiag = S.tpDiagMode;
        const clientX_diag = rect.left + ((da.x + da.w / 2) / outCanvas.width) * rect.width;
        const clientY_diag = rect.top + ((da.y + da.h / 2) / outCanvas.height) * rect.height;
        outCanvas.dispatchEvent(new MouseEvent('click', { clientX: clientX_diag, clientY: clientY_diag, bubbles: true }));
        const postDiag = S.tpDiagMode;

        return {
          preTheme, postTheme,
          preAuto, postAuto,
          preDiag, postDiag
        };
      })()`,
      returnByValue: true
    });
    const r6_b = t6_badges.result.value;
    assert('T6.7 Clicking canvas Theme badge cycles CRT theme', r6_b.preTheme === 'matrix' && r6_b.postTheme === 'amber');
    assert('T6.8 Clicking canvas Auto badge toggles auto-advance', r6_b.preAuto === false && r6_b.postAuto === true);
    assert('T6.9 Clicking canvas LH diagram toggles between fretboard and keyboard', r6_b.preDiag === 'fretboard' && r6_b.postDiag === 'keyboard');

    // -------------------------------------------------------------
    // TEST 7: Multi-Theme Canvas Visual Rendering & Screenshot
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 7: Multi-Theme Canvas Visual Rendering & Verification ---');
    const t7 = await send('Runtime.evaluate', {
      expression: `(() => {
        const outCanvas = document.getElementById('out');
        const W = outCanvas.width, H = outCanvas.height, u = H / 720;
        let matrixOk = false, amberOk = false, navyOk = false;

        try {
          window.setTeleprompterTheme('matrix');
          window.drawTeleprompter(W, H, u);
          matrixOk = true;
        } catch (_) {}

        try {
          window.setTeleprompterTheme('amber');
          window.drawTeleprompter(W, H, u);
          amberOk = true;
        } catch (_) {}

        try {
          window.setTeleprompterTheme('navy');
          window.drawTeleprompter(W, H, u);
          navyOk = true;
        } catch (_) {}

        // Reset to matrix
        window.setTeleprompterTheme('matrix');
        window.drawTeleprompter(W, H, u);

        return { matrixOk, amberOk, navyOk };
      })()`,
      returnByValue: true
    });
    const r7 = t7.result.value;
    assert('T7.1 Retro Matrix Green renders without errors', r7.matrixOk === true);
    assert('T7.2 Cyberpunk Amber CRT renders without errors', r7.amberOk === true);
    assert('T7.3 Classic Win98 Navy renders without errors', r7.navyOk === true);

    // Capture screenshot of verified Siklus 2 teleprompter
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('test_siklus2_teleprompter_verified.png', Buffer.from(shot.data, 'base64'));
    assert('T7.4 Verification screenshot captured to test_siklus2_teleprompter_verified.png', fs.existsSync('test_siklus2_teleprompter_verified.png'));

    // -------------------------------------------------------------
    // TEST 8: Stage Clearance Lane Compliance (>= 50% across Viewports)
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 8: Stage Clearance Lane Compliance ---');
    const t8 = await send('Runtime.evaluate', {
      expression: `(() => {
        const vps = [
          { name: '1280x720 (Standard HD)', w: 1280, h: 720, u: 1 },
          { name: '1920x1080 (Full HD)', w: 1920, h: 1080, u: 1.5 },
          { name: '960x720 (4:3 Camcorder)', w: 960, h: 720, u: 1 },
          { name: '640x360 (Small Preview)', w: 640, h: 360, u: 0.5 },
          { name: '600x800 (Narrow Mobile)', w: 600, h: 800, u: 800 / 720 }
        ];
        return vps.map(v => {
          const l = window.getTeleprompterLayout(v.w, v.h, v.u);
          return {
            name: v.name,
            ratio: l.centerClearance.ratio,
            pass50Pct: l.centerClearance.pass50Pct
          };
        });
      })()`,
      returnByValue: true
    });
    const r8 = t8.result.value;
    r8.forEach((vp, idx) => {
      const pct = (vp.ratio * 100).toFixed(1);
      assert(`T8.${idx + 1} Viewport ${vp.name} clearance is ${pct}% (>= 50%)`, vp.pass50Pct === true && vp.ratio >= 0.50);
    });

    // -------------------------------------------------------------
    // TEST 9: Zero Console Errors
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 9: Zero Console Errors ---');
    assert('T9.1 Zero console errors recorded during Siklus 2 test execution', consoleErrors.length === 0, consoleErrors.join('; '));

    console.log('\n================================================================');
    console.log(` TOTAL TESTS PASS: ${testPasses.length}`);
    console.log(` TOTAL TESTS FAIL: ${testFails.length}`);
    console.log(` CONSOLE ERRORS:   ${consoleErrors.length}`);
    console.log('================================================================');

    if (testFails.length > 0) {
      console.error('\nFAILURES:');
      testFails.forEach(f => console.error(` - ${f.desc}: ${f.detail}`));
      process.exit(1);
    } else {
      console.log('\nALL SIKLUS 2 TESTS PASSED WITH 100% SUCCESS RATE AND 0 CONSOLE ERRORS!\n');
      process.exit(0);
    }

  } catch (err) {
    console.error('Fatal error during test suite:', err);
    process.exit(1);
  } finally {
    try { chrome.kill(); } catch (_) {}
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}

runTestSuite();
