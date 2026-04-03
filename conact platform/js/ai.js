// ================================================
// ai.js — Gemini AI Assistant (Nexus AI)
// ================================================
let geminiApiKey = '';
let aiQueryCount = 0;

function saveApiKey() {
  const key = document.getElementById('gemini-api-key').value.trim();
  const status = document.getElementById('api-status');
  if (!key) { status.textContent = '❌ Enter a key'; status.className = 'api-status err'; return; }
  geminiApiKey = key;
  localStorage.setItem('ch_gemini_key', key);
  status.textContent = '✅ Key saved!';
  status.className = 'api-status ok';
  showToast('Gemini API key saved!', 'success');
}

function loadSavedApiKey() {
  const k = localStorage.getItem('ch_gemini_key');
  if (k) {
    geminiApiKey = k;
    const inp = document.getElementById('gemini-api-key');
    const status = document.getElementById('api-status');
    if (inp) inp.value = k;
    if (status) { status.textContent = '✅ Key loaded'; status.className = 'api-status ok'; }
  }
}

async function sendAIMsg(predefined) {
  const inp = document.getElementById('ai-input');
  const prompt = predefined || (inp ? inp.value.trim() : '');
  if (!prompt) return;
  if (inp) { inp.value = ''; inp.style.height = ''; }

  appendAIMsg(prompt, 'user');

  const thinkId = appendThinking();

  aiQueryCount++;
  document.getElementById('stat-ai').textContent = aiQueryCount;
  await logActivity('ai', `AI query: ${prompt.slice(0,60)}…`);

  // Try local intent parsing first
  const localResult = await handleLocalIntent(prompt);
  removeThinking(thinkId);

  if (localResult !== null) {
    appendAIMsg(localResult, 'bot');
    return;
  }

  // If no local match and API key available — call Gemini
  if (geminiApiKey) {
    try {
      const response = await callGeminiAPI(prompt);
      appendAIMsg(response, 'bot');
    } catch (err) {
      appendAIMsg(`⚠️ Gemini error: ${err.message}. Try again or check your API key.`, 'bot');
    }
  } else {
    appendAIMsg(`I can help with that! To enable full AI capabilities, please add your Gemini API key in the panel on the left. Meanwhile, I can still perform contact management tasks using local commands. Try: "Add contact John Doe email john@test.com" or "Show all contacts".`, 'bot');
  }
}

async function callGeminiAPI(userPrompt) {
  // Build system context with contacts info
  const contacts = await dbByIndex('contacts', 'userId', currentUser.id);
  const contactSummary = contacts.slice(0,20).map(c =>
    `${c.firstname} ${c.lastname||''} (${c.category||''}, ${c.company||'no company'}, ${c.email||'no email'})`
  ).join('\n');

  const systemContext = `You are Nexus AI, an intelligent contact management assistant for ContactHub Intelligence. 
You help users manage their contacts, schedule reminders, and communicate professionally.
The user has ${contacts.length} contacts.
Recent contacts: ${contactSummary || 'none'}
Current time: ${new Date().toLocaleString()}

When the user asks to add a contact, extract: name, email, phone, company, category.
When the user asks to search, help them find relevant contacts.
Provide clear, friendly, and actionable responses. Keep responses concise.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`;
  const body = {
    contents: [{
      parts: [
        { text: systemContext },
        { text: userPrompt }
      ]
    }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 800 }
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }

  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
}

