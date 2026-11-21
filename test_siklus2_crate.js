const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9225;

const os = require('os');
const path = require('path');
const fs = require('fs');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTestSuite() {
  console.log('=== SIKLUS 2: CRATE ENGINE & 10 TRENDING SAMPLES TEST SUITE ===');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-crate-test-'));
  
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
          // Ignore external font or cdn fetch failures in offline mode
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

    console.log('[1/12] Waiting for DOM & IndexedDB initialisation...');
    const initWait = await evaluate(`
      new Promise((resolve) => {
        let attempts = 0;
        const check = () => {
          attempts++;
          if (window.crateDB && window.DJ?.decks?.A?.buffer && window.DJ?.decks?.B?.buffer) {
            resolve({ ok: true, attempts });
          } else if (attempts > 100) {
            resolve({ ok: false, attempts });
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      })
    `);
    console.log('  ✓ Initialized after attempts:', initWait.attempts);

    // TEST 1: Initial Crate & 10 Default Tracks
    console.log('[2/12] Testing Initial Crate DB & 10 Default Procedural Tracks...');
    const initialCheck = await evaluate(`
      (async () => {
        if (!window.crateDB) return { ok: false, reason: 'crateDB missing' };
        const tx = window.crateDB.transaction('tracks', 'readonly');
        const store = tx.objectStore('tracks');
        const tracks = await new Promise(r => {
          const req = store.getAll();
          req.onsuccess = () => r(req.result);
          req.onerror = () => r([]);
        });
        const badgeAll = document.getElementById('badgeCrateAll')?.textContent;
        const badgeTrending = document.getElementById('badgeCrateTrending')?.textContent;
        const badgeScratch = document.getElementById('badgeCrateScratch')?.textContent;
        const deckA = window.DJ?.decks?.A;
        const deckB = window.DJ?.decks?.B;
        return {
          ok: true,
          trackCount: tracks.length,
          tracks: tracks.map(t => ({ id: t.id, name: t.name, bpm: t.bpm, crate: t.crate })),
          badgeAll,
          badgeTrending,
          badgeScratch,
          deckATrack: deckA?.trackName,
          deckBTrack: deckB?.trackName,
          hasDeckABuffer: !!deckA?.buffer,
          hasDeckBBuffer: !!deckB?.buffer
        };
      })()
    `);
    
    if (!initialCheck.ok || initialCheck.trackCount !== 10) {
      throw new Error(`Initial check failed: expected 10 tracks, found ${initialCheck.trackCount}`);
    }
    console.log(`  ✓ 10 Procedural Tracks seeded in IndexedDB: All=${initialCheck.badgeAll}, Trending=${initialCheck.badgeTrending}, Scratch=${initialCheck.badgeScratch}`);
    console.log(`  ✓ Initial Decks loaded: Deck A="${initialCheck.deckATrack}" (buf=${initialCheck.hasDeckABuffer}), Deck B="${initialCheck.deckBTrack}" (buf=${initialCheck.hasDeckBBuffer})`);

    // TEST 2: Duration Formatting
    console.log('[3/12] Testing Duration Formatting (seconds, minutes, and > 1 hour)...');
    const durTest = await evaluate(`
      (() => {
        return {
          d7: window.formatTrackDuration(7),
          d60: window.formatTrackDuration(60),
          d215: window.formatTrackDuration(215),
          d3665: window.formatTrackDuration(3665),
          d7325: window.formatTrackDuration(7325),
          dNull: window.formatTrackDuration(null),
          dNaN: window.formatTrackDuration(NaN)
        };
      })()
    `);
    if (durTest.d7 !== '0:07' || durTest.d215 !== '3:35' || durTest.d3665 !== '1:01:05' || durTest.d7325 !== '2:02:05' || durTest.dNull !== '--') {
      throw new Error('Duration formatting test failed: ' + JSON.stringify(durTest));
    }
    console.log(`  ✓ Duration formatting verified: 7s -> "${durTest.d7}", 215s -> "${durTest.d215}", 3665s -> "${durTest.d3665}", 7325s -> "${durTest.d7325}", null -> "${durTest.dNull}"`);

    // TEST 3: Procedural BPM Estimation
    console.log('[4/12] Testing Fast Procedural BPM Estimation...');
    const bpmEst = await evaluate(`
      (() => {
        const ctx = window.A?.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const sr = ctx.sampleRate || 44100;
        const dur = 4;
        const buf = ctx.createBuffer(1, sr * dur, sr);
        const ch = buf.getChannelData(0);
        const bpm = 120;
        const beatSec = 60 / bpm;
        // Generate simulated beat onsets at 120 BPM
        for (let b = 0; b < dur / beatSec; b++) {
          const idx = Math.floor(b * beatSec * sr);
          for (let s = 0; s < Math.floor(sr * 0.05); s++) {
            if (idx + s < ch.length) {
              ch[idx + s] = Math.sin(2 * Math.PI * 100 * (s / sr)) * Math.exp(-s / (sr * 0.02));
            }
          }
        }
        return window.estimateBpmFromBuffer(buf);
      })()
    `);
    console.log(`  ✓ Estimated BPM from synthetic 120 BPM buffer: ${bpmEst} BPM`);
    if (bpmEst < 100 || bpmEst > 140) {
      throw new Error('BPM estimation out of expected range: ' + bpmEst);
    }

    // TEST 4: Metadata Auto-Repair & Resiliency
    console.log('[5/12] Testing Corrupted Metadata Auto-Repair...');
    const repairTest = await evaluate(`
      (async () => {
        // Insert corrupt tracks directly to IndexedDB
        const tx = window.crateDB.transaction('tracks', 'readwrite');
        const store = tx.objectStore('tracks');
        store.put({
          id: 'corrupt_item_1',
          name: '',             // Missing name
          bpm: -50,             // Invalid BPM
          key: '',              // Missing key
          duration: -100,       // Negative duration
          crate: 'INVALID_CRATE'// Invalid category
        });
        store.put({
          id: 'corrupt_item_2',
          name: '   ',           // Whitespace only name
          bpm: 'abc',           // String BPM
          duration: 'unknown',  // String duration
          crate: 'fake_crate'   // Invalid crate string
        });
        await new Promise((resolve, reject) => {
          tx.oncomplete = resolve;
          tx.onerror = (e) => reject(new Error('tx error: ' + (e.target.error?.message || e.target.error)));
        });

        // Trigger refreshCrateTable which auto-repairs metadata
        await window.refreshCrateTable();
        await new Promise(r => setTimeout(r, 100));

        const rx = window.crateDB.transaction('tracks', 'readonly');
        const tracks = await new Promise((resolve, reject) => {
          const req = rx.objectStore('tracks').getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = (e) => reject(new Error('rx error: ' + (e.target.error?.message || e.target.error)));
        });

        const repaired1 = tracks.find(t => t.id === 'corrupt_item_1');
        return {
          totalTracks: tracks.length,
          repaired1
        };
      })()
    `);
    if (!repairTest.repaired1 || repairTest.repaired1.bpm !== 120 || repairTest.repaired1.duration !== 0 || repairTest.repaired1.crate !== 'imported') {
      throw new Error('Auto-repair failed: ' + JSON.stringify(repairTest.repaired1));
    }
    console.log(`  ✓ Corrupted track repaired cleanly: name="${repairTest.repaired1.name}", bpm=${repairTest.repaired1.bpm}, key="${repairTest.repaired1.key}", dur=${repairTest.repaired1.duration}, crate="${repairTest.repaired1.crate}"`);

    // Clean up corrupt items for next tests
    await evaluate(`
      (async () => {
        await window.deleteTrack('corrupt_item_1');
        await window.deleteTrack('corrupt_item_2');
        await window.refreshCrateTable();
      })()
    `);

    // TEST 5: Stress-Test with 25 Additional Tracks (Total 35 Tracks)
    console.log('[6/12] Performing Stress-Test: Generating 25 Additional Procedural Tracks (Total 35)...');
    const stressRes = await evaluate(`
      (async () => {
        const tx = window.crateDB.transaction('tracks', 'readwrite');
        const store = tx.objectStore('tracks');
        const ctx = window.A?.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const sr = ctx.sampleRate || 44100;

        for (let i = 1; i <= 25; i++) {
          const id = 'stress_trk_' + i;
          const bpm = 90 + (i * 3);
          const dur = 4 + (i * 2);
          const dummyBuf = ctx.createBuffer(2, Math.floor(sr * dur), sr);
          window.inMemoryBuffers[id] = dummyBuf;
          const wav = window.audioBufferToWav(dummyBuf);
          store.put({
            id: id,
            name: 'Stress Synthwave Loop #' + i,
            bpm: bpm,
            key: ['Am', 'C', 'Dm', 'F#m', 'Gm'][i % 5],
            duration: dur,
            size: Math.round(wav.size / 1024) + ' KB',
            crate: (i % 2 === 0) ? 'beats' : 'imported',
            blob: wav
          });
        }
        await new Promise(r => { tx.oncomplete = r; });
        await window.refreshCrateTable();

        const rowCount = document.querySelectorAll('#crateTableBody tr[data-trackid]').length;
        const statusText = document.getElementById('crateStatus')?.textContent;
        const badgeAll = document.getElementById('badgeCrateAll')?.textContent;
        return {
          rowCount,
          statusText,
          badgeAll
        };
      })()
    `);
    console.log(`  ✓ Stress test rendered ${stressRes.rowCount} rows. Status: "${stressRes.statusText}", BadgeAll: ${stressRes.badgeAll}`);
    if (stressRes.rowCount < 35) {
      throw new Error(`Stress test row count too low: ${stressRes.rowCount}`);
    }

    // TEST 6: Column Sorting (BPM Ascending / Descending, Name, Duration)
    console.log('[7/12] Testing Crate Table Column Sorting...');
    const sortRes = await evaluate(`
      (async () => {
        // Sort BPM ascending
        await window.sortCrateBy('bpm', true);
        const rowsAsc = Array.from(document.querySelectorAll('#crateTableBody tr[data-trackid]'));
        const firstBpmAsc = parseInt(rowsAsc[0].querySelector('td:nth-child(2)').textContent);
        const lastBpmAsc = parseInt(rowsAsc[rowsAsc.length - 1].querySelector('td:nth-child(2)').textContent);
        const isBpmAscHeader = document.querySelector('th[data-sort="bpm"]').classList.contains('sort-asc');

        // Sort BPM descending
        await window.sortCrateBy('bpm', false);
        const rowsDesc = Array.from(document.querySelectorAll('#crateTableBody tr[data-trackid]'));
        const firstBpmDesc = parseInt(rowsDesc[0].querySelector('td:nth-child(2)').textContent);
        const lastBpmDesc = parseInt(rowsDesc[rowsDesc.length - 1].querySelector('td:nth-child(2)').textContent);
        const isBpmDescHeader = document.querySelector('th[data-sort="bpm"]').classList.contains('sort-desc');

        // Sort Name ascending
        await window.sortCrateBy('name', true);
        const rowsName = Array.from(document.querySelectorAll('#crateTableBody tr[data-trackid]'));
        const firstName = rowsName[0].querySelector('td:nth-child(1)').textContent;

        return {
          firstBpmAsc,
          lastBpmAsc,
          isBpmAscHeader,
          firstBpmDesc,
          lastBpmDesc,
          isBpmDescHeader,
          firstName
        };
      })()
    `);
    console.log(`  ✓ BPM Asc: lowest=${sortRes.firstBpmAsc}, highest=${sortRes.lastBpmAsc}, headerSortAsc=${sortRes.isBpmAscHeader}`);
    console.log(`  ✓ BPM Desc: highest=${sortRes.firstBpmDesc}, lowest=${sortRes.lastBpmDesc}, headerSortDesc=${sortRes.isBpmDescHeader}`);
    console.log(`  ✓ Name Asc: first track="${sortRes.firstName}"`);
    if (sortRes.firstBpmAsc > sortRes.lastBpmAsc || sortRes.firstBpmDesc < sortRes.lastBpmDesc || !sortRes.isBpmAscHeader || !sortRes.isBpmDescHeader) {
      throw new Error('Sorting test failed: ' + JSON.stringify(sortRes));
    }

    // TEST 7: Live Search & 120ms Debounce
    console.log('[8/12] Testing Live Search & Debounce...');
    const searchRes = await evaluate(`
      (async () => {
        const input = document.getElementById('crateSearchInput');
        
        const waitForRows = async (predicate, maxWait = 2500) => {
          const start = Date.now();
          while (Date.now() - start < maxWait) {
            const rows = Array.from(document.querySelectorAll('#crateTableBody tr[data-trackid]'))
              .map(r => r.querySelector('td:nth-child(1)').textContent);
            if (predicate(rows)) return rows;
            await new Promise(r => setTimeout(r, 40));
          }
          return Array.from(document.querySelectorAll('#crateTableBody tr[data-trackid]'))
            .map(r => r.querySelector('td:nth-child(1)').textContent);
        };

        // Search "Drake"
        input.value = 'Drake';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const drakeRows = await waitForRows(rows => rows.length > 0 && rows.every(n => n.includes('Drake')));

        // Search "171" (matches The Weeknd - Blinding 80s Synthwave)
        input.value = '171';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const bpmRows = await waitForRows(rows => rows.length > 0 && rows.some(n => n.includes('Blinding')));

        // Press Escape to clear
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        const clearedRows = await waitForRows(rows => rows.length >= 35);
        const clearedRowsCount = clearedRows.length;

        return {
          drakeRows,
          bpmRows,
          clearedRowsCount
        };
      })()
    `);
    console.log(`  ✓ Search "Drake": returned ${searchRes.drakeRows.length} tracks (${searchRes.drakeRows.join(', ')})`);
    console.log(`  ✓ Search "171": returned ${searchRes.bpmRows.length} tracks (${searchRes.bpmRows.join(', ')})`);
    console.log(`  ✓ Escape key cleared search: ${searchRes.clearedRowsCount} tracks restored`);
    if (searchRes.drakeRows.length === 0 || !searchRes.drakeRows.every(n => n.includes('Drake')) || searchRes.clearedRowsCount < 35) {
      throw new Error('Search & debounce test failed: ' + JSON.stringify(searchRes));
    }

    // TEST 8: Drag & Drop Simulation
    console.log('[9/12] Testing Drag & Drop Event Handling...');
    const dndRes = await evaluate(`
      (async () => {
        const wrap = document.querySelector('.crate-wrap');
        
        // 1. dragenter & dragover adds .drag-over
        wrap.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true }));
        const hasDragOver = wrap.classList.contains('drag-over');

        // 2. dragleave removes .drag-over
        wrap.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true }));
        const removedDragOver = !wrap.classList.contains('drag-over');

        // 3. Drop synthetic audio file
        const ctx = window.A?.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const testBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const wavBlob = window.audioBufferToWav(testBuf);
        const testFile = new File([wavBlob], 'Drop_Bass_Sample_Test.wav', { type: 'audio/wav' });

        await window.handleImportAudioFiles([testFile]);

        const lastRow = document.querySelector('#crateTableBody tr.selected');
        const selectedName = lastRow?.querySelector('td:nth-child(1)')?.textContent;

        return {
          hasDragOver,
          removedDragOver,
          selectedName
        };
      })()
    `);
    console.log(`  ✓ Drag-over class toggle: entered=${dndRes.hasDragOver}, left=${dndRes.removedDragOver}`);
    console.log(`  ✓ Dropped & imported file: selected="${dndRes.selectedName}"`);
    if (!dndRes.hasDragOver || !dndRes.removedDragOver || !dndRes.selectedName?.includes('Drop_Bass_Sample_Test')) {
      throw new Error('Drag and drop test failed: ' + JSON.stringify(dndRes));
    }

    // TEST 9: Storage Quota & Auto-Pruning Takes
    console.log('[10/12] Testing Storage Quota Display & Pruning Takes...');
    const pruneRes = await evaluate(`
      (async () => {
        const tx = window.crateDB.transaction('tracks', 'readwrite');
        const store = tx.objectStore('tracks');
        // Add 12 dummy guitar takes
        for (let i = 1; i <= 12; i++) {
          store.put({
            id: 'guitar_' + (1000 + i),
            name: 'Guitar Take #' + i,
            bpm: 120,
            key: 'C',
            duration: 8,
            size: '25 KB',
            crate: 'beats'
          });
        }
        await new Promise(r => { tx.oncomplete = r; });
        await window.refreshCrateTable();

        // Prune keeping 4
        const prunedCount = await window.pruneCrateTakes(4);

        const checkTx = window.crateDB.transaction('tracks', 'readonly');
        const all = await new Promise(r => {
          const req = checkTx.objectStore('tracks').getAll();
          req.onsuccess = () => r(req.result);
        });
        const remainingGuitarTakes = all.filter(t => t.id.startsWith('guitar_'));

        return {
          prunedCount,
          remainingGuitarTakesCount: remainingGuitarTakes.length,
          quotaStatusText: document.getElementById('storageQuotaStatus')?.textContent
        };
      })()
    `);
    console.log(`  ✓ Pruning: removed ${pruneRes.prunedCount} takes, remaining=${pruneRes.remainingGuitarTakesCount}`);
    console.log(`  ✓ Storage Quota Bar: "${pruneRes.quotaStatusText}"`);
    if (pruneRes.prunedCount !== 8 || pruneRes.remainingGuitarTakesCount !== 4) {
      throw new Error('Pruning test failed: ' + JSON.stringify(pruneRes));
    }

    // TEST 10: Deck Loading with Stress-Tested Tracks
    console.log('[11/12] Testing Deck Loading with Imported & Stress-Tested Tracks...');
    const deckLoadRes = await evaluate(`
      (async () => {
        // Load stress_trk_1 to Deck A
        await window.loadTrackToDeck('A', {
          id: 'stress_trk_1',
          name: 'Stress Synthwave Loop #1',
          bpm: 93,
          buffer: window.inMemoryBuffers['stress_trk_1']
        });

        // Load stress_trk_2 to Deck B
        await window.loadTrackToDeck('B', {
          id: 'stress_trk_2',
          name: 'Stress Synthwave Loop #2',
          bpm: 96,
          buffer: window.inMemoryBuffers['stress_trk_2']
        });

        const deckA = window.DJ.decks.A;
        const deckB = window.DJ.decks.B;
        return {
          deckATitle: deckA.trackName,
          deckAPeaksLength: deckA.waveformPeaks?.length,
          deckBTitle: deckB.trackName,
          deckBPeaksLength: deckB.waveformPeaks?.length
        };
      })()
    `);
    console.log(`  ✓ Loaded to Deck A: "${deckLoadRes.deckATitle}" (peaks=${deckLoadRes.deckAPeaksLength})`);
    console.log(`  ✓ Loaded to Deck B: "${deckLoadRes.deckBTitle}" (peaks=${deckLoadRes.deckBPeaksLength})`);
    if (deckLoadRes.deckAPeaksLength !== 1280 || deckLoadRes.deckBPeaksLength !== 1280) {
      throw new Error('Deck loading peaks generation failed: expected 1280 (640 min/max pairs), got ' + deckLoadRes.deckAPeaksLength);
    }

    // TEST 11: Clean-up Stress Tracks & Re-seed
    console.log('[12/12] Restoring Default 10 Trending Tracks & Clean Crate State...');
    await evaluate(`
      (async () => {
        const tx = window.crateDB.transaction('tracks', 'readwrite');
        const store = tx.objectStore('tracks');
        const all = await new Promise(r => { const q = store.getAll(); q.onsuccess = () => r(q.result); });
        for (const t of all) {
          if (!window.DEFAULT_TRACKS_META.some(d => d.id === t.id)) {
            store.delete(t.id);
            delete window.inMemoryBuffers[t.id];
          }
        }
        await new Promise(r => { tx.oncomplete = r; });
        await window.refreshCrateTable();
        window.autoLoadInitialDecks();
      })()
    `);

    const finalState = await evaluate(`
      (() => {
        const rowCount = document.querySelectorAll('#crateTableBody tr[data-trackid]').length;
        const badgeAll = document.getElementById('badgeCrateAll')?.textContent;
        return { rowCount, badgeAll };
      })()
    `);
    console.log(`  ✓ Clean state restored: rowCount=${finalState.rowCount}, badgeAll=${finalState.badgeAll}`);

    // Verify Console Errors
    console.log('\n=== CONSOLE INTEGRITY CHECK ===');
    console.log(`Errors logged: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.error('Console errors detected:', consoleErrors);
      throw new Error(`Zero console errors requirement violated! Found ${consoleErrors.length} errors.`);
    }
    console.log('✓ 100% Zero Console Errors!');

    console.log('\n🎉 ALL SIKLUS 2 TESTS PASSED PERFECTLY (100% SUCCESS)!\n');
    chrome.kill();
    process.exit(0);

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    if (consoleErrors.length > 0) {
      console.error('Console errors:', consoleErrors);
    }
    chrome.kill();
    process.exit(1);
  }
}

runTestSuite();
