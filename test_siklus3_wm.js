const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9228;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTestSuite() {
  console.log('=== SIKLUS 3: WINDOW MANAGER ENGINE WIN98 TEST SUITE ===');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-wm-test-'));

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

    const evaluate = async (expr) => {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error('Evaluation exception: ' + JSON.stringify(res.exceptionDetails));
      }
      return res.result.value;
    };

    console.log('[1/7] Waiting for DOM initialisation...');
    const initWait = await evaluate(`
      new Promise((resolve) => {
        let attempts = 0;
        const check = () => {
          attempts++;
          if (document.getElementById('wRec') && typeof window.focusWindow === 'function') {
            resolve({ ok: true, attempts });
          } else if (attempts > 60) {
            resolve({ ok: false, attempts });
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      })
    `);
    console.log('  ✓ Initialized after attempts:', initWait.attempts);

    // TEST 1: Window Manager Initial State & Focus
    console.log('[2/7] Testing Window Manager Initial State & Tabindex...');
    const t1 = await evaluate(`
      (() => {
        const wRec = document.getElementById('wRec');
        const wGuide = document.getElementById('wGuide');
        const wChord = document.getElementById('wChord');
        const wSheet = document.getElementById('wSheet');
        const wDJ = document.getElementById('wDJConsole');
        const wCrate = document.getElementById('wCrateExplorer');

        const allWnds = [wRec, wGuide, wChord, wSheet, wDJ, wCrate];
        const allHaveTabindex = allWnds.every(w => w && w.getAttribute('tabindex') === '-1');

        window.focusWindow(wRec);
        const wRecActive = wRec.classList.contains('active') && wRec.getAttribute('aria-selected') === 'true';

        window.focusWindow(wGuide);
        const wGuideActive = wGuide.classList.contains('active') && !wRec.classList.contains('active');

        // Test float focus z-index
        window.floatWindow(wChord, 200, 150);
        const chordZ = parseInt(wChord.style.zIndex, 10);
        window.focusWindow(wChord);
        const chordZAfter = parseInt(wChord.style.zIndex, 10);

        return {
          allHaveTabindex,
          wRecActive,
          wGuideActive,
          chordFloating: wChord.classList.contains('floating'),
          chordZ,
          chordZAfter,
          zIncreased: chordZAfter >= chordZ
        };
      })()
    `);
    console.log('  Result 1:', t1);
    if (!t1.allHaveTabindex || !t1.wRecActive || !t1.wGuideActive || !t1.zIncreased) {
      throw new Error('Test 1 Failed: Initial State / Tabindex / Focus');
    }
    console.log('  ✓ Test 1 Passed: Tabindex & Focus activation verified.');

    // TEST 2: Keyboard Window Cycling Navigation (F6, Shift+F6, Ctrl+Tab, Alt+F6)
    console.log('[3/7] Testing Retro Keyboard Window Navigation (F6, Shift+F6, Ctrl+Tab)...');
    const t2 = await evaluate(`
      (() => {
        // Ensure starting focus on wRec
        const wRec = document.getElementById('wRec');
        window.focusWindow(wRec);
        const startId = window.activeWindow?.id;

        // Simulate F6 keydown event
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true }));
        const afterF6Id = window.activeWindow?.id;

        // Simulate another F6
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true }));
        const after2ndF6Id = window.activeWindow?.id;

        // Simulate Shift+F6 (backward)
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F6', shiftKey: true, bubbles: true, cancelable: true }));
        const afterShiftF6Id = window.activeWindow?.id;

        // Simulate Ctrl+Tab
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', ctrlKey: true, bubbles: true, cancelable: true }));
        const afterCtrlTabId = window.activeWindow?.id;

        // Direct function call
        const cycledWnd = window.cycleActiveWindow(false);
        const statusMsg = document.getElementById('stMsg')?.textContent || '';

        return {
          startId,
          afterF6Id,
          after2ndF6Id,
          afterShiftF6Id,
          afterCtrlTabId,
          visibleList: Array.from(document.querySelectorAll('.wnd')).filter(w => !w.hidden && getComputedStyle(w).display !== 'none').map(w => w.id),
          f6Changed: afterF6Id !== startId,
          after2ndF6Id,
          afterShiftF6Id,
          shiftF6Reversed: afterShiftF6Id === afterF6Id,
          afterCtrlTabId,
          ctrlTabWorked: afterCtrlTabId === after2ndF6Id,
          cycledId: cycledWnd?.id,
          statusMsgHasActive: statusMsg.includes('Active window:')
        };
      })()
    `);
    console.log('  Result 2:', t2);
    if (!t2.f6Changed || !t2.shiftF6Reversed || !t2.ctrlTabWorked || !t2.statusMsgHasActive) {
      throw new Error('Test 2 Failed: Window Cycling Navigation');
    }
    console.log('  ✓ Test 2 Passed: Retro F6, Shift+F6, Ctrl+Tab window navigation verified.');

    // TEST 3: Retro Window Close Shortcuts (Alt+F4 & Escape)
    console.log('[4/7] Testing Window Close Shortcuts (Alt+F4 & Escape)...');
    const t3 = await evaluate(`
      (() => {
        // 1. Alt+F4 closes active window
        const wRec = document.getElementById('wRec');
        window.focusWindow(wRec);
        const wRecBeforeHidden = wRec.hidden;

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F4', altKey: true, bubbles: true, cancelable: true }));
        const wRecAfterAltF4Hidden = wRec.hidden;
        const statusAfterAltF4 = document.getElementById('stMsg')?.textContent || '';

        // Reopen wRec
        window.togglePanel('wRec');

        // 2. Escape with Modal open closes modal, NOT window
        window.openDialog('dlgAbout');
        const dlgAbout = document.getElementById('dlgAbout');
        const modalOpenBefore = !dlgAbout.hidden;

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        const modalOpenAfter = !dlgAbout.hidden;

        // 3. Escape inside input does NOT close active window
        window.focusWindow(document.getElementById('wChord'));
        const dummyInput = document.createElement('input');
        document.body.appendChild(dummyInput);
        dummyInput.focus();
        dummyInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        const wChordStillOpen = !document.getElementById('wChord').hidden;
        dummyInput.remove();

        // 4. Escape on focused window closes active window
        window.focusWindow(document.getElementById('wChord'));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        const wChordClosed = document.getElementById('wChord').hidden;

        // Reopen wChord
        window.togglePanel('wChord');

        return {
          wRecBeforeHidden,
          wRecAfterAltF4Hidden,
          altF4Closed: wRecAfterAltF4Hidden === true,
          statusAfterAltF4,
          modalOpenBefore,
          modalClosedByEsc: modalOpenAfter === false,
          wChordStillOpen,
          wChordClosed
        };
      })()
    `);
    console.log('  Result 3:', t3);
    if (!t3.altF4Closed || !t3.modalClosedByEsc || !t3.wChordStillOpen || !t3.wChordClosed) {
      throw new Error('Test 3 Failed: Alt+F4 & Escape window close shortcuts');
    }
    console.log('  ✓ Test 3 Passed: Alt+F4 and Escape shortcuts behave properly.');

    // TEST 4: Cascade & Tile Floating Windows
    console.log('[5/7] Testing Cascade & Tile Floating Windows...');
    const t4 = await evaluate(`
      (() => {
        const wRec = document.getElementById('wRec');
        const wGuide = document.getElementById('wGuide');
        const wSheet = document.getElementById('wSheet');

        window.floatWindow(wRec, 80, 80);
        window.floatWindow(wGuide, 100, 100);
        window.floatWindow(wSheet, 120, 120);

        window.cascadeFloatingWindows();

        const lRec = parseInt(wRec.style.left, 10);
        const tRec = parseInt(wRec.style.top, 10);
        const lGuide = parseInt(wGuide.style.left, 10);
        const tGuide = parseInt(wGuide.style.top, 10);
        const lSheet = parseInt(wSheet.style.left, 10);
        const tSheet = parseInt(wSheet.style.top, 10);

        const cascadeStepped = (lGuide > lRec) && (tGuide > tRec) && (lSheet > lGuide) && (tSheet > tGuide);

        window.tileFloatingWindows();

        const tlRec = parseInt(wRec.style.left, 10);
        const ttRec = parseInt(wRec.style.top, 10);
        const tlGuide = parseInt(wGuide.style.left, 10);
        const ttGuide = parseInt(wGuide.style.top, 10);

        // Tile places windows side-by-side or stacked in grid
        const tileRepositioned = (tlGuide !== lGuide) || (ttGuide !== tGuide);

        // Reset to docked
        window.resetWindowLayout();

        return {
          cascadeStepped,
          tileRepositioned,
          allDockedAfterReset: !wRec.classList.contains('floating') && !wGuide.classList.contains('floating')
        };
      })()
    `);
    console.log('  Result 4:', t4);
    if (!t4.cascadeStepped || !t4.tileRepositioned || !t4.allDockedAfterReset) {
      throw new Error('Test 4 Failed: Cascade and Tile Floating Windows');
    }
    console.log('  ✓ Test 4 Passed: Cascade, Tile & Reset layout verified.');

    // TEST 5: Rapid Float/Dock Toggle Stress-Test (20x Rapid Toggles)
    console.log('[6/7] Testing Rapid Float/Dock Toggle Stress-Test (20x Rapid Toggles)...');
    const t5 = await evaluate(`
      (() => {
        const wRec = document.getElementById('wRec');
        const STORE_KEY = 'retro_paint_synth_v2';
        const steps = [];

        // Set an initial custom float coordinate
        window.floatWindow(wRec, 180, 140);
        const initL = wRec.style.left;
        const initT = wRec.style.top;
        window.dockWindow(wRec);

        for (let i = 0; i < 20; i++) {
          window.toggleDock(wRec);
          const isFloatingDOM = wRec.classList.contains('floating');
          const isDockedDOM = wRec.classList.contains('docked');
          const savedData = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
          const isFloatingSaved = !!savedData.layout?.wRec?.floating;

          steps.push({
            iter: i,
            isFloatingDOM,
            isDockedDOM,
            matchesSaved: isFloatingDOM === isFloatingSaved
          });
        }

        const allMatched = steps.every(s => s.matchesSaved);
        const finalFloating = wRec.classList.contains('floating');
        // Since we started docked, after 20 toggles it should be docked again (20 is even)
        const finalIsDocked = !finalFloating && wRec.classList.contains('docked');

        // Test that re-floating restores the remembered lastFloat position
        window.floatWindow(wRec);
        const restoredL = wRec.style.left;
        const restoredT = wRec.style.top;
        const positionPreserved = (restoredL === initL && restoredT === initT);

        // Dock it back
        window.dockWindow(wRec);

        return {
          toggleCount: steps.length,
          allMatched,
          finalIsDocked,
          initL,
          restoredL,
          positionPreserved
        };
      })()
    `);
    console.log('  Result 5:', t5);
    if (!t5.allMatched || !t5.finalIsDocked || !t5.positionPreserved) {
      throw new Error('Test 5 Failed: Rapid Float/Dock Toggle Stress-Test');
    }
    console.log('  ✓ Test 5 Passed: 20 rapid toggles with 100% sync and coordinate memory verified.');

    // TEST 6: High-DPI & Browser Zoom Coordinate Precision (125%, 150%, 175%)
    console.log('[7/7] Testing High-DPI & Browser Zoom (125%, 150%, 175%) Precision...');
    
    // Zoom 1: 125%
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1.25,
      mobile: false
    });
    await sleep(200);

    const t6_125 = await evaluate(`
      (() => {
        const wRec = document.getElementById('wRec');
        window.floatWindow(wRec, 200, 150);
        const title = wRec.querySelector('.wnd-title');
        const startL = parseInt(wRec.style.left, 10);
        const startT = parseInt(wRec.style.top, 10);

        // Simulate pointerdown
        title.dispatchEvent(new PointerEvent('pointerdown', { clientX: 250, clientY: 160, button: 0, bubbles: true }));
        // Simulate pointermove +50px X, +30px Y
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 300, clientY: 190, bubbles: true }));
        // Simulate pointerup
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: 300, clientY: 190, bubbles: true }));

        const endL = parseInt(wRec.style.left, 10);
        const endT = parseInt(wRec.style.top, 10);
        const deltaX = endL - startL;
        const deltaY = endT - startT;

        return {
          zoom: '125%',
          startL, startT,
          endL, endT,
          deltaX, deltaY,
          dragExact: (deltaX === 50 && deltaY === 30)
        };
      })()
    `);
    console.log('  125% Drag Result:', t6_125);
    if (!t6_125.dragExact) {
      throw new Error('Test 6 Failed at 125% zoom drag');
    }

    // Zoom 2: 150%
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1.5,
      mobile: false
    });
    await sleep(200);

    const t6_150 = await evaluate(`
      (() => {
        const wRec = document.getElementById('wRec');
        const eastHandle = wRec.querySelector('.resizer-edge.e');
        const startW = parseInt(wRec.style.width, 10);

        eastHandle.dispatchEvent(new PointerEvent('pointerdown', { clientX: 400, clientY: 200, button: 0, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: 460, clientY: 200, bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: 460, clientY: 200, bubbles: true }));

        const endW = parseInt(wRec.style.width, 10);
        const deltaW = endW - startW;

        return {
          zoom: '150%',
          startW, endW, deltaW,
          resizeExact: (deltaW === 60)
        };
      })()
    `);
    console.log('  150% Resize Result:', t6_150);
    if (!t6_150.resizeExact) {
      throw new Error('Test 6 Failed at 150% zoom resize');
    }

    // Zoom 3: 175% Viewport clamp check
    await send('Emulation.setDeviceMetricsOverride', {
      width: 800,
      height: 600,
      deviceScaleFactor: 1.75,
      mobile: false
    });
    await sleep(200);

    const t6_175 = await evaluate(`
      (() => {
        const wRec = document.getElementById('wRec');
        // Force window to edge
        wRec.style.left = '900px';
        wRec.style.top = '700px';

        // Trigger resize event
        window.dispatchEvent(new Event('resize'));

        const curL = parseInt(wRec.style.left, 10);
        const curT = parseInt(wRec.style.top, 10);
        const rect = wRec.getBoundingClientRect();

        const clampedInside = (curL < 800) && (curT < 600) && (rect.left >= 0);

        // Reset to docked
        window.dockWindow(wRec);

        return {
          zoom: '175%',
          curL, curT,
          clampedInside
        };
      })()
    `);
    console.log('  175% Viewport Clamp Result:', t6_175);
    if (!t6_175.clampedInside) {
      throw new Error('Test 6 Failed at 175% viewport clamp');
    }
    console.log('  ✓ Test 6 Passed: High-DPI & Browser Zoom precision verified across 125%, 150%, 175%.');

    console.log('\n=== CONSOLE AUDIT ===');
    console.log('Console Errors count:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.error('Console errors detected:', consoleErrors);
      throw new Error('Console errors were logged during test execution!');
    }
    console.log('Console Warnings count:', consoleWarnings.length);
    console.log('✓ ZERO console errors verified.');

    console.log('\n======================================================');
    console.log('🎉 ALL SIKLUS 3 TESTS PASSED (100% SUCCESS)');
    console.log('======================================================\n');

  } finally {
    chrome.kill();
    setTimeout(() => {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    }, 1000);
  }
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
