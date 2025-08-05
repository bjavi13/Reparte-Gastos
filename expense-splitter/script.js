// Estado
let participants = [];
let debts = {}; // debts[a][b] = cuanto A debe a B

// --- Persistencia (localStorage) ---
const save = () => {
  localStorage.setItem('participants', JSON.stringify(participants));
  localStorage.setItem('debts', JSON.stringify(debts));
};
const load = () => {
  try{
    const p = JSON.parse(localStorage.getItem('participants')||'[]');
    const d = JSON.parse(localStorage.getItem('debts')||'{}');
    if(Array.isArray(p)) participants = p;
    if(d && typeof d==='object') debts = d;
  }catch(e){}
};
load();

// Inicializar estructura deudas si viene vacía o faltan claves
const ensureMatrix = () => {
  participants.forEach(a=>{
    debts[a] = debts[a] || {};
    participants.forEach(b=>{
      if(a!==b){
        debts[a][b] = Number(debts[a][b]||0);
      }
    });
  });
};
ensureMatrix();

// Pestañas
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.target).classList.add('active');

    if (tab.dataset.target === 'payments') updatePaymentUI();
    if (tab.dataset.target === 'summary') updateSummary();
    if (tab.dataset.target === 'confirm') updateConfirmUI();
  });
});

// Añadir participante
document.getElementById('add-participant-btn').addEventListener('click', () => {
  const nameInput = document.getElementById('participant-name');
  const name = (nameInput.value||'').trim();
  if (!name || participants.includes(name)) return;

  participants.push(name);
  // Asegurar filas/columnas
  participants.forEach(p => {
    debts[p] = debts[p] || {};
    participants.forEach(q => {
      if(p!==q){
        debts[p][q] = Number(debts[p][q]||0);
      }
    });
  });

  nameInput.value = '';
  renderParticipants();
  updatePaymentUI();
  save();
});

// Mostrar participantes
function renderParticipants() {
  const list = document.getElementById('participant-list');
  list.innerHTML = '';
  participants.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p;
    list.appendChild(li);
  });
}

// UI de pagos
function updatePaymentUI() {
  const payerSelect = document.getElementById('payment-payer');
  payerSelect.innerHTML = '';
  participants.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    payerSelect.appendChild(opt);
  });

  const sharesDiv = document.getElementById('payment-shares');
  sharesDiv.innerHTML = '';
  participants.forEach(p => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = p;
    cb.checked = true;
    label.appendChild(cb);
    label.append(' ' + p);
    sharesDiv.appendChild(label);
  });
}

// Registrar pago
document.getElementById('add-payment-btn').addEventListener('click', () => {
  const amount = parseFloat(document.getElementById('payment-amount').value);
  const payer = document.getElementById('payment-payer').value;
  const selected = Array.from(document.querySelectorAll('#payment-shares input[type=checkbox]'))
                        .filter(cb => cb.checked)
                        .map(cb => cb.value);
  if (!amount || !payer || selected.length === 0) return;

  const share = amount / selected.length;
  selected.forEach(p => {
    if (p !== payer) {
      debts[p] = debts[p] || {};
      debts[p][payer] = Number(debts[p][payer]||0) + share;
    }
  });

  document.getElementById('payment-amount').value = '';
  save();
  // Ir al resumen
  document.querySelector('.tab[data-target="summary"]').click();
});

// Resumen neto
function updateSummary() {
  const div = document.getElementById('debt-summary');
  div.innerHTML = '';
  const seen = new Set();

  participants.forEach(a => {
    participants.forEach(b => {
      if (a === b) return;
      const key = [a,b].sort().join('|');
      if (seen.has(key)) return;

      const ab = Number(debts[a]?.[b]||0);
      const ba = Number(debts[b]?.[a]||0);
      const net = ab - ba;
      if (net > 0) {
        div.appendChild(para(`${a} debe a ${b}: €${net.toFixed(2)}`));
      } else if (net < 0) {
        div.appendChild(para(`${b} debe a ${a}: €${(-net).toFixed(2)}`));
      }
      seen.add(key);
    });
  });

  if (!div.hasChildNodes()) div.textContent = 'No hay deudas.';
}

function para(text){ const p=document.createElement('p'); p.textContent=text; return p; }

// Confirmar Deudas
function updateConfirmUI() {
  const div = document.getElementById('confirm-list');
  div.innerHTML = '';
  const seen = new Set();

  participants.forEach(a => {
    participants.forEach(b => {
      if (a === b) return;
      const key = [a,b].sort().join('|');
      if (seen.has(key)) return;

      const ab = Number(debts[a]?.[b]||0);
      const ba = Number(debts[b]?.[a]||0);
      const net = ab - ba;
      if (net !== 0) {
        const debtor = net > 0 ? a : b;
        const creditor = net > 0 ? b : a;
        const amount = Math.abs(net).toFixed(2);

        const item = document.createElement('div');
        item.className = 'confirm-item';
        const span = document.createElement('span');
        span.textContent = `${debtor} debe a ${creditor}: €${amount}`;
        const flag = document.createElement('span');
        flag.className = 'moroso';
        flag.textContent = 'MOROSO';
        const btn = document.createElement('button');
        btn.textContent = 'Confirmar Cobro';
        btn.addEventListener('click', () => {
          // Eliminar deuda neta: igualamos ambas direcciones a 0
          debts[a][b] = 0;
          debts[b][a] = 0;
          save();
          updateConfirmUI();
          updateSummary();
        });

        item.appendChild(span);
        item.appendChild(flag);
        item.appendChild(btn);
        div.appendChild(item);
      }
      seen.add(key);
    });
  });

  if (!div.hasChildNodes()) {
    div.textContent = 'No hay deudas pendientes.';
  }
}

// Reset de datos
document.getElementById('reset-data').addEventListener('click', () => {
  if(confirm('Esto borrará todos los participantes y deudas guardados en este dispositivo.')){
    participants = [];
    debts = {};
    save();
    renderParticipants();
    updatePaymentUI();
    updateSummary();
    updateConfirmUI();
  }
});

// Render inicial
renderParticipants();
updatePaymentUI();
updateSummary();
