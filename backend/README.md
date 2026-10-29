# AI Mentor 1.0 - Backend Server

The backend service for AI Mentor, built with **FastAPI** and **Python 3.12**.

## Responsibilities
- **AI Integration**: Communicates with the local **Ollama** service running `qwen2.5:3b`.
- **System Prompt & Persona**: Enforces beginner-friendly mentoring guidelines, hints-first pedagogical rules, and structured debugging output.
- **Context Management**: Implements a sliding window strategy (last 10 messages) to maintain context without overloading the local model.
- **NDJSON Streaming**: Streams progressive chunks (`application/x-ndjson`) to the frontend for real-time output.
- **Input & Error Handling**: Validates user input and returns meaningful HTTP status codes (503 for Ollama offline, 504 for timeout, 502 for upstream errors, 400 for empty input).

## Endpoints
- `GET /`: Health check endpoint returning service status, version (`1.0.0`), and active model.
- `POST /chat`: Streaming endpoint receiving `{ message: string, history: ChatMessage[] }` and yielding NDJSON chunks:
  - `{"content": "...", "done": false}`
  - `{"content": "", "done": true}`

## Setup & Running
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Start the server with hot-reload:
   ```bash
   uvicorn main.py:app --reload --port 8000
   ```

