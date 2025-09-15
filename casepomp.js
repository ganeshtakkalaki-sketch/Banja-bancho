/* Dai-ichi Buddy — Frontend prototype
    - Drop-in static front-end. Replace mockFetch() with real HRIS/GPT endpoints.
    - Deploy on Vercel as a static site (index.html, style.css, script.js)
*/

/* ---------- Mock HRIS data / small local DB ---------- */
const MOCK = {
    employee: {
        name: "A. Sharma",
        id: "SUD12345",
        role: "Sales Officer",
        manager: "R. Patel"
    },
    leaveBalances: {
        sick: 10,
        annual: 6,
        privilege: 3,
        expiringSoon: [{type: "Annual", inDays: 40}]
    },
    payslips: [
        {month: "Aug 2025", net: "₹54,200", gross: "₹78,000"},
        {month: "Jul 2025", net: "₹54,000", gross: "₹77,500"}
    ],
    leaves: [
        {id: 1, type: "Sick Leave", dateFrom: "2025-07-25", status: "Approved"},
        {id: 2, type: "Casual Leave", dateFrom: "2025-08-12", status: "Pending"}
    ],
    tickets: []
};

/* ---------- Small helpers ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const messagesEl = $('#messages');
const inputEl = $('#textInput');
const sendBtn = $('#sendBtn');
const micBtn = $('#micBtn');
const modal = $('#modal');
const modalContent = $('#modalContent');
const modalClose = $('#modalClose');

let recognition, isListening = false;

/* ---------- Init UI + restore state ---------- */
window.addEventListener('DOMContentLoaded', init);

function init(){
    // load persisted messages if any
    const stored = JSON.parse(localStorage.getItem('dai_messages') || 'null');
    if(stored && Array.isArray(stored) && stored.length > 0){ // Check if stored has content
        stored.forEach(m => createMessage(m.from, m.text, {timestamp: m.ts, persist: false})); // Don't re-persist on load
    } else {
        // welcome
        botReply("Hello! I'm Dai-ichi Buddy — your HR co-pilot. How can I help today? You can try: 'apply leave', 'leave balance', 'payslip', or 'raise ticket'.");
    }

    // pills
    $$('.pill').forEach(btn => btn.addEventListener('click', onPill));

    // input handlers
    sendBtn.addEventListener('click', onSend);
    inputEl.addEventListener('keydown', e => { if(e.key === 'Enter') onSend(); });
    micBtn.addEventListener('click', toggleMic);
    modalClose.addEventListener('click', closeModal);

    // init speech recognition if available
    if(window.SpeechRecognition || window.webkitSpeechRecognition){
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SR();
        recognition.lang = 'en-IN'; // optional: set local accent
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (e) => {
            const text = e.results[0][0].transcript;
            inputEl.value = text;
            onSend(); // Automatically send after speech is recognized
            stopListening();
        };
        recognition.onend = () => { stopListening(); };
        recognition.onerror = (e) => {
            console.error('Speech recognition error:', e.error);
            stopListening();
            // You could add a visual cue for error if needed
        };
    } else {
        // Hide mic button if not supported
        micBtn.style.display = 'none';
    }
}

/* ---------- UI message creation + persistence ---------- */
function createMessage(from, text, opts = {}){
    const tpl = document.getElementById('message-template');
    const node = tpl.content.cloneNode(true);
    const row = node.querySelector('.msg-row');
    const avatar = node.querySelector('.msg-avatar');
    const bubble = node.querySelector('.msg-bubble');

    row.classList.add(from === 'user' ? 'user' : 'bot');
    avatar.textContent = from === 'user' ? (MOCK.employee.name.split(' ').pop()[0] || 'U') : 'DB';
    bubble.innerHTML = text;

    messagesEl.appendChild(node);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // persist (only if not a loaded message)
    if (opts.persist !== false) {
        persistMessage(from, text);
    }
}

