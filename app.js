// app.js — Conteo CKLASS Módulo Cíclicos (PWA + Firebase)
// Requisitos: Firestore, Auth (Email/Password), reglas incluidas en el repo.
(() => {
  // Firebase init
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // UI refs
  const loginView = document.getElementById('loginView');
  const appView = document.getElementById('appView');
  const userInfo = document.getElementById('userInfo');
  const catalogVersion = document.getElementById('catalogVersion');

  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const btnCreateDemo = document.getElementById('btnCreateDemo');

  const folioPrefix = document.getElementById('folioPrefix');
  const almacen = document.getElementById('almacen');
  const sucursal = document.getElementById('sucursal');
  const folioInput = document.getElementById('folioInput');
  const btnNuevoFolio = document.getElementById('btnNuevoFolio');
  const btnUnirseFolio = document.getElementById('btnUnirseFolio');

  const kpiEsc = document.getElementById('kpiEsc');
  const kpiFal = document.getElementById('kpiFal');
  const kpiSob = document.getElementById('kpiSob');

  const btnCam = document.getElementById('btnCam');
  const btnStopCam = document.getElementById('btnStopCam');
  const video = document.getElementById('video');
  const manualCode = document.getElementById('manualCode');
  const talla = document.getElementById('talla');
  const coment = document.getElementById('coment');
  const btnRegistrar = document.getElementById('btnRegistrar');

  const tabs = document.getElementById('tabs');
  const tbody = document.getElementById('tbody');
  const tbodyHist = document.getElementById('tbodyHist');
  const btnPrintAll = document.getElementById('btnPrintAll');
  const btnPrintFal = document.getElementById('btnPrintFal');
  const btnPrintSob = document.getElementById('btnPrintSob');
  const btnPrintCom = document.getElementById('btnPrintCom');

  const printArea = document.getElementById('printArea');
  const printTipo = document.getElementById('printTipo');
  const pFolio = document.getElementById('pFolio');
  const pAlm = document.getElementById('pAlm');
  const pSuc = document.getElementById('pSuc');
  const pFecha = document.getElementById('pFecha');
  const pCat = document.getElementById('pCat');
  const tbodyPrint = document.getElementById('tbodyPrint');

  let currentUser = null;
  let currentFolio = null;
  let stopStream = null;
  let barcodeDetector = null;
  let unsubScans = null;

  const APP = window.__APP_SETTINGS__ || { GITHUB_PAGES_BASE: "/", CATALOG_VERSION: "24/08/2025" };
  catalogVersion.textContent = `Catálogo: ${APP.CATALOG_VERSION}`;

  // --- Auth ---
  auth.onAuthStateChanged(async (u) => {
    currentUser = u;
    if (u) {
      loginView.classList.add('hidden');
      appView.classList.remove('hidden');
      const token = await u.getIdTokenResult();
      const role = token.claims.role || 'invitado';
      userInfo.textContent = `${u.email} — Rol: ${role}`;
    } else {
      appView.classList.add('hidden');
      loginView.classList.remove('hidden');
      userInfo.textContent = '';
    }
  });

  btnLogin.addEventListener('click', async () => {
    try {
      await auth.signInWithEmailAndPassword(email.value.trim(), password.value.trim());
    } catch (e) {
      alert('Error al iniciar sesión: ' + e.message);
    }
  });
  btnLogout.addEventListener('click', async () => {
    await auth.signOut();
  });
  btnCreateDemo.addEventListener('click', () => {
    email.value = "demo@example.com";
    password.value = "demodemo";
    alert("Usuario demo local establecido en los campos. (No crea cuenta real).");
  });

  // --- Folios ---
  async function createNewFolio(prefix, alm, suc) {
    // Llama a Cloud Function para folio consecutivo
    const folioResp = await fetch(`${location.origin}${APP.GITHUB_PAGES_BASE}__getNextFolio__`, { method:'POST' })
      .catch(() => null);
    let next = null;
    if (folioResp && folioResp.ok) {
      next = await folioResp.json();
    } else {
      // fallback local
      next = { folio: `${prefix}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-001` };
    }
    const doc = {
      folio: next.folio,
      prefix, almacen: alm, sucursal: suc,
      createdAt: new Date().toISOString(),
      createdBy: currentUser ? currentUser.uid : "demo",
      members: currentUser ? [currentUser.uid] : [],
      active: true
    };
    await db.collection('folios').doc(next.folio).set(doc);
    return next.folio;
  }

  btnNuevoFolio.addEventListener('click', async () => {
    if (!almacen.value || !sucursal.value) {
      alert("Completa Almacén y Sucursal.");
      return;
    }
    currentFolio = await createNewFolio(folioPrefix.value, almacen.value.trim(), sucursal.value.trim());
    folioInput.value = currentFolio;
    subscribeScans();
    alert("Folio creado: " + currentFolio);
  });

  btnUnirseFolio.addEventListener('click', async () => {
    const f = folioInput.value.trim();
    if (!f) return alert("Escribe un folio.");
    currentFolio = f;
    subscribeScans();
    alert("Unido a folio: " + currentFolio);
  });

  // --- Escaneo ---
  async function startCamera() {
    try {
      if ('BarcodeDetector' in window) {
        barcodeDetector = new BarcodeDetector({ formats: ['ean_13','ean_8','code_128','code_39','upc_a','upc_e','codabar','itf'] });
      }
    } catch (e) {
      barcodeDetector = null;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = stream;
    await video.play();
    stopStream = () => {
      stream.getTracks().forEach(t => t.stop());
      stopStream = null;
    };
    if (barcodeDetector) detectLoop();
  }

  async function detectLoop() {
    if (!barcodeDetector || !video.videoWidth) {
      requestAnimationFrame(detectLoop);
      return;
    }
    try {
      const codes = await barcodeDetector.detect(video);
      if (codes && codes[0]) {
        await registerScan(codes[0].rawValue);
        await new Promise(r => setTimeout(r, 800)); // antirrebote
      }
    } catch {}
    requestAnimationFrame(detectLoop);
  }

  btnCam.addEventListener('click', startCamera);
  btnStopCam.addEventListener('click', () => { if (stopStream) stopStream(); });

  btnRegistrar.addEventListener('click', async () => {
    if (!manualCode.value) return alert("Captura un código.");
    await registerScan(manualCode.value.trim());
    manualCode.value = '';
  });

  async function registerScan(code) {
    if (!currentFolio) return alert("Crea o únete a un folio.");
    const doc = {
      code, talla: talla.value || null, comentario: coment.value || null,
      by: currentUser ? currentUser.uid : "demo",
      at: new Date().toISOString()
    };
    await db.collection('folios').doc(currentFolio).collection('scans').add(doc);
  }

  // --- Conciliación ---
  let currentTab = 'todos';
  tabs.addEventListener('click', (ev) => {
    if (ev.target.tagName !== 'BUTTON') return;
    [...tabs.children].forEach(b => b.classList.remove('active'));
    ev.target.classList.add('active');
    currentTab = ev.target.dataset.tab;
    renderTables();
  });

  function subscribeScans() {
    if (unsubScans) unsubScans();
    tbody.innerHTML = ''; tbodyHist.innerHTML = '';
    kpiEsc.textContent = '0'; kpiFal.textContent = '0'; kpiSob.textContent = '0';
    unsubScans = db.collection('folios').doc(currentFolio).collection('scans')
      .orderBy('at','desc')
      .onSnapshot(async (snap) => {
        const scans = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        // Historial
        tbodyHist.innerHTML = scans.map(s => `<tr>
          <td>${new Date(s.at).toLocaleString()}</td>
          <td>${s.code}</td>
          <td></td><td></td>
          <td>${s.talla||''}</td>
          <td>${(currentUser && currentUser.uid===s.by) ? 'Yo' : s.by}</td>
        </tr>`).join('');
        // Agrupar físico por code+talla
        const grouped = {};
        for (const s of scans) {
          const key = s.code + '|' + (s.talla||'');
          grouped[key] = (grouped[key]||0) + 1;
        }
        // Cargar teóricos desde Firestore catalog (necesita índices)
        const codes = Object.keys(grouped).map(k => k.split('|')[0]);
        let theoretical = {};
        if (codes.length) {
          const chunks = [];
          while (codes.length) chunks.push(codes.splice(0,10));
          for (const chunk of chunks) {
            const q = await db.collection('catalog').where('code','in',chunk).get();
            q.forEach(doc => theoretical[doc.data().code] = doc.data());
          }
        }
        const rows = [];
        let falt = 0, sobr = 0, esc = 0;
        for (const key of Object.keys(grouped)) {
          const [code, talla] = key.split('|');
          const phys = grouped[key];
          esc += phys;
          const cat = theoretical[code] || { model:'', color:'', talla:'', code, teorico:0 };
          const teorico = cat.teorico || 0;
          const diff = phys - teorico;
          if (diff < 0) falt += 1;
          if (diff > 0) sobr += 1;
          rows.push({
            model: cat.model || '', color: cat.color || '', talla: talla || cat.talla || '',
            code, teorico, fisico: phys, diff
          });
        }
        kpiEsc.textContent = String(esc);
        kpiFal.textContent = String(falt);
        kpiSob.textContent = String(sobr);
        window.__ROWS__ = rows;
        renderTables();
      });
  }

  function renderTables() {
    const rows = window.__ROWS__ || [];
    const filtered = rows.filter(r => {
      if (currentTab === 'faltantes') return r.diff < 0;
      if (currentTab === 'sobrantes') return r.diff > 0;
      if (currentTab === 'compensados') return r.diff === 0;
      return true;
    }).sort((a,b) => (a.model+a.color+a.talla).localeCompare(b.model+b.color+b.talla));

    tbody.innerHTML = filtered.map(r => {
      const cls = r.diff === 0 ? 'pill-ok' : (r.diff > 0 ? 'pill-warn' : 'pill-bad');
      const lbl = r.diff === 0 ? 'Compensado' : (r.diff > 0 ? 'Sobrante' : 'Faltante');
      return `<tr>
        <td>${r.model}</td><td>${r.color}</td><td>${r.talla}</td><td>${r.code}</td>
        <td>${r.teorico}</td><td>${r.fisico}</td><td>${r.diff}</td>
        <td><span class="status-pill ${cls}">${lbl}</span></td>
      </tr>`;
    }).join('');
  }

  // --- Print ---
  function doPrint(type) {
    const rows = (window.__ROWS__ || []).filter(r => {
      if (type === 'faltantes') return r.diff < 0;
      if (type === 'sobrantes') return r.diff > 0;
      if (type === 'compensados') return r.diff === 0;
      return true;
    });
    printTipo.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    pFolio.textContent = currentFolio || '';
    pAlm.textContent = almacen.value || '';
    pSuc.textContent = sucursal.value || '';
    pFecha.textContent = new Date().toLocaleString();
    pCat.textContent = APP.CATALOG_VERSION || '';
    tbodyPrint.innerHTML = rows.map(r => `<tr>
      <td>${r.model}</td><td>${r.color}</td><td>${r.talla}</td><td>${r.code}</td>
      <td>${r.teorico}</td><td>${r.fisico}</td><td>${r.diff}</td>
    </tr>`).join('');
    // Mostrar sección de impresión
    printArea.classList.remove('hidden');
    window.print();
    setTimeout(() => printArea.classList.add('hidden'), 300);
  }
  btnPrintAll.addEventListener('click', () => doPrint('todos'));
  btnPrintFal.addEventListener('click', () => doPrint('faltantes'));
  btnPrintSob.addEventListener('click', () => doPrint('sobrantes'));
  btnPrintCom.addEventListener('click', () => doPrint('compensados'));

  // --- PWA ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js');
    });
  }
})();
