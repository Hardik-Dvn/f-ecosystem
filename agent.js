const { io } = require("socket.io-client");
const { exec } = require("child_process");
const fs = require('fs');
const path = require('path');
const si = require('systeminformation');

// --- CONFIGURATION ---
const PROJECT_ID_TO_CONTROL = 1; 
const SERVER_URL = "http://localhost:3000";
// --------------------

const baseWorkspaceDir = path.join(__dirname, 'terminal_workspace');
const projectWorkspaceDir = path.join(baseWorkspaceDir, PROJECT_ID_TO_CONTROL.toString());
let currentWorkingDirectory = projectWorkspaceDir;

try {
    if (!fs.existsSync(baseWorkspaceDir)) fs.mkdirSync(baseWorkspaceDir);
    if (!fs.existsSync(projectWorkspaceDir)) fs.mkdirSync(projectWorkspaceDir);
} catch (err) {
    console.error("[AGENT] FATAL: Could not create workspace directories.", err);
    process.exit(1);
}

console.log("[AGENT] Starting...");
const socket = io(SERVER_URL);

async function sendDeviceStatus() {
    try {
        const cpu = await si.currentLoad();
        const battery = await si.battery();
        const status = {
            cpu: cpu.currentLoad.toFixed(2),
            battery: battery.percent,
            isCharging: battery.isCharging
        };
        socket.emit('device-status-update', { projectId: PROJECT_ID_TO_CONTROL, status });
    } catch (e) {
        console.error('[AGENT] Error fetching system info:', e);
    }
}

socket.on("connect", () => {
    console.log(`[AGENT] SUCCESS! Connected to server with ID: ${socket.id}`);
    socket.emit('agent-connect', PROJECT_ID_TO_CONTROL);
    console.log(`[AGENT] Registered for project ID: ${PROJECT_ID_TO_CONTROL}`);
    
    sendDeviceStatus();
    setInterval(sendDeviceStatus, 10000);
});

socket.on('execute-command', (data) => {
    const { command } = data;
    console.log(`[AGENT] Received command: "${command}"`);
    if (command.trim().startsWith('cd ')) {
        try {
            const newDir = command.trim().substring(3);
            const targetDir = path.resolve(currentWorkingDirectory, newDir);
            if (!targetDir.startsWith(projectWorkspaceDir)) { throw new Error("Access denied: Cannot navigate outside of the project workspace."); }
            if (fs.existsSync(targetDir) && fs.lstatSync(targetDir).isDirectory()) {
                currentWorkingDirectory = targetDir;
                const output = `Changed directory to ${currentWorkingDirectory}`;
                socket.emit('command-output', { projectId: PROJECT_ID_TO_CONTROL, output: output + '\n' });
                console.log(`[AGENT] ${output}`);
            } else { throw new Error(`Directory not found: ${targetDir}`); }
        } catch (error) {
            const output = `Error: ${error.message}`;
            socket.emit('command-output', { projectId: PROJECT_ID_TO_CONTROL, output: output + '\n' });
            console.error(`--> CD Error: ${error.message}`);
        }
        return;
    }
    exec(command, { cwd: currentWorkingDirectory }, (error, stdout, stderr) => {
        let output = error ? `Error: ${error.message}\n` : (stderr || stdout);
        socket.emit('command-output', { projectId: PROJECT_ID_TO_CONTROL, output: output });
        console.log(`[AGENT] Sent output back to server.`);
    });
});

socket.on("disconnect", () => console.log("[AGENT] Disconnected from server."));
socket.on("connect_error", (err) => {
    console.error(`[AGENT] FAILED TO CONNECT: ${err.message}`);
    console.error("[AGENT] Is the main server (npm start) running?");
});