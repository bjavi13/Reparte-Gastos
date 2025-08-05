// script.js (ESM con Firebase)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- Configura tu Firebase ---
const firebaseConfig = {
  apiKey: "PEGAR_AQUI",
  authDomain: "PEGAR_AQUI.firebaseapp.com",
  projectId: "PEGAR_AQUI",
  storageBucket: "PEGAR_AQUI.appspot.com",
  messagingSenderId: "PEGAR_AQUI",
  appId: "PEGAR_AQUI"
};
initializeApp(firebaseConfig);
const auth = getAuth(), db = getFirestore();

let CURRENT = { groupCode: null, userName: null, unsub: null, state: { participants: [], debts: {} } };
const byId = id => document.getElementById(id), $ = sel => document.querySelector(sel), $$ = sel => document.querySelectorAll(sel);
const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)))
  .map(n => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[n % 32]).join("");
const ensureMatrix = st => {
  st.participants.forEach(a => {
    st.debts[a] = st.debts[a] || {};
    st.participants.forEach(b => { if(a !== b) st.debts[a][b] = Number(st.debts[a][b] || 0); });
  });
};

// Manejo de tabs
$$('.tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.tab').forEach(t => t.classList.remove('active'));
  $$('.subsection').forEach(s => s.classList.remove('active'));
  tab.classList.add('active');
  byId(tab.dataset.target).classList.add('active');
  if(tab.dataset.target === 'payments') updatePaymentUI();
  if(tab.dataset.target === 'summary') updateSummary();
  if(tab.dataset.target === 'confirm') updateConfirmUI();
}));

// Crear grupo
byId('create-group-btn').addEventListener('click', async () => {
  const name = byId('creator-name').value.trim();
  if(!name) return alert('Introduce tu nombre');
  await signInAnonymously(auth);
  const code = randomCode();
  const ref = doc(db, 'groups', code);
  const initState = { participants: [name], debts: {} }; ensureMatrix(initState);
  await setDoc(ref, initState);
  startSession(code, name);
});

// Entrar en grupo
byId('join-group-btn').addEventListener('click', async () => {
  const name = byId('join-name').value.trim();
  const code = byId('join-code').value.trim().toUpperCase();
  if(!name || !code) return alert('Introduce nombre y código');
  await signInAnonymously(auth);
  const ref = doc(db, 'groups', code);
  const snap = await getDoc(ref);
  if(!snap.exists()) return alert('Código no existe');
  await runTransaction(db, async tx => {
    const d = await tx.get(ref);
    if(!d.exists()) throw 'no-exists';
    const st = d.data(); st.participants = st.participants || []; st.debts = st.debts || {};
    if(!st.participants.includes(name)) {
      st.participants.push(name);
      ensureMatrix(st);
      tx.update(ref, st);
    }
  });
  startSession(code, name);
});

// Iniciar sesión
function startSession(code, name) {
  CURRENT.groupCode = code;
  CURRENT.userName = name;
  byId('gate').classList.remove('active');
  byId('app').classList.add('active');
  byId('group-code').textContent = code;
  byId('user-name').textContent = name;
  if(CURRENT.unsub) CURRENT.unsub();
  CURRENT.unsub = onSnapshot(doc(db, 'groups', code), snap => {
    if(!snap.exists()) return;
    CURRENT.state = snap.data();
    ensureMatrix(CURRENT.state);
    renderParticipants(); updatePaymentUI(); updateSummary(); updateConfirmUI();
  });
}

// Copiar y salir
byId('copy-code').addEventListener('click', async () => { await navigator.clipboard.writeText(CURRENT.groupCode); alert('Código copiado'); });
byId('leave-group').addEventListener('click', () => {
  if(CURRENT.unsub) CURRENT.unsub();
  CURRENT = { groupCode:null, userName:null, unsub:null, state:{participants:[],debts:{}} };
  byId('app').classList.remove('active');
  byId('gate').classList.add('active');
});

// ... (continúa con participantes, pagos, resumen, confirmación)