function persistMessage(from, text){
    const arr = JSON.parse(localStorage.getItem('dai_messages') || '[]');
    arr.push({from, text, ts: Date.now()});
    localStorage.setItem('dai_messages', JSON.stringify(arr));
}

/* ---------- Basic bot engine (rule-based mock). Replace with GPT or HRIS calls ---------- */
async function onSend(){
    const text = inputEl.value.trim();
    if(!text) return;
    createMessage('user', escapeHtml(text));
    inputEl.value = '';
    
    // Simulate typing delay
    messagesEl.scrollTop = messagesEl.scrollHeight; // Scroll to show user message immediately
    await new Promise(resolve => setTimeout(resolve, 700)); // Simulate bot "thinking"

    // handle common commands
    const normalized = text.toLowerCase();

    // quick intents
    if(normalized.includes('leave balance') || normalized === 'leave' || normalized.includes('leave balance')){
        return respondLeaveBalance();
    }
    if(normalized.includes('apply leave') || normalized.includes('raise leave') || normalized.includes('raise leave request')){
        return openApplyLeaveModal();
    }
    if(normalized.includes('view leave status') || normalized.includes('leave status')){
        return respondLeaveStatus();
    }
    if(normalized.includes('payslip') || normalized.includes('pay slip') || normalized.includes('payroll')){
        return showPayslipModal();
    }
    if(normalized.includes('raise ticket') || normalized.includes('ticket') || normalized.includes('raise a ticket')){
        return openRaiseTicketModal();
    }
    // fallback smalltalk + simulated AI hint
    if(normalized.includes('help') || normalized.includes('hi') || normalized.includes('hello')){
        return botReply("You can ask me about leave, payslips, policies, or raise a ticket. Try 'leave balance' or 'apply leave'.");
    }

    // If you have a real GPT backend, call it here and return its response. Example:
    // const aiText = await callGptApi(text);
    // return botReply(aiText);

    // fallback canned response
    botReply("Thanks — I can help with HR tasks (leave, payslips, tickets). If you meant something specific, try one of those commands.");
}

/* ---------- Pill handler ---------- */
function onPill(e){
    const action = e.currentTarget.dataset.action;
    createMessage('user', e.currentTarget.textContent); // Display pill text as user message

    // Simulate typing delay
    messagesEl.scrollTop = messagesEl.scrollHeight;
    setTimeout(async () => {
        if(action === 'leave') {
            // show menu of leave options in-bot
            botReply(cardHtml('Leave options', `
                <div class="card-content">
                    <button class="btn-ghost" onclick="openApplyLeaveModal()">Apply Leave</button>
                    <button class="btn-ghost" onclick="respondLeaveBalance()">Leave Balance</button>
                    <button class="btn-ghost" onclick="respondLeaveStatus()">View Leave Status</button>
                </div>
            `));
        } else if(action === 'payroll') {
            showPayslipModal();
        } else if(action === 'raise-ticket') {
            openRaiseTicketModal();
        } else if (action === 'employee-card') {
            botReply(`Here's your employee card details:<br>
                      <strong>Name:</strong> ${MOCK.employee.name}<br>
                      <strong>ID:</strong> ${MOCK.employee.id}<br>
                      <strong>Role:</strong> ${MOCK.employee.role}<br>
                      <strong>Manager:</strong> ${MOCK.employee.manager}`);
        }
        else {
            botReply(`Opening ${action.replace('-', ' ')}. (This is a prototype; replace with real integration.)`);
        }
    }, 700); // Simulate bot typing delay
}

/* ---------- Bot helper responses ---------- */
function botReply(htmlText){
    createMessage('bot', htmlText);
    speakText(stripHtml(htmlText));
}

// Helper to wrap content in a consistent card-like structure within bot bubbles
function cardHtml(title, content) {
    return `
        <strong>${title}</strong>
        <div class="form-like-content" style="margin-top:8px;">
            ${content}
        </div>
    `;
}

