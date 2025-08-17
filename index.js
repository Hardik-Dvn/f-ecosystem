const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
// ## NEW: Naye packages import karo ##
const aws = require('aws-sdk');
const multerS3 = require('multer-s3');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

// --- ## NEW: Backblaze B2 Configuration ## ---
// Apni Backblaze ki details yahan daalo
const B2_ENDPOINT = 's3.us-west-004.backblazeb2.com'; // Apna endpoint daalo
const B2_KEY_ID = 'YOUR_KEY_ID'; // Apna keyID daalo
const B2_APP_KEY = 'YOUR_APPLICATION_KEY'; // Apna applicationKey daalo
const B2_BUCKET_NAME = 'f-ecosystem-hardik-storage'; // Apna bucket name daalo

const s3 = new aws.S3({
    endpoint: new aws.Endpoint(B2_ENDPOINT),
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APP_KEY
});

// Multer ko S3 ke saath configure karo
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: B2_BUCKET_NAME,
        acl: 'public-read', // Taaki file publically access ho sake
        key: function (req, file, cb) {
            cb(null, Date.now().toString() + '-' + file.originalname);
        }
    })
});
// ------------------------------------------

// Middlewares
app.use(express.json());
app.use(express.static(__dirname)); 

// Database Setup (No Change)
const db = new sqlite3.Database('./chat.db', (err) => { /* ... */ });
db.serialize(() => { /* ... */ });

// --- API Routes ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ## UPDATED: Upload route ab S3 use karega ##
app.post('/upload', upload.single('myFile'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    // req.file.location mein file ka public URL hoga
    res.json({ success: true, filePath: req.file.location });
});

// ... (baaki saare API routes same rahenge)

// --- Real-time Socket.IO Logic (No Change) ---
// ... (poora socket logic same rahega)


// --- Full code for completeness ---
db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT)');
    db.run('CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY, name TEXT UNIQUE)');
    db.run('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, projectId INTEGER, username TEXT, type TEXT, content TEXT)');
    db.run('CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, projectId INTEGER, content TEXT, completed BOOLEAN DEFAULT 0)');
});
app.post('/register', async (req, res) => { const { username, password } = req.body; if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required' }); try { const salt = await bcrypt.genSalt(10); const password_hash = await bcrypt.hash(password, salt); db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, password_hash], function (err) { if (err) return res.status(400).json({ success: false, message: 'Username already exists' }); res.status(201).json({ success: true, message: 'Registration successful!' }); }); } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); } });
app.post('/login', (req, res) => { const { username, password } = req.body; if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required' }); db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => { if (!user) return res.status(400).json({ success: false, message: 'Invalid credentials' }); const isMatch = await bcrypt.compare(password, user.password_hash); if (isMatch) res.json({ success: true, message: 'Login successful!' }); else res.status(400).json({ success: false, message: 'Invalid credentials' }); }); });
app.get('/projects', (req, res) => { db.all('SELECT * FROM projects ORDER BY name', [], (err, rows) => { if (err) return res.status(500).json({ success: false, message: 'Could not retrieve projects.' }); res.json({ success: true, projects: rows }); }); });
app.post('/projects/create', (req, res) => { const { projectName } = req.body; if (!projectName) return res.status(400).json({ success: false, message: 'Project name is required.' }); db.run('INSERT INTO projects (name) VALUES (?)', [projectName.trim()], function (err) { if (err) return res.status(400).json({ success: false, message: 'Project name already exists.' }); res.status(201).json({ success: true, project: { id: this.lastID, name: projectName } }); }); });
app.post('/api/notification/:projectId', (req, res) => { const { projectId } = req.params; const { title, text } = req.body; if (!title || !text) { return res.status(400).json({ success: false, message: 'Title and text are required.' }); } console.log(`[SERVER] Notification received for project ${projectId}: ${title}`); io.to(projectId.toString()).emit('new-notification', { title, text }); res.status(200).json({ success: true, message: 'Notification received.' }); });
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    socket.on('join project', async (projectId) => {
        socket.join(projectId.toString());
        console.log(`Socket ${socket.id} joined project room: ${projectId}`);
        db.all(`SELECT username, type, content FROM messages WHERE projectId = ? ORDER BY id ASC`, [projectId], (err, rows) => { if (err) return console.error(err.message); socket.emit('project history', rows); });
        db.all(`SELECT id, content, completed FROM todos WHERE projectId = ? ORDER BY id ASC`, [projectId], (err, rows) => { if (err) return console.error(err.message); socket.emit('todo-list', rows); });
        const agentRoom = `agent-${projectId}`;
        const socketsInAgentRoom = await io.in(agentRoom).fetchSockets();
        socket.emit('agent-status', { online: socketsInAgentRoom.length > 0 });
    });
    socket.on('agent-connect', (projectId) => {
        const agentRoom = `agent-${projectId}`;
        socket.join(agentRoom);
        console.log(`Agent ${socket.id} connected for project ${projectId}`);
        io.to(projectId.toString()).emit('agent-status', { online: true });
        socket.on('disconnect', () => {
            console.log(`Agent ${socket.id} disconnected`);
            io.to(projectId.toString()).emit('agent-status', { online: false });
        });
    });
    socket.on('device-status-update', (data) => { const { projectId, status } = data; io.to(projectId.toString()).emit('agent-status-update', status); });
    socket.on('run-command', (data) => { const { projectId, command } = data; const agentRoom = `agent-${projectId}`; io.to(agentRoom).emit('execute-command', { command }); });
    socket.on('command-output', (data) => { const { projectId, output } = data; io.to(projectId.toString()).emit('command-result', { output }); });
    socket.on('add-todo', (data) => { const { projectId, content } = data; db.run(`INSERT INTO todos (projectId, content, completed) VALUES (?, ?, ?)`, [projectId, content, 0], function(err) { if (err) return console.error("TODO DB ERROR:", err.message); const newItem = { id: this.lastID, content, completed: false }; io.to(projectId.toString()).emit('new-todo-item', newItem); }); });
    socket.on('toggle-todo', (data) => { const { projectId, id, completed } = data; db.run(`UPDATE todos SET completed = ? WHERE id = ?`, [completed, id], function(err) { if (err) return console.error("TODO DB ERROR:", err.message); io.to(projectId.toString()).emit('todo-toggled', { id, completed }); }); });
    socket.on('delete-todo', (data) => { const { projectId, id } = data; db.run(`DELETE FROM todos WHERE id = ?`, [id], function(err) { if (err) return console.error("TODO DB ERROR:", err.message); io.to(projectId.toString()).emit('todo-deleted', { id }); }); });
    socket.on('chat message', (data) => { const { projectId, username, message } = data; const messageData = { username, type: 'text', content: message }; db.run(`INSERT INTO messages (projectId, username, type, content) VALUES (?, ?, ?, ?)`, [projectId, username, 'text', message], (err) => { if (err) return console.error("DATABASE ERROR:", err.message); io.to(projectId.toString()).emit('chat message', messageData); }); });
    socket.on('file share', (data) => { const { projectId, username, filePath } = data; const fileData = { username, type: 'file', content: filePath }; db.run(`INSERT INTO messages (projectId, username, type, content) VALUES (?, ?, ?, ?)`, [projectId, username, 'file', filePath], (err) => { if (err) return console.error("DATABASE ERROR:", err.message); io.to(projectId.toString()).emit('chat message', fileData); }); });
    socket.on('disconnect', () => {
        console.log(`Socket ${socket.id} disconnected`);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
