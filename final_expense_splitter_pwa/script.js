import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc,
  onSnapshot, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Configura aquí tu Firebase
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};
initializeApp(firebaseConfig);
const auth = getAuth(), db = getFirestore();

let CURRENT = { groupCode: null, userName: null, unsub: null, state: { participants: [], debts: {} } };
const byId = id => document.getElementById(id);
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

function ensureMatrix(st) {
  st.participants.forEach(a => {
    st.debts[a] = st.debts[a] || {};
    st.participants.forEach(b => {
      if (a !== b) st.debts[a][b] = Number(st.debts[a][b] || 0);
    });
  });
}

// Pestañas
$$('.tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.tab').forEach(t => t.classList.remove('active'));
  $$('.subsection').forEach(s => s.classList.remove('active'));
  tab.classList.add('active');
  byId(tab.dataset.target).classList.add('active');
  if (tab.dataset.target === 'payments') updatePaymentUI();
  if (tab.dataset.target === 'summary') updateSummary();
  if (tab.dataset.target === 'confirm') updateConfirmUI();
}));

// Crear grupo
byId('create-group-btn').addEventListener('click', async () => {
  const code = byId('create-code').value.trim().toUpperCase();
  const name = byId('creator-name').value.trim();
  if (!code || !name) return alert('Introduce código y nombre');
  try {
    await signInAnonymously(auth);
    const ref = doc(db, 'groups', code);
    if ((await getDoc(ref)).exists()) return alert('Ese código ya existe');
    const init = { participants: [name], debts: {} };
    ensureMatrix(init);
    await setDoc(ref, init);
    startSession(code, name);
  } catch (e) {
    alert('Error creando grupo: ' + e.message);
  }
});

// Entrar
byId('join-group-btn').addEventListener('click', async () => {
  const code = byId('join-code').value.trim().toUpperCase();
  const name = byId('join-name').value.trim();
  if (!code || !name) return alert('Introduce nombre y código');
  try {
    await signInAnonymously(auth);
    const ref = doc(db, 'groups', code);
    if (!(await getDoc(ref)).exists()) throw new Error('Código no existe');
    await runTransaction(db, async tx => {
      const d = await tx.get(ref);
      const st = d.data();
      st.participants = st.participants || [];
      st.debts = st.debts || {};
      if (!st.participants.includes(name)) {
        st.participants.push(name);
        ensureMatrix(st);
        tx.update(ref, st);
      }
    });
    startSession(code, name);
  } catch (e) {
    alert('Error al entrar: ' + e.message);
  }
});

function startSession(code, name) {
  CURRENT.groupCode = code;
  CURRENT.userName = name;
  byId('gate').classList.remove('active');
  byId('app').classList.add('active');
  byId('group-code').textContent = code;
  byId('user-name').textContent = name;
  if (CURRENT.unsub) CURRENT.unsub();
  CURRENT.unsub = onSnapshot(doc(db, 'groups', code), snap => {
    CURRENT.state = snap.data();
    ensureMatrix(CURRENT.state);
    renderParticipants();
    updatePaymentUI();
    updateSummary();
    updateConfirmUI();
  });
}

// Copiar y salir
byId('copy-code').addEventListener('click', async () => {
  await navigator.clipboard.writeText(CURRENT.groupCode);
  alert('Código copiado');
});
byId('leave-group').addEventListener('click', () => {
  if (CURRENT.unsub) CURRENT.unsub();
  CURRENT = { groupCode: null, userName: null, unsub: null, state: { participants: [], debts: {} } };
  byId('app').classList.remove('active');
  byId('gate').classList.add('active');
});

// Participantes
byId('add-participant-btn').addEventListener('click', async () => {
  const name = byId('participant-name').value.trim();
  if (!name) return;
  const ref = doc(db, 'groups', CURRENT.groupCode);
  await runTransaction(db, async tx => {
    const d = await tx.get(ref);
    const st = d.data();
    st.participants = st.participants || [];
    st.debts = st.debts || {};
    if (!st.participants.includes(name)) {
      st.participants.push(name);
      ensureMatrix(st);
      tx.update(ref, st);
    }
  });
  byId('participant-name').value = '';
});