/* Leave balance card */
function respondLeaveBalance(){
    const LB = MOCK.leaveBalances;
    const msg = `
        <strong>Leave Balance</strong>
        <div class="small" style="margin-top:8px">
            Sick Leave: ${LB.sick}<br/>
            Annual Leave: ${LB.annual}<br/>
            Privilege Leave: ${LB.privilege}
        </div>
        <div style="margin-top:10px" class="small">
            ${LB.expiringSoon.length ? 'Heads up: some leaves are expiring soon.' : ''}
        </div>
        <div class="card-content" style="margin-top:15px;">
            <button class="btn-primary" onclick="openApplyLeaveModal()">Raise Leave Request</button>
            <button class="btn-ghost" onclick="respondLeaveStatus()">View Leave Status</button>
        </div>
    `;
    botReply(msg);
}

/* Leave status */
function respondLeaveStatus(){
    const html = MOCK.leaves.map(l => `<div style="padding:8px 0"><strong>${l.type}</strong> — ${l.dateFrom} — <em>${l.status}</em></div>`).join('');
    botReply(cardHtml('Your leave requests', `<div class="small">${html || 'No leaves found.'}</div>`));
}

/* Apply Leave modal */
function openApplyLeaveModal(){
    modalContent.innerHTML = `
        <h3>Apply for Leave</h3>
        <div class="form-row">
            <label class="small">Leave Type</label>
            <select id="leaveType">
                <option value="Annual Leave">Annual Leave</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Casual Leave">Casual Leave</option>
            </select>
        </div>
        <div class="form-row">
            <label class="small">From</label>
            <input id="leaveFrom" type="date" />
        </div>
        <div class="form-row">
            <label class="small">To</label>
            <input id="leaveTo" type="date" />
        </div>
        <div class="form-row">
            <label class="small">Reason (optional)</label>
            <textarea id="leaveReason" rows="3" placeholder="Short note..."></textarea>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitLeave()">Submit</button>
        </div>
    `;
    openModal();
}

/* Submit leave (mock) */
function submitLeave(){
    const type = $('#leaveType').value;
    const from = $('#leaveFrom').value;
    const to = $('#leaveTo').value;
    const reason = $('#leaveReason').value;
    if(!from || !to) {
        alert('Please select both "From" and "To" dates.');
        return;
    }

    // Add to mock DB & close
    const id = Date.now();
    MOCK.leaves.push({id, type, dateFrom: from, status: 'Pending', reason: reason});
    closeModal();
    botReply(`Your <strong>${type}</strong> request from ${from} to ${to} has been submitted and is <em>Pending</em>.`);
}

/* Raise ticket modal */
function openRaiseTicketModal(){
    modalContent.innerHTML = `
        <h3>Raise Ticket</h3>
        <div class="form-row">
            <label class="small">Describe your issue</label>
            <textarea id="ticketDesc" rows="4" placeholder="e.g., Bank account update..."></textarea>
        </div>
        <div class="form-row">
            <label class="small">Attach file (optional)</label>
            <input id="ticketFile" type="file" />
            <div id="attachedFile" class="small" style="margin-top:5px;"></div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitTicket()">Submit</button>
        </div>
    `;
    // file preview hook
    setTimeout(()=>{
        const fileEl = document.getElementById('ticketFile');
        const attached = document.getElementById('attachedFile');
        if (fileEl && attached) {
            fileEl.addEventListener('change', () => {
                const f = fileEl.files[0];
                attached.textContent = f ? `Attached: ${f.name}` : '';
            });
        }
    },50);
    openModal();
}

function submitTicket(){
    const desc = $('#ticketDesc').value.trim();
    const fileEl = $('#ticketFile');
    if(!desc){
        alert('Please describe the issue.');
        return;
    }
    const ticket = {id: Date.now(), desc, status: 'Open', created: new Date().toLocaleString(), fileName: fileEl.files[0]?.name || ''};
    MOCK.tickets.push(ticket);
    closeModal();
    botReply(`Ticket created ✓ (ID: ${ticket.id}). Our HR team will follow up.${ticket.fileName ? '<br>File attached: ' + ticket.fileName : ''}`);
}

