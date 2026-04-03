// ================================================
// contacts.js — Contact CRUD & display
// ================================================
let allContacts = [];
let currentView = 'grid';
let selectedColor = '#7c3aed';
let currentDetailId = null;

const catColors = {
  Personal: 'cat-personal', Work: 'cat-work', Family: 'cat-family',
  Friend: 'cat-friend', Business: 'cat-business', Other: 'cat-other'
};

async function loadContacts() {
  if (!currentUser) return;
  allContacts = await dbByIndex('contacts', 'userId', currentUser.id);
  allContacts.sort((a, b) => b.createdAt - a.createdAt);
  renderContacts(allContacts);
  updateDashboard();
}

function renderContacts(contacts) {
  const container = document.getElementById('contacts-container');
  if (!container) return;
  container.className = 'contacts-grid' + (currentView === 'list' ? ' list-view' : '');
  if (!contacts.length) {
    container.innerHTML = `<div class="contacts-empty" style="grid-column:1/-1"><div class="empty-icon">👥</div><h3>No contacts found</h3><p>Add your first contact to get started!</p><button class="btn-primary" onclick="openAddContact()">➕ Add Contact</button></div>`;
    return;
  }
  container.innerHTML = contacts.map(c => renderCard(c)).join('');
}

function renderCard(c) {
  const initials = ((c.firstname || '?')[0] + (c.lastname ? c.lastname[0] : '')).toUpperCase();
  const catClass = catColors[c.category] || 'cat-other';
  const socials = buildSocialsHTML(c);
  return `
  <div class="contact-card" onclick="viewContact(${c.id})">
    <div class="card-top">
      <div class="c-avatar" style="background:${c.avatarColor||'#7c3aed'}">${initials}</div>
      <div class="card-actions">
        <button class="card-action-btn edit" onclick="event.stopPropagation();editContact(${c.id})" title="Edit">✏️</button>
        <button class="card-action-btn" onclick="event.stopPropagation();deleteContact(${c.id})" title="Delete">🗑️</button>
      </div>
    </div>
    <div class="card-body">
      <div class="c-name">${c.firstname} ${c.lastname||''}</div>
      ${c.company ? `<div class="c-company">🏢 ${c.company}${c.jobtitle ? ' · '+c.jobtitle : ''}</div>` : ''}
      <span class="c-category ${catClass}">${c.category||'Other'}</span>
      ${c.email ? `<div class="c-contact-row">✉️ <span>${c.email}</span></div>` : ''}
      ${c.phone ? `<div class="c-contact-row">📞 <span>${c.phone}</span></div>` : ''}
      ${socials ? `<div class="c-socials">${socials}</div>` : ''}
    </div>
  </div>`;
}

function buildSocialsHTML(c) {
  let html = '';
  if (c.facebook) html += `<a class="social-pill social-fb" href="${normalizeUrl(c.facebook)}" target="_blank" onclick="event.stopPropagation()">🌐 FB</a>`;
  if (c.instagram) html += `<a class="social-pill social-ig" href="${normalizeUrl(c.instagram)}" target="_blank" onclick="event.stopPropagation()">📸 IG</a>`;
  if (c.linkedin) html += `<a class="social-pill social-li" href="${normalizeUrl(c.linkedin)}" target="_blank" onclick="event.stopPropagation()">💼 LI</a>`;
  if (c.twitter) html += `<a class="social-pill social-tw" href="${normalizeUrl(c.twitter)}" target="_blank" onclick="event.stopPropagation()">🐦 TW</a>`;
  return html;
}

function normalizeUrl(val) {
  if (!val) return '#';
  return val.startsWith('http') ? val : 'https://' + val;
}

function openAddContact() {
  clearContactForm();
  document.getElementById('c-modal-title').textContent = 'Add Contact';
  document.getElementById('contact-id').value = '';
  switchTab('basic', document.querySelector('.mtab'));
  openModal('contact-modal-overlay');
}

