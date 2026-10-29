# AI Mentor 1.0

An interactive, patient, and beginner-friendly programming mentor powered by a local Large Language Model (**Qwen 2.5:3B**) running locally via **Ollama**, coupled with a **FastAPI** backend and a responsive vanilla **HTML/CSS/JavaScript** frontend.

Built specifically for Computer Science & Engineering (CSE) students to learn programming concepts, understand code line by line, debug errors constructively, and get hints without spoiling answers.

---

## 🌟 Key Features

1. **Patient Programming Mentor**: Answers questions directly, uses plain English analogies, calibrates detail level, and avoids overwhelming beginners.
2. **Pedagogical Support**:
   - **Hints vs. Answers**: Asks guiding questions and gives gentle hints when requested ("*Give me a hint, don't give me the answer*").
   - **Structured Debugging**: Explains (1) What is wrong, (2) Why it is wrong, and (3) How to fix it, without unnecessary rewrites.
   - **Code Explanations**: Breaks down complex snippets into easy-to-understand explanations.
3. **True Local AI Privacy & Zero Cloud Costs**: Runs 100% locally on your machine using Ollama and the `qwen2.5:3b` model. No API keys, no paid subscriptions, and no data leaves your computer.
4. **Real-Time NDJSON Streaming**: Streams tokens progressively into the browser UI with an animated streaming cursor.
5. **Smart Sliding-Window Context**: Retains immediate conversational thread across follow-up queries (e.g., "*Why?*", "*What about this?*", "*Give an example*") while keeping Ollama prompts bounded and fast.
6. **Full Persistence & Export**:
   - Saves complete conversation history in browser `localStorage`.
   - **Clear Chat**: Confirms with the user and restores the initial welcome view.
   - **Export Chat**: Downloads conversation transcripts as clean, readable `.txt` files.
7. **Zero-Dependency Markdown & Code Blocks**:
   - Renders code blocks with syntax tags and a one-click **Copy** button.
   - Formats lists, bold text, italics, inline code, and headers with strict HTML escaping to prevent XSS.
8. **Resilient Error Handling**:
   - Clear diagnostic notices when Ollama is offline (`http://127.0.0.1:11434`).
   - Clear diagnostic notices when the FastAPI backend is offline (`http://127.0.0.1:8000`).
   - Graceful recovery and partial text preservation if a stream is interrupted.

---

## 🏗️ Architecture Overview

```text
┌────────────────────────────────────────────────────────┐
│                   Browser Client                       │
│        (HTML5, Vanilla CSS, Vanilla JavaScript)        │
└──────────────┬───────────────────────────▲─────────────┘
               │ HTTP POST /chat           │ NDJSON Stream
               │ JSON: {message, history}  │ {content, done}
               ▼                           │
┌──────────────────────────────────────────┴─────────────┐
│                 FastAPI Backend Server                 │
│              Python 3.12 + httpx client                │
│                                                        │
│  - System Prompt Persona Management                    │
│  - Sliding Window Context Buffer (Recent 10 turns)     │
│  - Token Prediction Limit (1024 tokens)                │
└──────────────┬───────────────────────────▲─────────────┘
               │ HTTP POST /api/chat       │ Chunked Stream
               │ JSON: {model, messages}   │ JSON chunks
               ▼                           │
┌──────────────────────────────────────────┴─────────────┐
│                  Local Ollama Service                  │
│                http://127.0.0.1:11434                  │
│                Model: qwen2.5:3b                       │
└────────────────────────────────────────────────────────┘
```

### Protocol & Streaming
1. Frontend makes an asynchronous `fetch` `POST` request to `http://127.0.0.1:8000/chat`.
2. Backend receives the request, prepends the `SYSTEM_PROMPT`, extracts the most recent conversation context (sliding window of 10 messages), and forwards the payload to Ollama's `/api/chat`.
3. Backend receives Ollama's streamed response and yields newline-delimited JSON (**NDJSON**) chunks with `Content-Type: application/x-ndjson`:
   ```json
   {"content": "An", "done": false}
   {"content": " agent", "done": false}
   {"content": " is...", "done": false}
   {"content": "", "done": true}
   ```
