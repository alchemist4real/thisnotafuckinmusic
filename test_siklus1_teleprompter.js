const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9235;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTestSuite() {
  console.log('================================================================');
  console.log(' SIKLUS 1: DUAL-HAND TELEPROMPTER & GESTURE HINTS TEST SUITE');
  console.log('================================================================');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-tp-suite-'));
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
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
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

    // -------------------------------------------------------------
    // TEST 1: Toolbar Toggle & State Synchronization
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 1: Toolbar Toggle & State Synchronization ---');
    const t1 = await send('Runtime.evaluate', {
      expression: `(() => {
        const tb = document.getElementById('tbGuided');
        const initGuided = S.guidedMode;
        tb.click(); // turn ON
        const onGuided = S.guidedMode;
        const onText = tb.textContent;
        const onAria = tb.getAttribute('aria-pressed');
        const onClass = tb.classList.contains('active');
        tb.click(); // turn OFF
        const offGuided = S.guidedMode;
        const offText = tb.textContent;
        const offAria = tb.getAttribute('aria-pressed');
        tb.click(); // leave ON for remaining tests
        return { initGuided, onGuided, onText, onAria, onClass, offGuided, offText, offAria };
      })()`,
      returnByValue: true
    });
    const r1 = t1.result.value;
    assert('T1.1 Initial state loaded correctly', r1.initGuided === false);
    assert('T1.2 Turning guided mode ON toggles S.guidedMode', r1.onGuided === true);
    assert('T1.3 Button text reflects ON state', r1.onText === '🎤 Guided: ON');
    assert('T1.4 aria-pressed updated to "true"', r1.onAria === 'true');
    assert('T1.5 Button has active CSS class when ON', r1.onClass === true);
    assert('T1.6 Turning guided mode OFF toggles S.guidedMode', r1.offGuided === false);
    assert('T1.7 Button text reflects OFF state', r1.offText === '🎤 Guided: OFF');
    assert('T1.8 aria-pressed updated to "false"', r1.offAria === 'false');

    // -------------------------------------------------------------
    // TEST 2: Data Structure & Progression Parsing
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Data Structure & Progression Parsing ---');
    const t2 = await send('Runtime.evaluate', {
      expression: `(() => {
        window.updateTeleprompterData();
        const count = (window.teleprompterLines || []).length;
        const first = window.teleprompterLines[0] || {};
        const hasProps = ('chord' in first) && ('lyric' in first) && ('section' in first);
        
        // Test fallback when sheet is empty
        const origSheet = S.sheetText;
        S.sheetText = "";
        window.updateTeleprompterData();
        const fallbackCount = window.teleprompterLines.length;
        const fallbackFirst = window.teleprompterLines[0] || {};
        S.sheetText = origSheet;
        window.updateTeleprompterData();

        return { count, first, hasProps, fallbackCount, fallbackFirst };
      })()`,
      returnByValue: true
    });
    const r2 = t2.result.value;
    assert('T2.1 Teleprompter lines parsed from default sheet (>0 lines)', r2.count > 0, `Count=${r2.count}`);
    assert('T2.2 Line object has chord, lyric, section properties', r2.hasProps === true);
    assert('T2.3 Fallback to slots when sheetText is empty (7 pad lines)', r2.fallbackCount === 7, `Fallback=${r2.fallbackCount}`);
    assert('T2.4 Fallback line correctly references Pad 1', (r2.fallbackFirst.lyric || '').includes('Pad 1'));

    // -------------------------------------------------------------
    // TEST 3: Dual-Hand Hints Visual & Data Generation
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: Dual-Hand Hints Visual & Data Generation ---');
    const t3 = await send('Runtime.evaluate', {
      expression: `(() => {
        const lhC = window.getLeftHandHint('C');
        const lhUnmapped = window.getLeftHandHint('Z#dim9');
        const rhTriad = window.getRightHandHint('C');
        const rh7th = window.getRightHandHint('Cmaj7');
        const rh9th = window.getRightHandHint('Dadd9');
        const rhLush = window.getRightHandHint('Gsus4');
        const rhSlash = window.getRightHandHint('G/B');

        return {
          lhC,
          lhUnmapped,
          rhTriad,
          rh7th,
          rh9th,
          rhLush,
          rhSlash
        };
      })()`,
      returnByValue: true
    });
    const r3 = t3.result.value;
    assert('T3.1 Left Hand hint mapped for diatonic chord C', r3.lhC.mapped === true && r3.lhC.padNum === 1);
    assert('T3.2 Left Hand hint has 5-finger pattern array', Array.isArray(r3.lhC.pat) && r3.lhC.pat.length === 5);
    assert('T3.3 Left Hand unmapped chord handled safely without throwing', r3.lhUnmapped.mapped === false && r3.lhUnmapped.padLabel === 'UNMAPPED');
    assert('T3.4 Right Hand Triad classified as voicing 1 (1 finger index)', r3.rhTriad.voicing === 1 && r3.rhTriad.pat[1] === 1);
    assert('T3.5 Right Hand 7th classified as voicing 2 (2 fingers peace)', r3.rh7th.voicing === 2 && r3.rh7th.pat[2] === 1);
    assert('T3.6 Right Hand 9th classified as voicing 3 (3 fingers spread)', r3.rh9th.voicing === 3 && r3.rh9th.pat[3] === 1);
    assert('T3.7 Right Hand Extended/Sus classified as voicing 4 (4 fingers open)', r3.rhLush.voicing === 4 && r3.rhLush.pat[4] === 1);
    assert('T3.8 Slash chord includes +Bass thumb instruction', r3.rhSlash.thumbHint.includes('+Bass'));

    // -------------------------------------------------------------
    // TEST 4: Layout & Center Clearance Lane Verification (>= 50%)
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 4: Layout & Center Clearance Lane Verification ---');
    const t4 = await send('Runtime.evaluate', {
      expression: `(() => {
        const viewports = [
          { name: '1280x720 (Standard HD)', w: 1280, h: 720, u: 1 },
          { name: '1920x1080 (Full HD / Zen)', w: 1920, h: 1080, u: 1.5 },
          { name: '960x720 (4:3 Camcorder)', w: 960, h: 720, u: 1 },
          { name: '640x360 (Small Preview)', w: 640, h: 360, u: 0.5 },
          { name: '600x800 (Narrow Mobile)', w: 600, h: 800, u: 800/720 }
        ];

        return viewports.map(v => {
          const l = window.getTeleprompterLayout(v.w, v.h, v.u);
          return {
            name: v.name,
            w: v.w,
            h: v.h,
            cardW: l.cardW,
            leftX: l.leftX,
            rightX: l.rightX,
            clearanceWidth: l.centerClearance.width,
            clearanceRatio: l.centerClearance.ratio,
            pass50Pct: l.centerClearance.pass50Pct,
            hasBoundaryL: typeof l.boundaryL === 'number',
            hasBoundaryR: typeof l.boundaryR === 'number'
          };
        });
      })()`,
      returnByValue: true
    });
    const r4 = t4.result.value;
    r4.forEach((vp, idx) => {
      const pct = (vp.clearanceRatio * 100).toFixed(1);
      assert(`T4.${idx + 1} Viewport ${vp.name} clearance is ${pct}% (>= 50%)`, vp.pass50Pct === true && vp.clearanceRatio >= 0.50);
      assert(`T4.${idx + 1}b Viewport ${vp.name} boundary lines defined`, vp.hasBoundaryL && vp.hasBoundaryR);
    });

    // -------------------------------------------------------------
    // TEST 5: Interactive Chord Auto-Advance Engine
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 5: Interactive Chord Auto-Advance Engine ---');
    const t5 = await send('Runtime.evaluate', {
      expression: `(() => {
        window.teleprompterIdx = 0;
        const startIdx = window.teleprompterIdx;
        const cur0 = window.teleprompterLines[0];

        // 1. Calling playChord with parsed chord
        const parsed0 = window.T.parseChord(cur0.chord);
        window.playChord(parsed0, 0);
        const idxAfterPlayChord = window.teleprompterIdx;

        // 2. Calling teleprompterOnChordPlayed with chord string
        const cur1 = window.teleprompterLines[window.teleprompterIdx];
        const matchStrRes = window.teleprompterOnChordPlayed(cur1.chord, null);
        const idxAfterStr = window.teleprompterIdx;

        // 3. Calling teleprompterOnChordPlayed with parsed chord object
        const cur2 = window.teleprompterLines[window.teleprompterIdx];
        const parsed2 = window.T.parseChord(cur2.chord);
        const matchObjRes = window.teleprompterOnChordPlayed(parsed2, null);
        const idxAfterObj = window.teleprompterIdx;

        // 4. Calling teleprompterOnChordPlayed with slot number
        const cur3 = window.teleprompterLines[window.teleprompterIdx];
        const gest3 = window.getAdaptiveGestureForChord(cur3.chord);
        let matchSlotRes = false;
        if (gest3 && gest3.mapped) {
          matchSlotRes = window.teleprompterOnChordPlayed(null, gest3.slotIdx);
        } else {
          // fallback advance with chord string
          matchSlotRes = window.teleprompterOnChordPlayed(cur3.chord, null);
        }
        const idxAfterSlot = window.teleprompterIdx;

        // 5. Playing mismatching chord should NOT advance
        const preMismatchIdx = window.teleprompterIdx;
        const mismatchRes = window.teleprompterOnChordPlayed('F#dim7', 999);
        const postMismatchIdx = window.teleprompterIdx;

        return {
          startIdx,
          idxAfterPlayChord,
          matchStrRes,
          idxAfterStr,
          matchObjRes,
          idxAfterObj,
          matchSlotRes,
          idxAfterSlot,
          mismatchRes,
          preMismatchIdx,
          postMismatchIdx
        };
      })()`,
      returnByValue: true
    });
    const r5 = t5.result.value;
    assert('T5.1 playChord triggers teleprompterOnChordPlayed and advances index', r5.idxAfterPlayChord === 1);
    assert('T5.2 teleprompterOnChordPlayed advances with chord name string', r5.matchStrRes === true && r5.idxAfterStr === 2);
    assert('T5.3 teleprompterOnChordPlayed advances with parsed chord object safely', r5.matchObjRes === true && r5.idxAfterObj === 3);
    assert('T5.4 teleprompterOnChordPlayed advances when matching slot played', r5.matchSlotRes === true && r5.idxAfterSlot === 4);
    assert('T5.5 Non-matching chord returns false and does NOT advance index', r5.mismatchRes === false && r5.preMismatchIdx === r5.postMismatchIdx);

    // -------------------------------------------------------------
    // TEST 6: Keyboard & Canvas Click Interaction
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 6: Keyboard & Canvas Click Interaction ---');
    const t6 = await send('Runtime.evaluate', {
      expression: `(() => {
        window.teleprompterIdx = 2;

        // Simulate Space keydown
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        const idxAfterSpace = window.teleprompterIdx;

        // Simulate ArrowRight keydown
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        const idxAfterRight = window.teleprompterIdx;

        // Simulate ArrowLeft keydown
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        const idxAfterLeft = window.teleprompterIdx;

        // Simulate Home keydown
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
        const idxAfterHome = window.teleprompterIdx;

        // Simulate Canvas Click
        const cv = document.getElementById('out');
        const rect = cv.getBoundingClientRect();
        const layout = window.getTeleprompterLayout(cv.width, cv.height, cv.height / 720);

        // Click on right card area (advance)
        const clickXRight = rect.left + ((layout.rightX + layout.cardW / 2) / cv.width) * rect.width;
        const clickYCenter = rect.top + (layout.centerY / cv.height) * rect.height;
        cv.dispatchEvent(new MouseEvent('click', { clientX: clickXRight, clientY: clickYCenter, bubbles: true }));
        const idxAfterRightClick = window.teleprompterIdx;

        // Click on left card area (rewind)
        const clickXLeft = rect.left + ((layout.leftX + layout.cardW / 2) / cv.width) * rect.width;
        cv.dispatchEvent(new MouseEvent('click', { clientX: clickXLeft, clientY: clickYCenter, bubbles: true }));
        const idxAfterLeftClick = window.teleprompterIdx;

        return {
          idxAfterSpace,
          idxAfterRight,
          idxAfterLeft,
          idxAfterHome,
          idxAfterRightClick,
          idxAfterLeftClick,
          debugRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          debugLayout: { rightX: layout.rightX, leftX: layout.leftX, cardW: layout.cardW, W: cv.width },
          linesLen: window.teleprompterLines.length
        };
      })()`,
      returnByValue: true
    });
    const r6 = t6.result.value;
    assert('T6.1 Space key advances teleprompterIdx', r6.idxAfterSpace === 3);
    assert('T6.2 ArrowRight advances teleprompterIdx', r6.idxAfterRight === 4);
    assert('T6.3 ArrowLeft steps back teleprompterIdx', r6.idxAfterLeft === 3);
    assert('T6.4 Home key resets teleprompterIdx to 0', r6.idxAfterHome === 0);
    assert('T6.5 Canvas right card click advances teleprompterIdx', r6.idxAfterRightClick === 1);
    assert('T6.6 Canvas left card click steps back teleprompterIdx', r6.idxAfterLeftClick === 0);

    // -------------------------------------------------------------
    // TEST 7: Sheet Editor Real-time Synchronization
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 7: Sheet Editor Real-time Synchronization ---');
    const t7 = await send('Runtime.evaluate', {
      expression: `(() => {
        const ta = document.getElementById('sheetText');
        const editBtn = document.getElementById('editSheet');

        editBtn.click(); // enter edit mode
        ta.value = "[Reff Beat]\\nC G Am F\\nAku bernyanyi di bawah lampu kota";
        ta.dispatchEvent(new Event('input')); // live input

        const linesAfterLiveInput = window.teleprompterLines.length;
        const line0 = window.teleprompterLines[0];

        editBtn.click(); // click Done to exit edit mode
        const linesAfterDone = window.teleprompterLines.length;
        const line3 = window.teleprompterLines[3];

        return {
          linesAfterLiveInput,
          linesAfterDone,
          line0Section: line0.section,
          line0Chord: line0.chord,
          line0Lyric: line0.lyric,
          line3Chord: line3.chord
        };
      })()`,
      returnByValue: true
    });
    const r7 = t7.result.value;
    assert('T7.1 Typing in sheetText triggers live teleprompter sync (4 chords)', r7.linesAfterLiveInput === 4);
    assert('T7.2 Section header correctly assigned ([Reff Beat])', r7.line0Section === 'Reff Beat');
    assert('T7.3 Lyrics correctly attached to chord lines', r7.line0Lyric === 'Aku bernyanyi di bawah lampu kota');
    assert('T7.4 Clicking Done preserves synchronized teleprompter data', r7.linesAfterDone === 4 && r7.line3Chord === 'F');

    // -------------------------------------------------------------
    // TEST 8: Zen Mode / Full Video Responsiveness
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 8: Zen Mode / Full Video Responsiveness ---');
    const t8 = await send('Runtime.evaluate', {
      expression: `(() => {
        const toggleFull = window.toggleFullVideo;
        const wasZen = document.body.classList.contains('full-video-mode');
        if (typeof toggleFull === 'function') toggleFull();
        const isZen = document.body.classList.contains('full-video-mode');
        const cv = document.getElementById('out');
        const zenLayout = window.getTeleprompterLayout(cv.width, cv.height, cv.height / 720);

        // Toggle back
        if (typeof toggleFull === 'function') toggleFull();
        const postZen = document.body.classList.contains('full-video-mode');

        return {
          wasZen,
          isZen,
          postZen,
          zenClearanceRatio: zenLayout.centerClearance.ratio,
          zenPass50: zenLayout.centerClearance.pass50Pct
        };
      })()`,
      returnByValue: true
    });
    const r8 = t8.result.value;
    assert('T8.1 Zen full-video-mode toggled on', r8.isZen === true);
    assert('T8.2 Center clearance lane remains >= 50% in Zen mode', r8.zenPass50 === true && r8.zenClearanceRatio >= 0.50);
    assert('T8.3 Zen full-video-mode cleanly toggled off', r8.postZen === false);

    // -------------------------------------------------------------
    // TEST 9: Canvas Camcorder Overlay Rendering
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 9: Canvas Camcorder Overlay Rendering ---');
    const t9 = await send('Runtime.evaluate', {
      expression: `(() => {
        let renderError = null;
        try {
          const cv = document.getElementById('out');
          const u = cv.height / 720;
          window.drawTeleprompter(cv.width, cv.height, u);
        } catch(e) {
          renderError = e.stack || e.message;
        }
        return { renderError };
      })()`,
      returnByValue: true
    });
    const r9 = t9.result.value;
    assert('T9.1 drawTeleprompter renders without throwing any exceptions', r9.renderError === null, r9.renderError);

    // Capture visual artifact screenshot
    const ss = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('test_siklus1_teleprompter_verified.png', Buffer.from(ss.data, 'base64'));
    assert('T9.2 Visual canvas screenshot captured to test_siklus1_teleprompter_verified.png', fs.existsSync('test_siklus1_teleprompter_verified.png'));

    // -------------------------------------------------------------
    // TEST 10: Zero Console Errors
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 10: Zero Console Errors ---');
    assert('T10.1 Zero console errors recorded during test execution', consoleErrors.length === 0, consoleErrors.join('; '));

    console.log('\n================================================================');
    console.log(` TOTAL TESTS PASS: ${testPasses.length}`);
    console.log(` TOTAL TESTS FAIL: ${testFails.length}`);
    console.log(` CONSOLE ERRORS:   ${consoleErrors.length}`);
    console.log('================================================================');

    await send('Page.close');

    if (testFails.length > 0) {
      console.error('\nFAILED TESTS:');
      testFails.forEach(f => console.error(`- ${f.desc}: ${f.detail}`));
      process.exit(1);
    } else {
      console.log('\nALL TESTS PASSED WITH 100% SUCCESS RATE AND 0 CONSOLE ERRORS!');
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  } finally {
    chrome.kill('SIGKILL');
  }
}

runTestSuite();
