import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

let CURRENT = { groupCode:null, userName:null, unsub:null, state:{participants:[],debts:{}} };
const byId=id=>document.getElementById(id), $=sel=>document.querySelector(sel), $$=sel=>document.querySelectorAll(sel);
const randomCode=()=>
  Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(n=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[n%32]).join("");
const ensureMatrix=st=>{
  st.participants.forEach(a=>{
    st.debts[a]=st.debts[a]||{};
    st.participants.forEach(b=>{ if(a!==b) st.debts[a][b]=Number(st.debts[a][b]||0); });
  });
};
$$('.tab').forEach(tab=>tab.addEventListener('click',()=>{ 
  $$('.tab').forEach(t=>t.classList.remove('active'));
  $$('.subsection').forEach(s=>s.classList.remove('active'));
  tab.classList.add('active');
  byId(tab.dataset.target).classList.add('active');
  if(tab.dataset.target==='payments') updatePaymentUI();
  if(tab.dataset.target==='summary') updateSummary();
  if(tab.dataset.target==='confirm') updateConfirmUI();
}));
byId('create-group-btn').addEventListener('click',async()=>{ 
  const name=byId('creator-name').value.trim(); if(!name) return alert('Introduce tu nombre');
  await signInAnonymously(auth); const code=randomCode(), ref=doc(db,'groups',code);
  const init={participants:[name],debts:{}}; ensureMatrix(init); await setDoc(ref,init);
  startSession(code,name);
});
# ... (continúa el resto del script)