function clearContactForm() {
  ['c-firstname','c-lastname','c-email','c-phone','c-address','c-company','c-jobtitle','c-website','c-facebook','c-instagram','c-linkedin','c-twitter','c-notes','c-tags'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('c-category').value = 'Personal';
  selectedColor = '#7c3aed';
  document.querySelectorAll('.col-opt').forEach(el => el.classList.toggle('sel', el.dataset.c === '#7c3aed'));
}

async function editContact(id) {
  const c = await dbGet('contacts', id);
  if (!c) return;
  closeModal('detail-overlay');
  document.getElementById('c-modal-title').textContent = 'Edit Contact';
  document.getElementById('contact-id').value = id;
  document.getElementById('c-firstname').value  = c.firstname || '';
  document.getElementById('c-lastname').value   = c.lastname  || '';
  document.getElementById('c-email').value      = c.email     || '';
  document.getElementById('c-phone').value      = c.phone     || '';
  document.getElementById('c-address').value    = c.address   || '';
  document.getElementById('c-company').value    = c.company   || '';
  document.getElementById('c-jobtitle').value   = c.jobtitle  || '';
  document.getElementById('c-website').value    = c.website   || '';
  document.getElementById('c-facebook').value   = c.facebook  || '';
  document.getElementById('c-instagram').value  = c.instagram || '';
  document.getElementById('c-linkedin').value   = c.linkedin  || '';
  document.getElementById('c-twitter').value    = c.twitter   || '';
  document.getElementById('c-notes').value      = c.notes     || '';
  document.getElementById('c-tags').value       = c.tags      || '';
  document.getElementById('c-category').value   = c.category  || 'Personal';
  selectedColor = c.avatarColor || '#7c3aed';
  document.querySelectorAll('.col-opt').forEach(el => el.classList.toggle('sel', el.dataset.c === selectedColor));
  switchTab('basic', document.querySelector('.mtab'));
  openModal('contact-modal-overlay');
}

async function saveContact() {
  const firstname = document.getElementById('c-firstname').value.trim();
  if (!firstname) { showToast('First name is required!', 'error'); return; }

  const id = document.getElementById('contact-id').value;
  const data = {
    userId: currentUser.id,
    firstname, lastname: document.getElementById('c-lastname').value.trim(),
    email: document.getElementById('c-email').value.trim(),
    phone: document.getElementById('c-phone').value.trim(),
    address: document.getElementById('c-address').value.trim(),
    company: document.getElementById('c-company').value.trim(),
    jobtitle: document.getElementById('c-jobtitle').value.trim(),
    website: document.getElementById('c-website').value.trim(),
    facebook: document.getElementById('c-facebook').value.trim(),
    instagram: document.getElementById('c-instagram').value.trim(),
    linkedin: document.getElementById('c-linkedin').value.trim(),
    twitter: document.getElementById('c-twitter').value.trim(),
    notes: document.getElementById('c-notes').value.trim(),
    tags: document.getElementById('c-tags').value.trim(),
    category: document.getElementById('c-category').value,
    avatarColor: selectedColor,
    updatedAt: Date.now()
  };

  if (id) {
    data.id = Number(id);
    data.createdAt = (await dbGet('contacts', data.id)).createdAt;
    await dbPut('contacts', data);
    await logActivity('edit', `Updated contact: ${firstname} ${data.lastname}`);
    showToast('Contact updated!', 'success');
  } else {
    data.createdAt = Date.now();
    await dbAdd('contacts', data);
    await logActivity('add', `Added contact: ${firstname} ${data.lastname}`);
    showToast('Contact added!', 'success');
  }

  closeModal('contact-modal-overlay');
  await loadContacts();
}

async function deleteContact(id) {
  if (!confirm('Delete this contact? This cannot be undone.')) return;
  const c = await dbGet('contacts', id);
  await dbDelete('contacts', id);
  await logActivity('delete', `Deleted contact: ${c.firstname} ${c.lastname||''}`);
  showToast('Contact deleted', 'info');
  await loadContacts();
}

async function viewContact(id) {
  const c = await dbGet('contacts', id);
  if (!c) return;
  currentDetailId = id;

  const initials = ((c.firstname||'?')[0] + (c.lastname ? c.lastname[0] : '')).toUpperCase();
  document.getElementById('detail-header').innerHTML = `
    <div class="detail-hero">
      <div class="detail-av" style="background:${c.avatarColor||'#7c3aed'}">${initials}</div>
      <div>
        <div class="detail-hname">${c.firstname} ${c.lastname||''}</div>
        <div class="detail-htag">${c.category||''}${c.company ? ' · '+c.company : ''}</div>
      </div>
    </div>`;

  document.getElementById('detail-edit-btn').onclick = () => editContact(id);

  let body = '';
  if (c.email || c.phone || c.address) {
    body += `<div class="detail-section"><h4>Contact Info</h4>
      ${c.email ? `<div class="detail-row"><span>✉️</span><a href="mailto:${c.email}" style="color:var(--blue)">${c.email}</a></div>` : ''}
      ${c.phone ? `<div class="detail-row"><span>📞</span><span>${c.phone}</span></div>` : ''}
      ${c.address ? `<div class="detail-row"><span>📍</span><span>${c.address}</span></div>` : ''}
    </div>`;
  }
  if (c.company || c.jobtitle || c.website) {
    body += `<div class="detail-section"><h4>Professional</h4>
      ${c.company ? `<div class="detail-row"><span>🏢</span><span>${c.company}</span></div>` : ''}
      ${c.jobtitle ? `<div class="detail-row"><span>💼</span><span>${c.jobtitle}</span></div>` : ''}
      ${c.website ? `<div class="detail-row"><span>🌐</span><a href="${normalizeUrl(c.website)}" target="_blank" style="color:var(--blue)">${c.website}</a></div>` : ''}
    </div>`;
  }
  const hasSocial = c.facebook || c.instagram || c.linkedin || c.twitter;
  if (hasSocial) {
    body += `<div class="detail-section"><h4>Social Media</h4>
      <div class="c-socials">
        ${c.facebook ? `<a class="social-pill social-fb" href="${normalizeUrl(c.facebook)}" target="_blank">🌐 Facebook</a>` : ''}
        ${c.instagram ? `<a class="social-pill social-ig" href="${normalizeUrl(c.instagram)}" target="_blank">📸 Instagram</a>` : ''}
        ${c.linkedin ? `<a class="social-pill social-li" href="${normalizeUrl(c.linkedin)}" target="_blank">💼 LinkedIn</a>` : ''}
        ${c.twitter ? `<a class="social-pill social-tw" href="${normalizeUrl(c.twitter)}" target="_blank">🐦 Twitter</a>` : ''}
      </div></div>`;
  }
  if (c.notes) {
    body += `<div class="detail-section"><h4>Notes</h4><p style="font-size:.88rem;line-height:1.6;color:var(--text2)">${c.notes}</p></div>`;
  }
  if (c.tags) {
    body += `<div class="detail-section"><h4>Tags</h4><div style="display:flex;gap:6px;flex-wrap:wrap">${c.tags.split(',').map(t=>`<span class="c-category cat-other">${t.trim()}</span>`).join('')}</div></div>`;
  }
  body += `<button class="detail-chat-btn" onclick="closeModal('detail-overlay');startChatWith(${id})">💬 Send Message</button>`;

  document.getElementById('detail-body').innerHTML = body;
  openModal('detail-overlay');
}

function filterContacts(query) {
  const q = (query||'').toLowerCase();
  const cat = document.getElementById('cat-filter').value;
  const filtered = allContacts.filter(c => {
    const matchQ = !q || `${c.firstname} ${c.lastname} ${c.email} ${c.company} ${c.phone}`.toLowerCase().includes(q);
    const matchCat = !cat || c.category === cat;
    return matchQ && matchCat;
  });
  renderContacts(filtered);
}

function globalSearch(q) {
  if (!q) return;
  navigateTo('contacts');
  document.getElementById('contact-search').value = q;
  filterContacts(q);
}

function setView(v) {
  currentView = v;
  document.getElementById('view-grid').classList.toggle('active', v === 'grid');
  document.getElementById('view-list').classList.toggle('active', v === 'list');
  renderContacts(allContacts);
}

function pickColor(color, el) {
  selectedColor = color;
  document.querySelectorAll('.col-opt').forEach(e => e.classList.remove('sel'));
  el.classList.add('sel');
}

function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
  const pane = document.getElementById('tab-' + tabId);
  if (pane) { pane.classList.remove('hidden'); pane.classList.add('active'); }
  if (btn) btn.classList.add('active');
}