function renderParticipants() {
  const ul = byId('participant-list');
  ul.innerHTML = '';
  CURRENT.state.participants.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p;
    ul.appendChild(li);
  });
}

// Pagos
function updatePaymentUI() {
  const payer = byId('payment-payer');
  payer.innerHTML = '';
  CURRENT.state.participants.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p; opt.textContent = p;
    payer.appendChild(opt);
  });
  const shares = byId('payment-shares');
  shares.innerHTML = '';
  CURRENT.state.participants.forEach(p => {
    const lbl = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = p; cb.checked = true;
    lbl.append(cb, ' ', p);
    shares.appendChild(lbl);
  });
}
byId('add-payment-btn').addEventListener('click', async () => {
  const amt = parseFloat(byId('payment-amount').value);
  const payer = byId('payment-payer').value;
  const sel = Array.from(document.querySelectorAll('#payment-shares input:checked')).map(i => i.value);
  if (!amt || !payer || !sel.length) return;
  const ref = doc(db, 'groups', CURRENT.groupCode);
  await runTransaction(db, async tx => {
    const d = await tx.get(ref);
    const st = d.data(); ensureMatrix(st);
    const share = amt / sel.length;
    sel.forEach(p => {
      if (p !== payer) {
        st.debts[p] = st.debts[p] || {};
        st.debts[p][payer] = (st.debts[p][payer] || 0) + share;
      }
    });
    tx.update(ref, st);
  });
  byId('payment-amount').value = '';
  $('.tab[data-target="summary"]').click();
});

// Resumen
function updateSummary() {
  const div = byId('debt-summary');
  div.innerHTML = '';
  const { participants, debts } = CURRENT.state;
  const seen = new Set();
  participants.forEach(a => {
    participants.forEach(b => {
      if (a === b) return;
      const key = [a, b].sort().join('|');
      if (seen.has(key)) return;
      const net = (debts[a]?.[b] || 0) - (debts[b]?.[a] || 0);
      if (net > 0) appendP(`${a} debe a ${b}: €${net.toFixed(2)}`);
      else if (net < 0) appendP(`${b} debe a ${a}: €${(-net).toFixed(2)}`);
      seen.add(key);
    });
  });
  if (!div.hasChildNodes()) div.textContent = 'No hay deudas.';
  function appendP(txt) {
    const p = document.createElement('p');
    p.textContent = txt;
    div.appendChild(p);
  }
}

// Confirmar
function updateConfirmUI() {
  const div = byId('confirm-list');
  div.innerHTML = '';
  const { participants, debts } = CURRENT.state;
  const seen = new Set();
  participants.forEach(a => {
    participants.forEach(b => {
      if (a === b) return;
      const key = [a, b].sort().join('|');
      if (seen.has(key)) return;
      const net = (debts[a]?.[b] || 0) - (debts[b]?.[a] || 0);
      if (net !== 0) {
        const debtor = net > 0 ? a : b;
        const creditor = net > 0 ? b : a;
        const amt = Math.abs(net).toFixed(2);
        const item = document.createElement('div');
        item.className = 'confirm-item';
        const txt = document.createElement('span');
        txt.textContent = `${debtor} debe a ${creditor}: €${amt}`;
        const flag = document.createElement('span');
        flag.className = 'moroso';
        flag.textContent = 'MOROSO';
        const btn = document.createElement('button');
        btn.textContent = 'Confirmar Cobro';
        btn.addEventListener('click', () => confirmDebtPair(a, b));
        item.append(txt, flag, btn);
        div.appendChild(item);
      }
      seen.add(key);
    });
  });
  if (!div.hasChildNodes()) div.textContent = 'No hay deudas pendientes.';
}
async function confirmDebtPair(a, b) {
  const ref = doc(db, 'groups', CURRENT.groupCode);
  await runTransaction(db, async tx => {
    const d = await tx.get(ref);
    const st = d.data();
    st.debts[a] = st.debts[a] || {};
    st.debts[b] = st.debts[b] || {};
    st.debts[a][b] = 0;
    st.debts[b][a] = 0;
    tx.update(ref, st);
  });
}