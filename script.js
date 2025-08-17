// --- Element References ---
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const projectDashboard = document.getElementById('project-dashboard');
const copyNotification = document.getElementById('copy-notification');
const todoModalBackdrop = document.getElementById('todo-modal-backdrop');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const projectList = document.getElementById('project-list');
const newProjectForm = document.getElementById('new-project-form');
const newProjectInput = document.getElementById('new-project-input');

let currentUsername = null, currentProjectId = null, socket;

// --- Auth Logic ---
loginBtn.addEventListener('click', async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;
    try {
        const response = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const data = await response.json();
        if (data.success) {
            currentUsername = username;
            authContainer.style.display = 'none';
            projectDashboard.style.display = 'block';
            document.getElementById('dashboard-title').textContent = `[ Welcome, ${currentUsername} ]`;
            loadProjects();
        } else { errorMessage.textContent = data.message; }
    } catch (err) { errorMessage.textContent = 'Cannot connect to server.'; }
});
registerBtn.addEventListener('click', async () => {
    const username = usernameInput.value; const password = passwordInput.value;
    try {
        const response = await fetch('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const data = await response.json();
        if (data.success) { alert('Registration successful! Please login.'); errorMessage.textContent = ''; } 
        else { errorMessage.textContent = data.message; }
    } catch (err) { errorMessage.textContent = 'Cannot connect to server.'; }
});

// --- Project Dashboard Logic ---
async function loadProjects() {
    try {
        const response = await fetch('/projects');
        const data = await response.json();
        projectList.innerHTML = '';
        if (data.success && data.projects) {
            data.projects.forEach(project => {
                const li = document.createElement('li');
                li.textContent = project.name;
                li.dataset.id = project.id;
                li.addEventListener('click', () => joinProject(project.id, project.name));
                projectList.appendChild(li);
            });
        }
    } catch(err) { console.error("Could not load projects", err); }
}
newProjectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const projectName = newProjectInput.value;
    if (!projectName) return;
    try {
        const response = await fetch('/projects/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectName }) });
        const data = await response.json();
        if (data.success) {
            newProjectInput.value = '';
            loadProjects();
        } else { alert(data.message); }
    } catch(err) { alert("Could not create project."); }
});
function joinProject(projectId, projectName) {
    currentProjectId = projectId;
    projectDashboard.style.display = 'none';
    chatContainer.style.display = 'block';
    document.body.style.padding = '0';
    initializeChat(projectName);
}

// --- Chat Logic ---
function initializeChat(projectName) {
    const messages = document.getElementById('messages');
    document.querySelector('#chat-container #chat-title').textContent = `[ ${projectName} ]`;
    socket = io();
    socket.emit('join project', currentProjectId);
    const form = document.getElementById('form');
    const messageInput = document.getElementById('message-input');
    const fileInput = document.getElementById('file-input');
    const chatDropZone = document.getElementById('message-box');
    const openTodoBtn = document.getElementById('open-todo-btn');
    const todoList = document.getElementById('todo-list');
    const newTodoForm = document.getElementById('new-todo-form');
    const newTodoInput = document.getElementById('new-todo-input');
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const agentStatus = document.getElementById('agent-status');
    const terminalOutput = document.getElementById('terminal-output');
    const terminalForm = document.getElementById('terminal-form');
    const terminalInput = document.getElementById('terminal-input');
    const notificationPopup = document.getElementById('notification-popup');
    const notificationTitle = document.getElementById('notification-title');
    const notificationText = document.getElementById('notification-text');
    
    // --- Event Listeners ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
    terminalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const command = terminalInput.value;
        if (command) {
            terminalOutput.textContent += `\n>> ${command}\n`;
            socket.emit('run-command', { projectId: currentProjectId, command });
            terminalInput.value = '';
        }
    });
    openTodoBtn.addEventListener('click', () => todoModalBackdrop.style.display = 'flex');
    todoModalBackdrop.addEventListener('click', (e) => {
        if (e.target === todoModalBackdrop) todoModalBackdrop.style.display = 'none';
    });
    newTodoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (newTodoInput.value) {
            socket.emit('add-todo', { projectId: currentProjectId, content: newTodoInput.value });
            newTodoInput.value = '';
        }
    });
    
    // --- Socket Listeners ---
    socket.on('agent-status', (data) => {
        agentStatus.innerHTML = `<span>${data.online ? 'Agent Online' : 'Agent Offline'}</span>`;
        agentStatus.className = data.online ? 'online' : 'offline';
    });
    socket.on('agent-status-update', (status) => {
        agentStatus.innerHTML = `
            <span>CPU: ${status.cpu}%</span>
            <span>Battery: ${status.battery}% ${status.isCharging ? '(Charging)' : ''}</span>
        `;
    });
    socket.on('new-notification', (data) => {
        notificationTitle.textContent = data.title;
        notificationText.textContent = data.text;
        notificationPopup.classList.add('show');
        setTimeout(() => {
            notificationPopup.classList.remove('show');
        }, 5000);
    });
    socket.on('command-result', (data) => {
        terminalOutput.textContent += data.output;
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    });
    socket.on('todo-list', (todos) => {
        todoList.innerHTML = '';
        todos.forEach(todo => displayTodoItem(todo));
    });
    socket.on('new-todo-item', (todo) => displayTodoItem(todo));
    socket.on('todo-toggled', (data) => {
        const item = document.querySelector(`.todo-item[data-id="${data.id}"]`);
        if (item) {
            item.classList.toggle('completed', data.completed);
            const checkbox = item.querySelector('input[type="checkbox"]');
            if(checkbox) checkbox.checked = data.completed;
        }
    });
    socket.on('todo-deleted', (data) => {
        const item = document.querySelector(`.todo-item[data-id="${data.id}"]`);
        if (item) item.remove();
    });
    
    async function uploadFile(file) {
        if (!file) return;
        const formData = new FormData();
        formData.append('myFile', file);
        try {
            const response = await fetch('/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if (result.success) {
                socket.emit('file share', { projectId: currentProjectId, username: currentUsername, filePath: result.filePath });
            }
        } catch (err) { console.error('File upload failed', err); }
    }
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => chatDropZone.addEventListener(eventName, (e) => e.preventDefault(), false));
    ['dragenter', 'dragover'].forEach(eventName => chatDropZone.addEventListener(eventName, () => chatDropZone.style.borderColor = 'var(--accent)', false));
    ['dragleave', 'drop'].forEach(eventName => chatDropZone.addEventListener(eventName, () => chatDropZone.style.borderColor = 'var(--border)', false));
    chatDropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length > 0) uploadFile(e.dataTransfer.files[0]);
    });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (messageInput.value && currentUsername) {
            socket.emit('chat message', { projectId: currentProjectId, username: currentUsername, message: messageInput.value });
            messageInput.value = '';
        }
    });
    fileInput.addEventListener('change', (e) => { uploadFile(e.target.files[0]); e.target.value = ''; });
    socket.on('project history', (history) => {
        messages.innerHTML = '';
        history.forEach(data => displayMessage(data));
    });
    socket.on('chat message', (data) => {
        displayMessage(data);
    });
}

