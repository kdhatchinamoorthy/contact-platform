// ================================================
// reminders.js — Reminders & follow-ups
// ================================================
async function loadReminders() {
  if (!currentUser) return;
  const reminders = await dbByIndex('reminders', 'userId', currentUser.id);
  reminders.sort((a,b) => new Date(a.date+' '+a.time) - new Date(b.date+' '+b.time));
  renderReminders(reminders);
  document.getElementById('stat-reminders').textContent = reminders.filter(r => !r.done).length;

  const upcoming = reminders.filter(r => !r.done && new Date(r.date) <= new Date(Date.now() + 86400000*2));
  const dot = document.getElementById('notif-dot');
  if (dot) dot.classList.toggle('hidden', !upcoming.length);
}

async function renderReminders(reminders) {
  const grid = document.getElementById('reminders-grid');
  if (!grid) return;
  if (!reminders.length) {
    grid.innerHTML = `<div class="contacts-empty" style="grid-column:1/-1"><div class="empty-icon">⏰</div><h3>No reminders</h3><p>Set reminders to never miss a follow-up!</p><button class="btn-primary" onclick="openAddReminder()">➕ New Reminder</button></div>`;
    return;
  }

  const items = await Promise.all(reminders.map(async r => {
    let contactName = '';
    if (r.contactId) {
      const c = await dbGet('contacts', r.contactId);
      if (c) contactName = `For: ${c.firstname} ${c.lastname||''}`;
    }
    const now = new Date();
    const dueDate = r.date ? new Date(r.date + 'T' + (r.time||'00:00')) : null;
    const isOverdue = dueDate && dueDate < now && !r.done;
    const timeStr = dueDate ? dueDate.toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) + (r.time ? ' at '+r.time : '') : 'No date';

    return `<div class="rem-card ${r.done?'done':''}">
      <div class="rem-card-head">
        <div>
          <div class="rem-title">${escHtml(r.title)}</div>
          ${contactName ? `<div class="rem-contact">${contactName}</div>` : ''}
        </div>
        <span style="font-size:20px">${r.done?'✅':'⏰'}</span>
      </div>
      ${r.desc ? `<div class="rem-desc">${escHtml(r.desc)}</div>` : ''}
      <div class="rem-time ${isOverdue?'overdue':''}">📅 ${timeStr} ${isOverdue?'(Overdue!)':''}</div>
      <div class="rem-actions">
        ${!r.done ? `<button class="btn-sm" onclick="markReminderDone(${r.id})">✅ Mark Done</button>` : ''}
        <button class="btn-sm" onclick="deleteReminder(${r.id})" style="color:var(--red)">🗑️ Delete</button>
      </div>
    </div>`;
  }));
  grid.innerHTML = items.join('');
}

function openAddReminder() {
  document.getElementById('r-title').value = '';
  document.getElementById('r-desc').value = '';
  document.getElementById('r-date').value = '';
  document.getElementById('r-time').value = '';

  const sel = document.getElementById('r-contact');
  sel.innerHTML = '<option value="">-- General reminder --</option>' +
    allContacts.map(c => `<option value="${c.id}">${c.firstname} ${c.lastname||''}</option>`).join('');

  openModal('reminder-overlay');
}

async function saveReminder() {
  const title = document.getElementById('r-title').value.trim();
  if (!title) { showToast('Please enter a reminder title!', 'error'); return; }

  await dbAdd('reminders', {
    userId: currentUser.id,
    title,
    desc: document.getElementById('r-desc').value.trim(),
    contactId: document.getElementById('r-contact').value ? Number(document.getElementById('r-contact').value) : null,
    date: document.getElementById('r-date').value,
    time: document.getElementById('r-time').value,
    done: false,
    createdAt: Date.now()
  });

  await logActivity('reminder', `Set reminder: ${title}`);
  showToast('Reminder set!', 'success');
  closeModal('reminder-overlay');
  await loadReminders();
}

async function markReminderDone(id) {
  const r = await dbGet('reminders', id);
  r.done = true;
  await dbPut('reminders', r);
  showToast('Reminder marked as done!', 'success');
  await loadReminders();
}

async function deleteReminder(id) {
  await dbDelete('reminders', id);
  showToast('Reminder deleted', 'info');
  await loadReminders();
}
