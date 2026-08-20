(function(){
  const pwInput = document.getElementById('pw');
  const toggleVis = document.getElementById('toggleVis');
  const meterFill = document.getElementById('meterFill');
  const meterLabel = document.getElementById('meterLabel');
  const entropyVal = document.getElementById('entropyVal');
  const crackVal = document.getElementById('crackVal');
  const checklist = document.getElementById('checklist');
  const lockStatus = document.getElementById('lockStatus');
  const suggList = document.getElementById('suggList');
  const regenBtn = document.getElementById('regenBtn');
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');
  const saveHistBtn = document.getElementById('saveHistBtn');
  const reuseFlag = document.getElementById('reuseFlag');

  const COMMON_PASSWORDS = ["123456","password","123456789","12345678","12345","1234567",
    "qwerty","abc123","password1","111111","123123","admin","letmein","welcome",
    "monkey","iloveyou","dragon","football","000000","qwerty123","1q2w3e4r",
    "sunshine","master","login","princess","starwars","passw0rd","trustno1"];

  let historyHashes = []; // { hash, label }

  async function sha256(text){
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  function poolSize(pw){
    let pool = 0;
    if (/[a-z]/.test(pw)) pool += 26;
    if (/[A-Z]/.test(pw)) pool += 26;
    if (/[0-9]/.test(pw)) pool += 10;
    if (/[^a-zA-Z0-9]/.test(pw)) pool += 32;
    return pool || 1;
  }

  function entropyBits(pw){
    if (!pw) return 0;
    return pw.length * Math.log2(poolSize(pw));
  }

  function formatCrackTime(bits){
    if (bits <= 0) return 'instant';
    const guessesPerSec = 1e10;
    const seconds = Math.pow(2, bits) / guessesPerSec / 2; // average case
    const units = [
      ['centuries', 3153600000],
      ['years', 31536000],
      ['days', 86400],
      ['hours', 3600],
      ['minutes', 60],
      ['seconds', 1],
    ];
    if (seconds < 1) return 'instant';
    for (const [name, size] of units){
      if (seconds >= size){
        const val = seconds / size;
        const display = val > 999 ? val.toExponential(1) : val.toFixed(val < 10 ? 1 : 0);
        return `${display} ${name}`;
      }
    }
    return 'instant';
  }

  let currentHash = '';

  async function analyze(){
    const pw = pwInput.value;
    currentHash = pw ? await sha256(pw) : '';

    const checks = {
      length: pw.length >= 12,
      caseMix: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
      numerals: /[0-9]/.test(pw),
      symbols: /[^a-zA-Z0-9]/.test(pw),
      notReused: pw.length > 0 && !COMMON_PASSWORDS.includes(pw.toLowerCase()) && !historyHashes.some(h => h.hash === currentHash),
    };

    const pinKeys = ['length','caseMix','numerals','symbols','notReused'];
    pinKeys.forEach((key, i) => {
      const pin = document.querySelector(`.pin[data-pin="${i}"]`);
      const lbl = document.getElementById(`lbl-${i}`);
      if (checks[key]){
        pin.setAttribute('transform', 'translate(0,26)');
        pin.setAttribute('fill', '#52C7B8');
        lbl.classList.add('met');
      } else {
        pin.removeAttribute('transform');
        pin.setAttribute('fill', '#4A5578');
        lbl.classList.remove('met');
      }
    });

    const metCount = pinKeys.filter(k => checks[k]).length;
    const plug = document.getElementById('plug');
    if (metCount === 5){
      lockStatus.textContent = 'UNLOCKED — ALL 5 PINS ALIGNED';
      lockStatus.classList.add('unlocked');
      plug.setAttribute('stroke', '#52C7B8');
    } else {
      lockStatus.textContent = pw ? `SECURED — ${metCount} / 5 PINS ALIGNED` : 'SECURED — 0 / 5 PINS ALIGNED';
      lockStatus.classList.remove('unlocked');
      plug.setAttribute('stroke', '#3A4560');
    }

    // entropy + crack time
    const bits = entropyBits(pw);
    entropyVal.textContent = `${bits.toFixed(1)} bits`;
    crackVal.textContent = formatCrackTime(bits);

    // meter
    let pct = Math.min(100, (bits / 80) * 100);
    let label, color;
    if (!pw){ label = '— empty —'; color = '#E2555C'; pct = 0; }
    else if (metCount <= 1 || bits < 28){ label = 'Very weak'; color = '#E2555C'; }
    else if (metCount === 2 || bits < 40){ label = 'Weak'; color = '#E2555C'; }
    else if (metCount === 3 || bits < 55){ label = 'Fair'; color = '#E2A33D'; }
    else if (metCount === 4 || bits < 70){ label = 'Strong'; color = '#52C7B8'; }
    else { label = 'Very strong'; color = '#52C7B8'; }
    meterFill.style.width = pct + '%';
    meterFill.style.background = color;
    meterLabel.textContent = label;
    meterLabel.style.color = color;

    // checklist
    const items = [
      { ok: checks.length, okText: 'At least 12 characters long', badText: `Only ${pw.length} character${pw.length===1?'':'s'} — aim for 12+` },
      { ok: checks.caseMix, okText: 'Mixes uppercase and lowercase letters', badText: 'Add both uppercase and lowercase letters' },
      { ok: checks.numerals, okText: 'Includes numerals', badText: 'Add at least one number' },
      { ok: checks.symbols, okText: 'Includes symbols (!@#$…)', badText: 'Add at least one symbol' },
      { ok: checks.notReused, okText: 'Not a common or previously used password', badText: pw && (COMMON_PASSWORDS.includes(pw.toLowerCase()) ? 'This is one of the most breached passwords in the world' : 'This matches a password already in your history') },
    ];
    checklist.innerHTML = items.map(it => {
      if (!pw) return `<div class="check-item"><span class="dot"></span><span class="txt">${it.okText}</span></div>`;
      const cls = it.ok ? 'ok' : 'warn';
      const dotChar = it.ok ? '✓' : '!';
      const text = it.ok ? it.okText : it.badText;
      return `<div class="check-item ${cls}"><span class="dot">${dotChar}</span><span class="txt">${text}</span></div>`;
    }).join('');

    // reuse flag
    reuseFlag.classList.toggle('show', pw.length > 0 && historyHashes.some(h => h.hash === currentHash));
  }

  toggleVis.addEventListener('click', () => {
    pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
    toggleVis.textContent = pwInput.type === 'password' ? '👁' : '🙈';
  });

  pwInput.addEventListener('input', analyze);

  // ---------- Suggestions ----------
  function randomInt(max){
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
  }

  function generatePassword(length){
    const sets = [
      'abcdefghijkmnpqrstuvwxyz',
      'ABCDEFGHJKLMNPQRSTUVWXYZ',
      '23456789',
      '!@#$%^&*-_=+?'
    ];
    let chars = '';
    let pw = [];
    sets.forEach(s => { pw.push(s[randomInt(s.length)]); chars += s; });
    for (let i = pw.length; i < length; i++){
      pw.push(chars[randomInt(chars.length)]);
    }
    // shuffle
    for (let i = pw.length - 1; i > 0; i--){
      const j = randomInt(i + 1);
      [pw[i], pw[j]] = [pw[j], pw[i]];
    }
    return pw.join('');
  }

  function renderSuggestions(){
    const suggestions = [generatePassword(16), generatePassword(20), generatePassword(14)];
    suggList.innerHTML = suggestions.map((s, i) => `
      <div class="sugg-item">
        <code>${s}</code>
        <div class="sugg-actions">
          <button class="btn" data-copy="${s}" type="button">Copy</button>
          <button class="btn primary" data-use="${s}" type="button">Use</button>
        </div>
      </div>
    `).join('');
  }

  suggList.addEventListener('click', (e) => {
    const copyVal = e.target.getAttribute('data-copy');
    const useVal = e.target.getAttribute('data-use');
    if (copyVal){
      navigator.clipboard?.writeText(copyVal);
      e.target.textContent = 'Copied';
      setTimeout(() => { e.target.textContent = 'Copy'; }, 1200);
    }
    if (useVal){
      pwInput.value = useVal;
      pwInput.type = 'text';
      toggleVis.textContent = '🙈';
      analyze();
    }
  });

  regenBtn.addEventListener('click', renderSuggestions);

  // ---------- History (simulated DB) ----------
  function renderHistory(){
    historyEmpty.style.display = historyHashes.length ? 'none' : 'block';
    historyList.innerHTML = historyHashes.map((h, i) => `
      <div class="history-item">
        <span>Entry ${i + 1}</span>
        <span class="hash">${h.hash.slice(0, 24)}…</span>
      </div>
    `).join('');
  }

  saveHistBtn.addEventListener('click', async () => {
    const pw = pwInput.value;
    if (!pw) return;
    const hash = await sha256(pw);
    if (!historyHashes.some(h => h.hash === hash)){
      historyHashes.push({ hash });
      renderHistory();
    }
    analyze();
  });

  renderSuggestions();
  renderHistory();
  analyze();
})();
