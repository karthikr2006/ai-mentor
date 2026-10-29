# AI Mentor 1.0 - Frontend Client

The frontend client for AI Mentor, built with **HTML5**, **Vanilla CSS**, and **Vanilla JavaScript** (no bulky frontend frameworks or external runtime dependencies).

## Key Features
- **Progressive Streaming**: Reads streamed NDJSON responses chunks via `ReadableStream` (`getReader()`) with an animated streaming cursor.
- **Custom Markdown Renderer**: Zero-dependency parser converting Markdown (code blocks, language labels, copy buttons, bold, italics, lists, headings) to safe HTML with strict entity escaping against XSS.
- **Persistent Chat History**: Saves conversations in `localStorage` (`aiMentorConversationHistory`) across browser sessions.
- **Export Chat**: Exports complete conversation transcripts to downloadable plain text (`ai-mentor-chat.txt`).
- **Clear Chat**: Clears history in memory and storage with a confirmation prompt, and restores the initial mentor greeting.
- **Dark-Mode Modern Design**: Clean glassmorphism aesthetic with accessible typography and smooth transitions.
- **Mobile Responsive**: Adaptive layout optimized for both desktop and mobile devices.

## Running the Frontend
Simply open `index.html` in your web browser, or serve it with any static HTTP server:
```bash
python -m http.server 3000
```
and navigate to `http://localhost:3000`.

