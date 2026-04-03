// ================================================
// auth.js — Authentication logic
// ================================================
let currentUser = null;

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return h.toString(16);
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden'); errEl.textContent = '';

  if (!email || !pass) { showAuthError(errEl, 'Please fill in all fields.'); return; }

  try {
    const user = await dbGetByEmail(email);
    if (!user) { showAuthError(errEl, 'No account found with this email.'); return; }
    if (user.password !== simpleHash(pass)) { showAuthError(errEl, 'Incorrect password.'); return; }

    currentUser = user;
    sessionStorage.setItem('ch_user', JSON.stringify({ id: user.id, name: user.name, email: user.email }));
    enterApp();
  } catch (err) {
    showAuthError(errEl, 'Login error: ' + err.message);
  }
}

async function handleRegister() {
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const errEl = document.getElementById('reg-error');
  errEl.classList.add('hidden');

  if (!name || !email || !pass) { showAuthError(errEl, 'Please fill in all fields.'); return; }
  if (pass.length < 6)          { showAuthError(errEl, 'Password must be at least 6 characters.'); return; }
  if (!email.includes('@'))     { showAuthError(errEl, 'Enter a valid email address.'); return; }

  try {
    const existing = await dbGetByEmail(email);
    if (existing) { showAuthError(errEl, 'An account with this email already exists.'); return; }

    const userId = await dbAdd('users', { name, email, password: simpleHash(pass), createdAt: Date.now() });
    currentUser = { id: userId, name, email };
    sessionStorage.setItem('ch_user', JSON.stringify(currentUser));

    // Add welcome activity
    await dbAdd('activity', { userId, type: 'register', text: 'Account created', ts: Date.now() });
    showToast('Account created successfully! Welcome 🎉', 'success');
    enterApp();
  } catch (err) {
    showAuthError(errEl, err.name === 'ConstraintError' ? 'Email already registered.' : 'Error: ' + err.message);
  }
}

function showAuthError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function switchAuth(mode) {
  document.getElementById('login-card').classList.toggle('hidden', mode !== 'login');
  document.getElementById('register-card').classList.toggle('hidden', mode !== 'register');
}

function handleLogout() {
  currentUser = null;
  sessionStorage.removeItem('ch_user');
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('auth-screen').classList.add('active');
  showToast('Signed out successfully', 'info');
}

function checkSession() {
  const saved = sessionStorage.getItem('ch_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    return true;
  }
  return false;
}

function enterApp() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('active');
  initApp();
}
