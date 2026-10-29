"""
AI Mentor - Backend Server (FastAPI)

AI Mentor 1.0
- GET /: Health check to verify the server is running.
- POST /chat: Receives user message, manages conversation context, calls local Ollama API,
             and streams NDJSON responses.
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import httpx
import json

# 1. Initialize the FastAPI application
app = FastAPI(
    title="AI Mentor API",
    description="Backend service for AI Mentor Chatbot connecting to local Ollama",
    version="1.0.0"
)

# 2. Configure CORS (Cross-Origin Resource Sharing)
# Allows the frontend in the browser to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local development
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

# 3. Ollama & Model Configuration
OLLAMA_API_URL = "http://127.0.0.1:11434/api/chat"
MODEL_NAME = "qwen2.5:3b"

# Sensible prediction limit: allows full code blocks and deep explanations to complete
# without truncating, while keeping local execution responsive.
MAX_PREDICT_TOKENS = 1536

# Maximum recent conversation messages sent to Ollama for context (sliding window).
# Keeps memory relevant and within model context without truncating frontend history.
MAX_CONTEXT_MESSAGES = 10

# AI Mentor 1.0 System Prompt tailored for beginner CSE students
SYSTEM_PROMPT = (
    "You are AI Mentor, a patient, encouraging, and knowledgeable programming mentor for a beginner Computer Science and Engineering (CSE) student.\n\n"
    "Core Persona & Communication Style:\n"
    "1. Answer the user's exact question directly first before adding any optional or secondary information.\n"
    "2. Use simple, clear, and beginner-friendly English.\n"
    "3. Assume the learner is a beginner unless the conversation clearly indicates otherwise.\n"
    "4. Explain difficult technical terminology using simple, everyday language and intuitive explanations.\n"
    "5. Keep answers appropriately concise. Do not make simple questions unnecessarily long.\n"
    "6. For questions that genuinely require more explanation, provide enough detail to make the concept fully understandable.\n"
    "7. If the user asks for a simple explanation, keep it simple. If the user asks for a detailed explanation, provide a detailed explanation.\n"
    "8. Avoid unnecessary repetition and do not turn every answer into a long tutorial.\n"
    "9. Use code or real-world examples only when they directly help answer the question.\n"
    "10. Do not invent previous context, code, values, or assumptions not present in the conversation.\n"
    "11. If a question is genuinely ambiguous, ask a short clarification instead of guessing.\n\n"
    "Conversation Context & Follow-Ups:\n"
    "- Maintain strict consistency with the conversation history.\n"
    "- Correctly understand and resolve follow-up references such as 'this', 'that', 'the above code', 'why?', 'give an example', or 'what about this?' by directly referring to the specific previous code, values, or concept discussed.\n"
    "- Use previous conversation context only when it is relevant to the current question. Do not bring up unrelated earlier topics or conversations.\n\n"
    "Programming Learning & Mentoring Rules:\n"
    "- Hints vs. Solutions: If the user explicitly asks for a hint (e.g., 'give me a hint', 'don't give me the answer'), provide a thoughtful hint or guiding question rather than immediately revealing the complete solution or code.\n"
    "- Debugging Help: When the user asks for help finding an error or debugging code, clearly explain:\n"
    "    1. What is wrong.\n"
    "    2. Why it is wrong.\n"
    "    3. How to fix it.\n"
    "  Do not unnecessarily rewrite an entire program when only a small fix is required.\n"
    "- Explaining Code: When asked to explain code or a specific line, explain what it does in plain terms and why it works that way.\n"
    "- Providing Code: If the user asks for code, provide clean, idiomatic code and explain the important parts."
)

# 4. Define the data format expected by POST /chat
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

# 5. GET Endpoint: Health Check
@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "AI Mentor backend is running successfully!",
        "version": "1.0.0",
        "model": MODEL_NAME
    }

# 6. POST Endpoint: Stream Chat with Ollama
@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    user_message = request.message.strip()
    if not user_message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty."
        )

    # 1. Assemble messages starting with the system prompt
    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        }
    ]

    # 2. Context management: Select recent conversation history (sliding window)
    raw_history = request.history or []

    # Filter out empty messages and normalize roles
    valid_history = []
    for msg in raw_history:
        if msg.content and msg.content.strip():
            role = "user" if msg.role == "user" else "assistant"
            valid_history.append({"role": role, "content": msg.content})

    # Check if the last history entry is already the current user message (frontend pushed it)
    has_current_in_history = (
        len(valid_history) > 0
        and valid_history[-1]["role"] == "user"
        and valid_history[-1]["content"].strip() == user_message
    )

    if has_current_in_history:
        # Take the most recent turns up to MAX_CONTEXT_MESSAGES
        selected_history = valid_history[-MAX_CONTEXT_MESSAGES:]
        messages.extend(selected_history)
    else:
        # Take the most recent turns up to (MAX_CONTEXT_MESSAGES - 1) and append current message
        selected_history = valid_history[-(MAX_CONTEXT_MESSAGES - 1):] if valid_history else []
        messages.extend(selected_history)
        messages.append({
            "role": "user",
            "content": user_message
        })

    # Construct the payload for Ollama's /api/chat endpoint with streaming enabled
    payload = {
        "model": MODEL_NAME,
        "messages": messages,
        "stream": True,
        "options": {
            "num_predict": MAX_PREDICT_TOKENS
        }
    }

    client = httpx.AsyncClient(timeout=180.0)
    try:
        req = client.build_request("POST", OLLAMA_API_URL, json=payload)
        response = await client.send(req, stream=True)
    except httpx.ConnectError:
        await client.aclose()
        raise HTTPException(
            status_code=503,
            detail="Could not connect to Ollama. Please make sure the Ollama application is running on your machine (http://127.0.0.1:11434)."
        )
    except httpx.TimeoutException:
        await client.aclose()
        raise HTTPException(
            status_code=504,
            detail=f"The local model ({MODEL_NAME}) took too long to respond. Please check if your computer is under heavy load and try again."
        )
    except Exception as err:
        await client.aclose()
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred while communicating with the AI: {str(err)}"
        )

    # Check for upstream Ollama error response
    if response.status_code != 200:
        error_body = await response.aread()
        await response.aclose()
        await client.aclose()
        error_text = error_body.decode(errors='ignore')
        if response.status_code == 404:
            detail = f"Model '{MODEL_NAME}' was not found in Ollama. Please run 'ollama pull {MODEL_NAME}' in your terminal."
        else:
            detail = f"Ollama returned an error (HTTP {response.status_code}): {error_text}"
        raise HTTPException(
            status_code=502,
            detail=detail
        )

    # Generator streaming NDJSON chunks with explicit "done" indicator
    async def stream_generator():
        try:
            async for line in response.aiter_lines():
                if line.strip():
                    try:
                        chunk_data = json.loads(line)
                        content = chunk_data.get("message", {}).get("content", "")
                        done = chunk_data.get("done", False)
                        yield json.dumps({"content": content, "done": done}) + "\n"
                        if done:
                            break
                    except json.JSONDecodeError:
                        continue
        finally:
            await response.aclose()
            await client.aclose()

    return StreamingResponse(
        stream_generator(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache"}
    )