function updateDashboard() {
  document.getElementById('stat-contacts').textContent = allContacts.length;
  const recent = allContacts.slice(0, 5);
  const rcl = document.getElementById('recent-contacts-list');
  if (rcl) {
    rcl.innerHTML = recent.length ? recent.map(c => {
      const initials = ((c.firstname||'?')[0] + (c.lastname ? c.lastname[0] : '')).toUpperCase();
      return `<div class="mini-contact" onclick="viewContact(${c.id})">
        <div class="mini-av" style="background:${c.avatarColor||'#7c3aed'}">${initials}</div>
        <div><div class="mini-name">${c.firstname} ${c.lastname||''}</div><div class="mini-sub">${c.company||c.email||c.category||''}</div></div>
      </div>`;
    }).join('') : '<p class="empty-mini">No contacts yet.</p>';
  }
  drawCategoryChart();
}

function drawCategoryChart() {
  const canvas = document.getElementById('category-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const counts = {};
  allContacts.forEach(c => { counts[c.category||'Other'] = (counts[c.category||'Other']||0)+1; });
  const cats = Object.keys(counts);
  const vals = Object.values(counts);
  const colors = ['#7c3aed','#00d4ff','#10b981','#f59e0b','#ef4444','#ec4899'];

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!cats.length) {
    ctx.fillStyle = 'rgba(148,163,184,0.4)';
    ctx.font = '13px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet', canvas.width/2, canvas.height/2);
    return;
  }

  const total = vals.reduce((a,b)=>a+b,0);
  let angle = -Math.PI/2;
  const cx = 80, cy = canvas.height/2, r = 60, ir = 35;

  cats.forEach((cat, i) => {
    const slice = (vals[i]/total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle+slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.strokeStyle = '#050b1a';
    ctx.lineWidth = 2;
    ctx.stroke();
    angle += slice;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, ir, 0, Math.PI*2);
  ctx.fillStyle = '#080f20';
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 14px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy);

  const legend = document.getElementById('chart-legend');
  if (legend) {
    legend.innerHTML = cats.map((cat,i) =>
      `<div class="legend-item"><div class="legend-dot" style="background:${colors[i%colors.length]}"></div>${cat}: ${vals[i]}</div>`
    ).join('');
  }
}