function displayTodoItem(todo) {
    const todoList = document.getElementById('todo-list');
    const li = document.createElement('li');
    li.classList.add('todo-item');
    li.dataset.id = todo.id;
    if (todo.completed) li.classList.add('completed');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => {
        socket.emit('toggle-todo', { projectId: currentProjectId, id: todo.id, completed: checkbox.checked });
        if (checkbox.checked) {
            setTimeout(() => {
                socket.emit('delete-todo', { projectId: currentProjectId, id: todo.id });
            }, 1000);
        }
    });
    const span = document.createElement('span');
    span.textContent = todo.content;
    li.appendChild(checkbox);
    li.appendChild(span);
    todoList.appendChild(li);
}

function showCopyNotification(message = 'Copied!') {
    copyNotification.textContent = message;
    copyNotification.classList.add('show');
    setTimeout(() => {
        copyNotification.classList.remove('show');
    }, 2000);
}

function displayMessage(data) {
    const messages = document.getElementById('messages');
    const item = document.createElement('li');
    if (data.username === currentUsername) item.classList.add('my-message');
    else item.classList.add('other-message');
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    const userSpan = document.createElement('span');
    userSpan.classList.add('username-span');
    userSpan.textContent = data.username;
    let contentElement;
    let copyValue;
    if (data.type === 'text') {
        contentElement = document.createElement('span');
        contentElement.textContent = data.content;
        copyValue = data.content;
    } else if (data.type === 'file') {
        const filePath = data.content;
        const fileName = filePath.split('-').pop();
        const isImageFile = /\.(jpg|jpeg|png|gif)$/i.test(filePath);
        copyValue = `${window.location.origin}${filePath}`;
        if (isImageFile) {
            contentElement = document.createElement('img');
            contentElement.src = filePath;
            contentElement.alt = fileName;
            contentElement.classList.add('chat-image');
        } else {
            contentElement = document.createElement('a');
            contentElement.href = filePath;
            contentElement.textContent = `Download: ${fileName}`;
            contentElement.target = '_blank';
            contentElement.download = true;
        }
    }
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'copy-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.innerHTML = `<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>`;
    icon.addEventListener('click', () => {
        navigator.clipboard.writeText(copyValue);
        showCopyNotification(isImageFile ? 'Image URL Copied!' : 'Copied!');
    });
    if (data.username !== currentUsername) bubble.appendChild(userSpan);
    bubble.appendChild(contentElement);
    bubble.appendChild(icon);
    item.appendChild(bubble);
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
}