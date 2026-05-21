# 📝 Collaborative Document Editor (Google Docs Clone)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.0-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-LTS-green.svg)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-orange.svg)](https://socket.io/)
[![Yjs](https://img.shields.io/badge/Yjs-CRDT-red.svg)](https://yjs.dev/)

A powerful, real-time collaborative document editing platform that allows multiple users to write together seamlessly. Inspired by Google Docs, this project leverages **CRDTs (Conflict-free Replicated Data Types)** to ensure high-performance, lag-free teamwork with automatic conflict resolution.

---

## ⚡ Key Features

- 🤝 **Real-time Collaboration**: Multi-user editing with live cursor updates and instant synchronization powered by **Socket.io** and **Yjs**.
- ✍️ **Rich Text Editing**: Full-featured editor supporting formatting, lists, links, and more (using **ReactQuill** and **Tiptap**).
- 🔐 **Secure Authentication**: 
  - Email/Password login with **JWT** & **bcrypt**.
  - One-click **Google OAuth** integration.
  - One-click **GitHub OAuth** integration.
- 📂 **Document Management**:
  - Personal dashboard to manage all your documents.
  - Create, rename, and delete functionality.
  - Persistent storage with **MongoDB**.
- 👥 **Advanced Sharing**: Invite collaborators via email with role-based internal logic.
- ⏳ **Version History**: Track every change made to your document and restore previous versions with a single click.
- 🎨 **Modern & Responsive UI**: Sleek, premium design built with **Tailwind CSS**.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 (Vite)
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **Collaboration**: Yjs, y-quill, socket.io-client
- **HTTP Client**: Axios

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Real-time Engine**: Socket.io
- **Conflict Resolution**: Yjs (Server-side document management)
- **Authentication**: Passport.js / JWT / Google Auth Library

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)

### 1. Clone the Repository
```bash
git clone https://github.com/hareesh100807/Collaborative-Document-Editor.git
cd Collaborative-Document-Editor
```

### 2. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend/` directory:
```env
DB_URL="your_mongodb_url"
PORT=4000
JWT_SECRET="your_very_secure_secret"
GOOGLE_CLIENT_ID="your_google_id"
GOOGLE_CLIENT_SECRET="your_google_secret"
GITHUB_CLIENT_ID="your_github_id"
GITHUB_CLIENT_SECRET="your_github_secret"
FRONTEND_URL="http://localhost:5173"
```
Run the server:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```
Run the development server:
```bash
npm run dev
```

The app should now be running at `http://localhost:5173`.

---

## 📁 Project Structure

```text
Collaborative-Document-Editor/
├── backend/                # Express Server Logic
│   ├── config/             # DB & Config
│   ├── controllers/        # Route Handlers (Auth, Docs, Share, Version)
│   ├── models/             # Mongoose Schemas (User, Document, Version)
│   ├── routes/             # API Endpoints
│   ├── sockets/            # Real-time Collaboration Logic
│   └── server.js           # Entry Point
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── api/            # Axios Services
│   │   ├── components/     # UI Components
│   │   ├── context/        # Auth State
│   │   ├── pages/          # Dashboard, Editor, Auth Pages
│   │   └── routes/         # Protected Client-side Routing
│   └── index.html
└── package.json            # Root configuration
```

---

## 📡 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/auth/register` | POST | Register a new user |
| `/auth/login` | POST | Login user & get JWT cookie |
| `/auth/me` | GET | Current session details |
| `/documents` | POST | Create a new document |
| `/documents` | GET | List all accessible documents |
| `/documents/:id` | GET | Get document details |
| `/share/:id/collaborators`| POST | Add collaborator by email |
| `/versions/:id` | GET | Get document version history |

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/hareesh100807">Hareesh</a>
</p>
