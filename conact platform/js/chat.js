// ================================================
// chat.js — Contact messaging system
// ================================================
let activeChatContactId = null;
let allConversations = [];

async function loadChats() {
  if (!currentUser) return;
  const msgs = await dbByIndex('messages', 'userId', currentUser.id);
  // Get unique contactIds
  const contactMap = {};
  msgs.forEach(m => {
    const cid = m.contactId;
    if (!contactMap[cid] || m.ts > contactMap[cid].ts) contactMap[cid] = m;
  });
  allConversations = Object.values(contactMap).sort((a,b) => b.ts - a.ts);
  await renderConversationList(allConversations);
  updateMsgStat(msgs.length);
}

async function renderConversationList(convos) {
  const el = document.getElementById('chat-list');
  if (!el) return;
  if (!convos.length) { el.innerHTML = '<p class="empty-mini">No conversations yet.</p>'; return; }
  const items = await Promise.all(convos.map(async m => {
    const c = await dbGet('contacts', m.contactId);
    if (!c) return '';
    const initials = ((c.firstname||'?')[0]+(c.lastname?c.lastname[0]:'')).toUpperCase();
    const preview = m.text.length > 40 ? m.text.slice(0,40)+'…' : m.text;
    const time = formatTime(m.ts);
    return `<div class="chat-convo-item ${activeChatContactId===m.contactId?'active':''}" onclick="openChat(${m.contactId})">
      <div class="conv-av" style="background:${c.avatarColor||'#7c3aed'}">${initials}</div>
      <div style="flex:1;overflow:hidden">
        <div class="conv-name">${c.firstname} ${c.lastname||''}</div>
        <div class="conv-last">${m.sentByUser?'You: ':''}${preview}</div>
      </div>
      <div class="conv-time">${time}</div>
    </div>`;
  }));
  el.innerHTML = items.join('');
}

async function openChat(contactId) {
  activeChatContactId = contactId;
  const c = await dbGet('contacts', contactId);
  if (!c) return;
  closeModal('newchat-overlay');
  navigateTo('chat');

  const initials = ((c.firstname||'?')[0]+(c.lastname?c.lastname[0]:'')).toUpperCase();
  const main = document.getElementById('chat-main');
  main.innerHTML = `
    <div class="chat-head">
      <div class="conv-av" style="background:${c.avatarColor||'#7c3aed'};width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem;color:#fff">${initials}</div>
      <div class="chat-head-info">
        <div class="chat-head-name">${c.firstname} ${c.lastname||''}</div>
        <div class="chat-head-sub">${c.company||c.email||c.category||'Contact'}</div>
      </div>
      <button class="btn-sm" onclick="viewContact(${contactId})">👤 Profile</button>
    </div>
    <div class="ai-suggest-bar" id="chat-ai-bar">
      <span style="font-size:.72rem;color:var(--text3)">🤖 AI:</span>
    </div>
    <div class="chat-msgs-area" id="chat-msgs-area"></div>
    <div class="chat-input-row">
      <textarea id="chat-input" placeholder="Type a message..." rows="1" onkeydown="handleChatKey(event)" oninput="autoResize(this)"></textarea>
      <button class="chat-send-btn" onclick="sendChatMsg()">➤</button>
    </div>`;

  await renderChatMessages(contactId);
  await generateAISuggestions(c);
  await renderConversationList(allConversations);
}

async function renderChatMessages(contactId) {
  const area = document.getElementById('chat-msgs-area');
  if (!area) return;
  const msgs = await dbByIndex('messages', 'contactId', contactId);
  const mine = msgs.filter(m => m.userId === currentUser.id).sort((a,b) => a.ts - b.ts);
  if (!mine.length) { area.innerHTML = '<p class="empty-mini" style="text-align:center;padding:30px">No messages yet. Say hello! 👋</p>'; return; }
  area.innerHTML = mine.map(m => `
    <div class="chat-msg ${m.sentByUser?'sent':'recv'}">
      <div class="cm-bubble">${escHtml(m.text)}</div>
      <div class="cm-time">${formatTime(m.ts)}</div>
    </div>`).join('');
  area.scrollTop = area.scrollHeight;
}

async function sendChatMsg() {
  if (!activeChatContactId) return;
  const inp = document.getElementById('chat-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = ''; inp.style.height = '';

  await dbAdd('messages', {
    userId: currentUser.id, contactId: activeChatContactId,
    text, sentByUser: true, ts: Date.now()
  });

  await logActivity('message', `Sent message to contact #${activeChatContactId}`);
  await renderChatMessages(activeChatContactId);
  await loadChats();
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMsg(); }
}

async function generateAISuggestions(contact) {
  const bar = document.getElementById('chat-ai-bar');
  if (!bar) return;
  const suggestions = [
    `Hi ${contact.firstname}! How are you?`,
    `Following up on our last conversation.`,
    `Let's connect soon!`
  ];
  bar.innerHTML = `<span style="font-size:.72rem;color:var(--text3)">🤖 Quick:</span>` +
    suggestions.map(s => `<button onclick="useAISuggestion('${s.replace(/'/g,"\\'")}')">💬 ${s}</button>`).join('');
}

function useAISuggestion(text) {
  const inp = document.getElementById('chat-input');
  if (inp) { inp.value = text; inp.focus(); }
}

function openNewChat() {
  const list = document.getElementById('nc-list');
  list.innerHTML = allContacts.map(c => {
    const initials = ((c.firstname||'?')[0]+(c.lastname?c.lastname[0]:'')).toUpperCase();
    return `<div class="nc-item" onclick="openChat(${c.id})">
      <div class="nc-av" style="background:${c.avatarColor||'#7c3aed'}">${initials}</div>
      <div><div class="nc-name">${c.firstname} ${c.lastname||''}</div><div class="nc-sub">${c.email||c.phone||''}</div></div>
    </div>`;
  }).join('') || '<p class="empty-mini">No contacts. Add one first!</p>';
  openModal('newchat-overlay');
}

function startChatWith(contactId) {
  navigateTo('chat');
  openChat(contactId);
}

function ncSearch(q) {
  const filtered = allContacts.filter(c => `${c.firstname} ${c.lastname} ${c.email}`.toLowerCase().includes(q.toLowerCase()));
  const list = document.getElementById('nc-list');
  list.innerHTML = filtered.map(c => {
    const initials = ((c.firstname||'?')[0]+(c.lastname?c.lastname[0]:'')).toUpperCase();
    return `<div class="nc-item" onclick="openChat(${c.id})">
      <div class="nc-av" style="background:${c.avatarColor||'#7c3aed'}">${initials}</div>
      <div><div class="nc-name">${c.firstname} ${c.lastname||''}</div><div class="nc-sub">${c.email||''}</div></div>
    </div>`;
  }).join('') || '<p class="empty-mini">No results.</p>';
}

function searchChats(q) {
  const items = document.querySelectorAll('.chat-convo-item');
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(q.toLowerCase()) ? '' : 'none';
  });
}

function updateMsgStat(count) {
  const el = document.getElementById('stat-messages');
  if (el) el.textContent = count;
}
