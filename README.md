# 🤖 AI Mentor 1.0

### Your Personal, Local AI Programming Mentor

AI Mentor is a beginner-friendly programming mentor designed to help students understand programming concepts, explore code, debug errors, and learn step by step.

Powered by **Qwen 2.5:3B running locally through Ollama**, with a **FastAPI backend** and a **vanilla HTML, CSS, and JavaScript frontend**, AI Mentor provides an interactive learning experience without requiring a paid cloud AI API.

---

## 📌 Project Overview

Learning programming can be challenging, especially when you're just starting out. AI Mentor is designed to make that journey easier by providing an interactive assistant that explains concepts in simple language and helps learners work through programming problems.

Instead of focusing only on producing code, AI Mentor is designed to support understanding through explanations, examples, hints, debugging assistance, and follow-up questions.

## ✨ Features

- **💬 Interactive AI Chat** — Ask programming questions and explore technical concepts.
- **🧠 Conversation Context** — Ask follow-up questions using recent conversation history.
- **⚡ Streaming Responses** — See the mentor's response as it is generated.
- **💻 Code Formatting** — Display code blocks and supported Markdown formatting.
- **📋 Copy Code** — Copy code directly from supported code blocks.
- **💾 Conversation Persistence** — Restore saved chat history using browser local storage.
- **🧹 Clear Chat** — Clear the current conversation after confirmation.
- **📤 Export Chat** — Export a conversation for later reference.
- **⏳ Thinking Indicator** — See when the mentor is preparing a response.
- **🛡️ Error Handling** — Display helpful feedback when the backend or Ollama is unavailable.
- **🔒 Local AI Inference** — Run the language model locally instead of depending on a paid cloud AI API.

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Python, FastAPI |
| AI Runtime | Ollama |
| Language Model | Qwen 2.5:3B (`qwen2.5:3b`) |
| HTTP Communication | Fetch API, HTTP streaming |
| Conversation Storage | Browser `localStorage` |

## 🏗️ System Architecture

AI Mentor uses a simple client-server architecture.

```text
┌──────────────────────────────┐
│       Web Browser            │
│                              │
│   HTML + CSS + JavaScript    │
└──────────────┬───────────────┘
               │
               │ HTTP Request
               │ Streaming Response
               ▼
┌──────────────────────────────┐
│       FastAPI Backend        │
│                              │
│  Request Handling            │
│  Conversation Context        │
│  Response Streaming          │
└──────────────┬───────────────┘
               │
               │ Local API
               ▼
┌──────────────────────────────┐
│         Ollama               │
│                              │
│       Qwen 2.5:3B             │
│       Local Inference        │
└──────────────────────────────┘
```

### How It Works

1. The user enters a question in the web interface.
2. JavaScript sends the message and conversation history to the FastAPI backend.
3. The backend prepares the conversation context and sends a request to Ollama.
4. Ollama runs the Qwen model locally and generates a response.
5. The backend streams the response to the frontend.
6. The frontend displays the response and saves conversation history in browser storage.

## 📁 Project Structure

```text
ai-mentor/
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── README.md
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── README.md
│
├── .gitignore
└── README.md
```

## ⚙️ Installation and Setup

### Prerequisites

Install the following software before running the project:

- [Python](https://www.python.org/downloads/)
- [Ollama](https://ollama.com/download)
- [Git](https://git-scm.com/downloads) (optional, for cloning the repository)

You will also need sufficient memory and storage to run the selected language model locally.

### 1. Clone the Repository

```bash
git clone https://github.com/karthikr2006/ai-mentor.git
cd ai-mentor
```

Alternatively, download the repository as a ZIP file from GitHub and extract it.

### 2. Download the AI Model

Make sure Ollama is installed and running.

Open a terminal and run:

```bash
ollama pull qwen2.5:3b
```

Verify that the model is available:

```bash
ollama list
```

### 3. Set Up the Backend

Navigate to the backend directory:

```bash
cd backend
```

Create a Python virtual environment:

```bash
python -m venv .venv
```

Activate it on Windows:

```bash
.venv\Scripts\activate
```

Install the dependencies:

```bash
python -m pip install -r requirements.txt
```

### 4. Start the Backend Server

From the `backend` directory, run:

```bash
uvicorn main:app --reload
```

The backend should be available at:

- **API:** `http://127.0.0.1:8000`
- **Interactive API documentation:** `http://127.0.0.1:8000/docs`

Keep this terminal running while using AI Mentor.

### 5. Open the Frontend

Open `frontend/index.html` in your web browser.

Make sure the backend and Ollama are running before sending messages.

> **Note:** This project is configured for local development. The frontend communicates with the backend on your own computer, so opening the page on another device will not automatically connect it to your local backend.

## 🔌 Backend API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/` | Check backend status |
| `POST` | `/chat` | Send a message and receive a streamed AI response |

### Health Check

Request:

```http
GET http://127.0.0.1:8000/
```

This endpoint returns information about the backend's status and configured model.

### Chat

Send a `POST` request to `/chat` with a message and, optionally, conversation history.

The backend communicates with Ollama and streams the generated response to the frontend.

## 🔒 Privacy and Local Execution

AI Mentor uses Ollama to run its language model locally. It does not require a paid cloud AI API for its core chat functionality.

Conversation history is stored in the browser's local storage to support restoration between visits. Clearing the conversation removes the saved history through the application's Clear Chat functionality.

**Important:** Local model execution does not automatically make every part of an application private or secure. Use the application locally as configured, and review network settings before exposing the backend to other devices or the internet.

## 🎯 Learning Goals

This project provides practical experience with:

- Frontend development using HTML, CSS, and JavaScript
- Backend API development using FastAPI
- HTTP requests and streaming responses
- Integrating a locally hosted language model
- Managing conversation context
- Browser storage and client-side state
- Error handling and debugging
- Version control using Git and GitHub

## 🚀 Future Improvements

Potential areas for future development include:

- Improved Markdown and code rendering
- More robust conversation management
- Additional learning modes for programming practice
- Better automated testing
- Enhanced setup and deployment options
- Support for configurable local models

## 👨‍💻 Author

**Karthik R**

Computer Science and Engineering Student

GitHub: [@karthikr2006](https://github.com/karthikr2006)

---

*AI Mentor 1.0 — Learn concepts. Understand code. Grow as a programmer.*