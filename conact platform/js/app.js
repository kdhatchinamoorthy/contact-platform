// ================================================
// app.js — Main application entry & utilities
// ================================================
let currentPage = 'dashboard';

// ── Bootstrap ─────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  spawnParticles();

  // Listen Enter on auth forms
  document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key==='Enter') handleLogin(); });
  document.getElementById('reg-pass').addEventListener('keydown', e => { if (e.key==='Enter') handleRegister(); });

  if (checkSession()) { enterApp(); }
});

async function initApp() {
  // Update UI with user info
  const name = currentUser.name || currentUser.email.split('@')[0];
  const initial = name[0].toUpperCase();
  const setEl = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  setEl('sidebar-uname', name);
  setEl('sidebar-avatar', initial);
  setEl('tb-avatar', initial);

  // Load API key
  loadSavedApiKey();

  // Load data
  await loadContacts();
  await loadChats();
  await loadReminders();
  await loadActivityFeed();

  navigateTo('dashboard');
}

// ── Navigation ─────────────────────────────────
function navigateTo(page) {
  currentPage = page;

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => { 
    p.classList.remove('active'); 
    p.style.display = 'none'; 
  });
  // Remove active from all nav items
  document.querySelectorAll('.s-nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  const navEl  = document.getElementById('nav-'  + page);
  if (pageEl) { 
    pageEl.classList.remove('hidden'); // Ensure hidden class is removed
    pageEl.style.display = 'block'; 
    pageEl.classList.add('active'); 
  }
  if (navEl) navEl.classList.add('active');

  const titles = {
    dashboard: ['Dashboard','Welcome back! Here\'s your overview.'],
    contacts:  ['Contacts','Manage your contact network.'],
    ai:        ['AI Assistant','Nexus AI — Your intelligent contact assistant.'],
    chat:      ['Messages','Chat with your contacts.'],
    reminders: ['Reminders','Never miss a follow-up.']
  };
  const [title, sub] = titles[page] || ['ContactHub',''];
  const setEl = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  setEl('page-title', title);
  setEl('page-sub', sub);

  // Refresh data for clicked page
  if (page === 'contacts')  renderContacts(allContacts);
  if (page === 'dashboard') updateDashboard();
  if (page === 'reminders') loadReminders();
  if (page === 'chat')      loadChats();

  // Close mobile sidebar
  if (window.innerWidth < 900) {
    document.getElementById('sidebar').classList.add('collapsed');
  }
}

// ── Sidebar toggle ─────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ── Modals ─────────────────────────────────────
function openModal(overlayId) {
  const el = document.getElementById(overlayId);
  if (el) { el.classList.remove('hidden'); el.style.display='flex'; }
}

function closeModal(overlayId) {
  const el = document.getElementById(overlayId);
  if (el) { el.classList.add('hidden'); el.style.display=''; }
}

function overlayClose(e, overlayId) {
  if (e.target.id === overlayId) closeModal(overlayId);
}

// ── Toast notifications ─────────────────────────
function showToast(msg, type='info') {
  const container = document.getElementById('toasts');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const ico = type==='success'?'✅':type==='error'?'❌':'ℹ️';
  toast.innerHTML = `<span>${ico}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Activity feed ──────────────────────────────
async function logActivity(type, text) {
  if (!currentUser) return;
  await dbAdd('activity', { userId: currentUser.id, type, text, ts: Date.now() });
  loadActivityFeed();
}

async function loadActivityFeed() {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;
  const activities = await dbByIndex('activity', 'userId', currentUser.id);
  const recent = activities.sort((a,b)=>b.ts-a.ts).slice(0,8);
  if (!recent.length) { feed.innerHTML='<p class="empty-mini">No recent activity.</p>'; return; }
  const icons = { add:'➕', edit:'✏️', delete:'🗑️', message:'💬', ai:'🤖', reminder:'⏰', register:'🎉' };
  feed.innerHTML = recent.map(a => `
    <div class="activity-item">
      <span class="act-icon">${icons[a.type]||'📌'}</span>
      <div><div class="act-text">${escHtml(a.text)}</div><div class="act-time">${formatTime(a.ts)}</div></div>
    </div>`).join('');
}

// ── Particles ──────────────────────────────────
function spawnParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 2;
    const colors = ['rgba(0,212,255,0.6)','rgba(124,58,237,0.6)','rgba(168,85,247,0.5)','rgba(0,212,255,0.3)'];
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-duration:${6+Math.random()*10}s;
      animation-delay:${Math.random()*8}s;
    `;
    container.appendChild(p);
  }
}

// ── Helpers ────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000) return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  if (diff < 604800000) return d.toLocaleDateString([],{weekday:'short'});
  return d.toLocaleDateString([],{month:'short',day:'numeric'});
}