/* Payslip modal (sample download) */
function showPayslipModal(){
    modalContent.innerHTML = `
        <h3>Payslips</h3>
        <div id="payslipList" class="small" style="margin-bottom:12px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn-ghost" onclick="closeModal()">Close</button>
        </div>
    `;
    const list = MOCK.payslips.map((p,i)=>`
        <div style="padding:10px;border-radius:8px;background:#fbfdff;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;border:1px solid #E0E0E0;">
            <div>
                <strong>${p.month}</strong><div class="small">${p.gross} gross • ${p.net} net</div>
            </div>
            <div>
                <button class="btn-primary" onclick='downloadPayslip(${i})'>Download</button>
            </div>
        </div>
    `).join('');
    $('#payslipList').innerHTML = list;
    openModal();
}

function downloadPayslip(index){
    const p = MOCK.payslips[index];
    const txt = `Payslip - ${p.month}\nEmployee: ${MOCK.employee.name}\nGross: ${p.gross}\nNet: ${p.net}\n\nThis is a mock payslip. Integrate with your payroll system to generate real PDFs.`;
    const blob = new Blob([txt], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payslip-${p.month.replace(' ','-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    alert(`Downloading mock payslip for ${p.month}...`);
}

/* ---------- Modal helpers ---------- */
function openModal(){ modal.classList.remove('hidden'); }
function closeModal(){ modal.classList.add('hidden'); modalContent.innerHTML = ''; }

/* ---------- Voice helpers ---------- */
function toggleMic(){
    if(!recognition) { alert('Speech recognition not supported in this browser.'); return; }
    if(isListening) {
        stopListening();
    } else {
        startListening();
    }
}
function startListening(){
    try {
        recognition.start();
        isListening = true;
        micBtn.classList.add('listening'); // Add class for visual feedback
        micBtn.innerHTML = '<i class="fas fa-microphone-alt"></i>'; // Change icon
    } catch(e){
        console.warn('Recognition start error:', e);
        // Sometimes trying to start while already listening throws an error, so ensure state is correct
        stopListening();
    }
}
function stopListening(){
    try { recognition.stop(); } catch(e){ console.warn('Recognition stop error:', e); }
    isListening = false;
    micBtn.classList.remove('listening'); // Remove class
    micBtn.innerHTML = '<i class="fas fa-microphone"></i>'; // Reset icon
}


/* ---------- Speech synthesis (bot speaks) ---------- */
function speakText(txt){
    if(!('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(txt);
    utter.lang = 'en-IN';
    utter.rate = 1;
    window.speechSynthesis.cancel(); // Stop any ongoing speech
    // speak only short replies to avoid noisy UX
    if(txt && txt.length < 400) window.speechSynthesis.speak(utter);
}

/* ---------- Utility functions ---------- */
function escapeHtml(s){ return s.replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n','<br/>'); }
function stripHtml(s){ return s.replace(/<[^>]*>?/gm, ''); } // More robust HTML stripping

/* ---------- Hooks to global scope for inline onclick in created HTML ---------- */
// These are necessary because dynamically added HTML with onclick attributes
// needs these functions to be globally accessible.
window.openApplyLeaveModal = openApplyLeaveModal;
window.respondLeaveBalance = respondLeaveBalance;
window.respondLeaveStatus = respondLeaveStatus;
window.openRaiseTicketModal = openRaiseTicketModal;
window.showPayslipModal = showPayslipModal;
window.downloadPayslip = downloadPayslip;
window.submitLeave = submitLeave; // Added for modal submit button
window.submitTicket = submitTicket; // Added for modal submit button
window.closeModal = closeModal; // Ensure closeModal is also globally accessible