async function handleLocalIntent(prompt) {
  const p = prompt.toLowerCase();

  // ADD CONTACT
  const addMatch = p.match(/add\s+(?:contact\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/);
  if ((p.includes('add') && (p.includes('contact') || addMatch)) && !p.includes('reminder')) {
    return await aiAddContact(prompt);
  }

  // SHOW ALL CONTACTS
  if ((p.includes('show') || p.includes('list') || p.includes('all')) && p.includes('contact')) {
    return await aiShowContacts(prompt);
  }

  // SEARCH
  if (p.includes('find') || p.includes('search')) {
    return await aiSearchContacts(prompt);
  }

  // DUPLICATES
  if (p.includes('duplicate')) {
    return await aiFindDuplicates();
  }

  // GROUP BY COMPANY
  if (p.includes('group') && p.includes('company')) {
    return await aiGroupByCompany();
  }

  // REMINDERS
  if (p.includes('reminder') || (p.includes('remind') && p.includes('call'))) {
    return await aiSetReminder(prompt);
  }

  // TOP / INSIGHTS
  if (p.includes('top') || p.includes('frequently') || p.includes('insight')) {
    return await aiInsights();
  }

  // DELETE CONTACT
  if (p.includes('delete') || p.includes('remove')) {
    return await aiDeleteContact(prompt);
  }

  // GENERATE MESSAGE
  if (p.includes('write') || p.includes('generate') || p.includes('draft') || p.includes('message')) {
    return aiGenerateMessage(prompt);
  }

  // STATS
  if (p.includes('statistic') || p.includes('summary') || p.includes('how many')) {
    return await aiStats();
  }

  return null; // No local match — fall through to Gemini
}

async function aiAddContact(prompt) {
  // Extract name
  let firstname = '', lastname = '', email = '', phone = '', company = '', category = 'Personal';

  const nameMatch = prompt.match(/(?:add\s+(?:contact\s+)?|named?\s+)([A-Z][a-zA-Z]+)(?:\s+([A-Z][a-zA-Z]+))?/i);
  if (nameMatch) { firstname = nameMatch[1]; if (nameMatch[2]) lastname = nameMatch[2]; }

  const emailMatch = prompt.match(/(?:email\s+|email:\s*)([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) email = emailMatch[1];

  const phoneMatch = prompt.match(/(?:phone\s+|tel\s+|number\s+|phone:\s*)([\d\s\-\+\(\)]{7,})/i);
  if (phoneMatch) phone = phoneMatch[1].trim();

  const compMatch = prompt.match(/(?:company\s+|at\s+|from\s+)([\w\s]+?)(?:,|\.|$)/i);
  if (compMatch) company = compMatch[1].trim();

  const catMatch = prompt.match(/(?:category\s+|as\s+a?\s*)(work|personal|family|friend|business|other)/i);
  if (catMatch) category = catMatch[1][0].toUpperCase() + catMatch[1].slice(1);

  if (!firstname) {
    return `I'd love to add a contact! Please provide more details. Example:\n"Add John Doe, email john@example.com, phone 555-1234, company Acme Corp"`;
  }

  await dbAdd('contacts', {
    userId: currentUser.id, firstname, lastname, email, phone, company,
    category, avatarColor: '#7c3aed', createdAt: Date.now(), updatedAt: Date.now()
  });

  await loadContacts();
  await logActivity('add', `AI added contact: ${firstname} ${lastname}`);

  return `✅ Contact added successfully!\n\n👤 **${firstname} ${lastname}**\n${email ? '✉️ ' + email + '\n' : ''}${phone ? '📞 ' + phone + '\n' : ''}${company ? '🏢 ' + company + '\n' : ''}📌 Category: ${category}`;
}

async function aiShowContacts(prompt) {
  const contacts = await dbByIndex('contacts', 'userId', currentUser.id);
  if (!contacts.length) return 'You have no contacts yet. Try adding one!\n\nExample: "Add John Doe, email john@example.com"';

  const p = prompt.toLowerCase();
  let filtered = contacts;
  const cats = ['work','personal','family','friend','business','other'];
  for (const cat of cats) {
    if (p.includes(cat)) {
      filtered = contacts.filter(c => c.category?.toLowerCase() === cat);
      break;
    }
  }

  if (!filtered.length) return `No contacts found for that filter.`;

  const list = filtered.slice(0,15).map((c,i) =>
    `${i+1}. **${c.firstname} ${c.lastname||''}** — ${c.category||'?'} ${c.company?'at '+c.company:''} ${c.email?'| '+c.email:''}`
  ).join('\n');

  return `📋 Found **${filtered.length}** contact${filtered.length!==1?'s':''}:\n\n${list}${filtered.length>15?'\n\n…and '+(filtered.length-15)+' more.':''}`;
}

async function aiSearchContacts(prompt) {
  const contacts = await dbByIndex('contacts', 'userId', currentUser.id);
  const words = prompt.replace(/find|search|look for|contacts?/gi,'').trim().split(/\s+/).filter(w=>w.length>1);
  if (!words.length) return 'What would you like to search for? E.g., "Find contacts from Google"';

  const results = contacts.filter(c => {
    const text = `${c.firstname} ${c.lastname} ${c.email} ${c.company} ${c.category} ${c.notes}`.toLowerCase();
    return words.some(w => text.includes(w.toLowerCase()));
  });

  if (!results.length) return `🔍 No contacts found matching: "${words.join(' ')}"`;
  return `🔍 Found **${results.length}** result${results.length!==1?'s':''}:\n\n` +
    results.slice(0,10).map((c,i) =>
      `${i+1}. **${c.firstname} ${c.lastname||''}** (${c.category||''}) — ${c.email||c.phone||c.company||'no details'}`
    ).join('\n');
}

async function aiFindDuplicates() {
  const contacts = await dbByIndex('contacts', 'userId', currentUser.id);
  const emailMap = {}, nameMap = {};

  contacts.forEach(c => {
    if (c.email) {
      const k = c.email.toLowerCase();
      if (!emailMap[k]) emailMap[k] = [];
      emailMap[k].push(c);
    }
    const name = `${c.firstname} ${c.lastname||''}`.toLowerCase().trim();
    if (!nameMap[name]) nameMap[name] = [];
    nameMap[name].push(c);
  });

  const dupsByEmail = Object.values(emailMap).filter(g => g.length > 1);
  const dupsByName  = Object.values(nameMap).filter(g => g.length > 1);

  if (!dupsByEmail.length && !dupsByName.length) {
    return '✅ Great news! No duplicate contacts found. Your contact list is clean!';
  }

  let result = '🔄 **Potential Duplicates Found:**\n\n';
  dupsByEmail.forEach(group => {
    result += `📧 Same email: ${group[0].email}\n`;
    group.forEach(c => result += `  • ${c.firstname} ${c.lastname||''}\n`);
  });
  dupsByName.forEach(group => {
    if (!dupsByEmail.some(g => g.some(c => group.includes(c)))) {
      result += `👤 Same name: ${group[0].firstname} ${group[0].lastname||''}\n`;
    }
  });
  return result;
}

async function aiGroupByCompany() {
  const contacts = await dbByIndex('contacts', 'userId', currentUser.id);
  const groups = {};
  contacts.forEach(c => {
    const k = c.company || 'No Company';
    if (!groups[k]) groups[k] = [];
    groups[k].push(c);
  });

  const sorted = Object.entries(groups).sort((a,b) => b[1].length - a[1].length);
  let result = `📊 **Contacts Grouped by Company** (${Object.keys(groups).length} companies):\n\n`;
  sorted.forEach(([company, members]) => {
    result += `🏢 **${company}** (${members.length})\n`;
    members.slice(0,4).forEach(c => result += `  • ${c.firstname} ${c.lastname||''}\n`);
    if (members.length > 4) result += `  …and ${members.length-4} more\n`;
    result += '\n';
  });
  return result.trim();
}

async function aiSetReminder(prompt) {
  const title = prompt.replace(/set\s+(?:a\s+)?reminder\s+(?:to|for|about)?/i,'').trim() || 'Follow-up reminder';

  await dbAdd('reminders', {
    userId: currentUser.id, title, desc: `Created by AI: "${prompt}"`,
    date: '', time: '', contactId: null, done: false, createdAt: Date.now()
  });

  await loadReminders();
  return `⏰ Reminder set: **"${title}"**\n\nGo to the Reminders page to add a specific date and time!`;
}

async function aiInsights() {
  const contacts = await dbByIndex('contacts', 'userId', currentUser.id);
  const messages = await dbByIndex('messages', 'userId', currentUser.id);
  const msgCounts = {};
  messages.forEach(m => { msgCounts[m.contactId] = (msgCounts[m.contactId]||0)+1; });
  const top = Object.entries(msgCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const catMap = {};
  contacts.forEach(c => { catMap[c.category||'Other'] = (catMap[c.category||'Other']||0)+1; });

  let result = `📈 **Your ContactHub Insights:**\n\n`;
  result += `👥 Total contacts: **${contacts.length}**\n`;
  result += `💬 Total messages sent: **${messages.length}**\n\n`;
  result += `**Categories:**\n${Object.entries(catMap).map(([k,v])=>`  • ${k}: ${v}`).join('\n')}\n\n`;

  if (top.length) {
    result += `**Most messaged contacts:**\n`;
    for (const [cid, cnt] of top) {
      const c = await dbGet('contacts', Number(cid));
      if (c) result += `  • ${c.firstname} ${c.lastname||''}: ${cnt} message${cnt!==1?'s':''}\n`;
    }
  } else {
    result += `Start messaging your contacts to see activity insights!`;
  }
  return result;
}

async function aiDeleteContact(prompt) {
  const words = prompt.replace(/delete|remove|contact/gi,'').trim().split(/\s+/);
  const contacts = await dbByIndex('contacts', 'userId', currentUser.id);
  const found = contacts.filter(c =>
    words.some(w => `${c.firstname} ${c.lastname}`.toLowerCase().includes(w.toLowerCase()))
  );
  if (!found.length) return `I couldn't find a contact matching that name. Please check the Contacts page to delete manually.`;
  if (found.length > 1) return `I found ${found.length} contacts matching that name:\n${found.map(c=>`• ${c.firstname} ${c.lastname||''}`).join('\n')}\n\nPlease be more specific or use the Contacts page to delete.`;

  const c = found[0];
  return `To delete **${c.firstname} ${c.lastname||''}**, please go to the Contacts page and click the 🗑️ button on their card, for safety I won't delete automatically.`;
}

function aiGenerateMessage(prompt) {
  const templates = [
    `Hi [Name],\n\nI hope you're doing well! I wanted to reach out to follow up on our last conversation. Let me know if you have any updates or if there's anything I can help with.\n\nBest regards`,
    `Dear [Name],\n\nThank you for connecting with me! I'd love to schedule a call to discuss potential collaboration. Are you available this week?\n\nLooking forward to hearing from you!`,
    `Hi [Name],\n\nJust checking in to see how things are going on your end. It's been a while since we last spoke, and I wanted to reconnect.\n\nHope all is well!`
  ];
  const msg = templates[Math.floor(Math.random() * templates.length)];
  return `💌 **Generated Message Template:**\n\n${msg}\n\n*Tip: Copy this to the Chat section and personalize it for your contact!*`;
}

async function aiStats() {
  const contacts = await dbByIndex('contacts', 'userId', currentUser.id);
  const messages = await dbByIndex('messages', 'userId', currentUser.id);
  const reminders = await dbByIndex('reminders', 'userId', currentUser.id);
  return `📊 **Your ContactHub Summary:**\n\n👥 Contacts: **${contacts.length}**\n💬 Messages: **${messages.length}**\n⏰ Reminders: **${reminders.length}** (${reminders.filter(r=>!r.done).length} active)\n🤖 AI Queries: **${aiQueryCount}**`;
}

function appendAIMsg(text, role) {
  const msgs = document.getElementById('ai-messages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  const formatted = text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br/>');
  div.innerHTML = `
    ${role==='bot'?'<div class="ai-av">🤖</div>':''}
    <div class="ai-bubble">${formatted}<span class="msg-time">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div>
    ${role==='user'?'<div class="ai-av" style="background:linear-gradient(135deg,#7c3aed,#a855f7)">👤</div>':''}`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function appendThinking() {
  const msgs = document.getElementById('ai-messages');
  if (!msgs) return null;
  const id = 'think_' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'ai-msg bot';
  div.innerHTML = `<div class="ai-av">🤖</div><div class="ai-bubble"><div class="ai-thinking"><span></span><span></span><span></span></div></div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return id;
}

function removeThinking(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

function handleAIKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMsg(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
