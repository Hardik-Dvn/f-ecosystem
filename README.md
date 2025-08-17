# F-Ecosystem: A Self-Hosted, Cross-Device Command Center

F-Ecosystem is a powerful, self-hosted web server designed to create a unified and secure environment across all your devices. It provides a centralized platform for secure chat, file sharing, a real-time to-do list, and remote terminal access to a host machine (like Kali Linux), all accessible from any browser.

## ⚡ Key Features

* **Secure, Project-Based Rooms:** Create separate, isolated projects, each with its own dedicated chat, file history, and to-do list.
* **Remote Terminal:** A fully functional remote terminal that allows you to execute commands on the host machine directly from your browser. It maintains the current working directory for a seamless experience.
* **Real-time To-Do List:** A collaborative to-do list for each project that syncs across all devices.
* **Device Status Monitoring:** The connected agent reports live CPU and battery status to the web interface.
* **Notification Mirroring:** An API endpoint to receive and display notifications from external devices (e.g., an Android phone using Tasker).
* **Modern & Responsive UI:** A clean, hacker-themed interface that works beautifully on both desktop and mobile devices.

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js, Socket.IO
* **Database:** SQLite for lightweight and persistent storage.
* **Agent:** Node.js, `systeminformation` for device monitoring, `child_process` for command execution.
* **Frontend:** Vanilla JavaScript, HTML5, CSS3 (No frameworks).

## 🚀 Getting Started

### Prerequisites

* Node.js and npm installed.
* Git installed.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Hardik-Dvn/f-ecosystem
    ```

2.  **Install dependencies for the server and agent:**
    ```bash
    npm install
    ```

3.  **Run the main server:**
    ```bash
    npm start
    ```
    The server will be running at `http://localhost:3000`.

4.  **Run the agent (on the machine you want to control):**
    * Open `agent.js` and configure the `PROJECT_ID_TO_CONTROL`.
    * In a new terminal, run the agent:
    ```bash
    node agent.js
    ```