4. Frontend reads the byte stream using `ReadableStream` (`getReader()`), decodes UTF-8 text, and progressively renders Markdown into the message bubble.

---

## 📁 Project Structure

```text
ai-mentor/
├── backend/
│   ├── main.py              # FastAPI application, streaming endpoint, Ollama client, system prompt
│   ├── requirements.txt     # Python dependencies (fastapi, uvicorn, httpx)
│   └── README.md            # Detailed backend documentation
├── frontend/
│   ├── index.html           # Accessible chat application layout
│   ├── style.css            # Dark-mode styling, responsive design, code styling, animations
│   ├── app.js               # Frontend chat logic, streaming parser, markdown renderer, persistence
│   └── README.md            # Detailed frontend documentation
└── README.md                # Project documentation (this file)
```

---

## 🚀 Getting Started

### Prerequisites

1. **Python 3.10+** (Tested on Python 3.12)
2. **Ollama** installed on your system ([ollama.com](https://ollama.com))
3. A modern web browser (Chrome, Firefox, Edge, Safari)

---

### Step 1: Set Up & Start Ollama

1. Open your terminal and pull the `qwen2.5:3b` model:
   ```bash
   ollama pull qwen2.5:3b
   ```
2. Verify that the model is downloaded:
   ```bash
   ollama list
   ```
3. Ensure Ollama service is running:
   ```bash
   ollama serve
   ```
   *(On Windows/macOS, Ollama usually runs in the background automatically in your system tray).*

---

### Step 2: Set Up & Start the Backend

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI development server:
   ```bash
   uvicorn main.py:app --reload --port 8000
   ```
4. Confirm the server is active:
   - Visit `http://127.0.0.1:8000/` in your browser.
   - You should see:
     ```json
     {
       "status": "online",
       "message": "AI Mentor backend is running successfully!",
       "version": "1.0.0",
       "model": "qwen2.5:3b"
     }
     ```

---

### Step 3: Open the Frontend

1. Simply open `frontend/index.html` in any web browser:
   - Double-click `frontend/index.html` in your file explorer, OR
   - Serve using any static server:
     ```bash
     cd frontend
     python -m http.server 3000
     ```
     and open `http://localhost:3000` in your browser.
2. Start chatting with your local AI Mentor!

---

## 💬 Conversation Memory & Context Strategy

- **Browser Storage**: All user and mentor messages are saved in browser `localStorage` (`aiMentorConversationHistory`). Conversation history persists across page reloads and browser restarts.
- **Backend Sliding Window**: To keep local inference fast and avoid exceeding the model's optimal context window, the backend selects the **last 10 messages** (sliding window) from the submitted history, prepends the `SYSTEM_PROMPT`, and forwards them to Ollama.
- **Context Awareness**: The model seamlessly resolves follow-up references such as:
  - *"Why?"*
  - *"Explain that code"*
  - *"Give me an example"*
  - *"What if I change the second line?"*

---

## 🛡️ Error Handling Guide

| Scenario | Behavior & User Feedback |
| :--- | :--- |
| **Ollama is offline** | Backend catches `httpx.ConnectError` and returns HTTP 503. Frontend displays: *"Could not connect to Ollama. Please make sure the Ollama application is running on your machine (http://127.0.0.1:11434)."* |
| **Backend is offline** | Frontend catches fetch error and displays: *"Cannot connect to the AI Mentor backend. Please ensure the FastAPI server is running on http://127.0.0.1:8000."* |
| **Model not found** | Backend returns HTTP 502 with: *"Model 'qwen2.5:3b' was not found in Ollama. Please run 'ollama pull qwen2.5:3b' in your terminal."* |
| **Request Timeout** | Backend catches timeout and returns HTTP 504. Frontend displays actionable guidance to check system load. |
| **Empty Input** | Frontend ignores empty submissions; backend validates `request.message.strip()` and rejects empty queries with HTTP 400. |
| **Interrupted Stream** | If the stream breaks mid-response, the received text is preserved with a notice `*(⚠️ Response was interrupted)*`, and saved to localStorage without data loss. |

---

## 📜 License & Notes

Designed as an educational project for computer science students learning AI engineering, client-server architectures, and streaming protocols.
