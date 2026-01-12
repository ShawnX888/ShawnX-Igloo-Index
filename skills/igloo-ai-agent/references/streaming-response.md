# Streaming Response

## Table of Contents

1. [SSE Implementation (Text Mode)](#sse-implementation-text-mode)
2. [WebSocket Implementation (Voice Mode)](#websocket-implementation-voice-mode)
3. [Voice Gateway](#voice-gateway)
4. [VAD (Voice Activity Detection)](#vad-voice-activity-detection)
5. [Barge-in Handling](#barge-in-handling)
6. [Frontend Integration](#frontend-integration)
7. [Status Indicators](#status-indicators)
8. [Error Handling](#error-handling)

---

## SSE Implementation (Text Mode)

### FastAPI SSE Endpoint

```python
from fastapi import APIRouter, Request, Depends
from sse_starlette.sse import EventSourceResponse
import json

router = APIRouter()

@router.post("/agents/chat")
async def chat_stream(
    request: ChatRequest,
    session_id: str = Depends(get_session_id)
):
    """Stream AI agent responses via SSE (Text Mode)."""
    
    async def event_generator():
        try:
            async for chunk in agent_service.stream_response(
                message=request.message,
                session_id=session_id,
                channel="text"  # Text mode
            ):
                yield {
                    "event": "message",
                    "data": json.dumps(chunk)
                }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            }
        finally:
            yield {
                "event": "done",
                "data": json.dumps({"status": "complete"})
            }
    
    return EventSourceResponse(event_generator())
```

### Chunk Types

```python
from enum import Enum
from dataclasses import dataclass

class ChunkType(str, Enum):
    TEXT = "text"           # Regular text content
    STATUS = "status"       # Status update (e.g., "Analyzing...")
    TOOL_CALL = "tool_call" # Tool being invoked
    TOOL_RESULT = "tool_result"  # Tool result
    AUDIO = "audio"         # Audio chunk (voice mode)
    ERROR = "error"         # Error message
    DONE = "done"           # Stream complete

@dataclass
class StreamChunk:
    type: ChunkType
    content: str
    metadata: dict | None = None
    
    def to_dict(self) -> dict:
        return {
            "type": self.type.value,
            "content": self.content,
            "metadata": self.metadata
        }
```

---

## WebSocket Implementation (Voice Mode)

### FastAPI WebSocket Endpoint

```python
from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import json
import base64

@router.websocket("/ws/agents/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for voice-based interactions."""
    await websocket.accept()
    
    voice_adapter = VoiceAdapter()
    router_agent = RouterAgent()
    session_id = None
    current_task: asyncio.Task | None = None
    
    try:
        while True:
            # Receive message
            data = await websocket.receive()
            
            if data["type"] == "websocket.receive":
                if "text" in data:
                    message = json.loads(data["text"])
                    msg_type = message.get("type")
                    session_id = message.get("session_id", session_id)
                    
                    if msg_type == "audio_chunk":
                        # Process audio chunk
                        audio_bytes = base64.b64decode(message["data"])
                        
                        # Transcribe (or pass raw to Gemini Native Audio)
                        text = await voice_adapter.transcribe(audio_bytes)
                        
                        # Store for commit
                        # (accumulate chunks until commit signal)
                    
                    elif msg_type == "text":
                        # Direct text input (fallback)
                        text = message["data"]
                        await process_and_respond(
                            websocket, router_agent, text, session_id
                        )
                    
                    elif msg_type == "commit":
                        # User finished speaking, process accumulated audio
                        if current_task and not current_task.done():
                            current_task.cancel()
                        
                        current_task = asyncio.create_task(
                            process_and_respond(
                                websocket, router_agent, text, session_id
                            )
                        )
                    
                    elif msg_type == "interrupt":
                        # User interrupted (barge-in)
                        if current_task and not current_task.done():
                            current_task.cancel()
                        
                        # Notify client that generation stopped
                        await websocket.send_json({
                            "type": "status",
                            "content": "Listening...",
                            "status": "interrupted"
                        })
                        
    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {session_id}")
    except asyncio.CancelledError:
        pass  # Normal cancellation during interrupt
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "content": str(e)
        })
        await websocket.close()


async def process_and_respond(
    websocket: WebSocket,
    router_agent: RouterAgent,
    text: str,
    session_id: str
):
    """Process input and stream response via WebSocket."""
    
    # Get session
    session = await get_or_create_session(session_id)
    
    # Process with Router Agent
    async for chunk in router_agent.process(
        message=text,
        session=session,
        channel="voice"  # Voice mode
    ):
        if isinstance(chunk, bytes):
            # Audio chunk
            await websocket.send_bytes(chunk)
        else:
            # Status/text chunk
            await websocket.send_json(chunk)
    
    # Done
    await websocket.send_json({
        "type": "done",
        "status": "complete"
    })
```

### WebSocket Message Protocol

```python
# Client → Server
{
    "type": "audio_chunk" | "text" | "commit" | "interrupt",
    "data": "<audio base64 or text>",
    "session_id": "xxx"
}

# Server → Client
{
    "type": "audio_chunk" | "text" | "status" | "error" | "done",
    "data": "<audio base64 or text>",
    "status": "thinking" | "calling_tool" | "generating" | "done" | "interrupted"
}
```

---

## Voice Gateway

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│             前端 (Frontend)                              │
│  - Web Speech API / Silero VAD (WebAssembly)            │
│  - 音频采集 → VAD检测 → WebSocket发送                   │
└─────────────────────────────────────────────────────────┘
                        ↕ WebSocket
┌─────────────────────────────────────────────────────────┐
│         Voice Gateway (FastAPI WebSocket)                │
│  - WebSocket连接管理                                     │
│  - 音频流接收/发送                                       │
│  - VAD信号处理（Commit/Interrupt）                      │
│  - 会话状态管理                                          │
└─────────────────────────────────────────────────────────┘
                        ↕
┌─────────────────────────────────────────────────────────┐
│         VoiceAdapter (Modality Adapter)                  │
│  - STT: Gemini Native Audio 或 Google Speech-to-Text   │
│  - TTS: Google Text-to-Speech (流式)                     │
│  - 音频格式转换                                          │
└─────────────────────────────────────────────────────────┘
                        ↕ (unified text)
┌─────────────────────────────────────────────────────────┐
│         Router Agent                                    │
│  - 处理语义逻辑（与模态无关）                            │
└─────────────────────────────────────────────────────────┘
```

### Connection Manager

```python
class VoiceConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.session_states: dict[str, VoiceSessionState] = {}
    
    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        self.session_states[session_id] = VoiceSessionState()
    
    def disconnect(self, session_id: str):
        self.active_connections.pop(session_id, None)
        self.session_states.pop(session_id, None)
    
    async def send_audio(self, session_id: str, audio_bytes: bytes):
        if ws := self.active_connections.get(session_id):
            await ws.send_bytes(audio_bytes)
    
    async def send_status(self, session_id: str, status: str):
        if ws := self.active_connections.get(session_id):
            await ws.send_json({"type": "status", "content": status})


@dataclass
class VoiceSessionState:
    """Track voice session state."""
    state: str = "idle"  # idle | listening | processing | speaking
    audio_buffer: list[bytes] = field(default_factory=list)
    current_task: asyncio.Task | None = None
    
    def reset_buffer(self):
        self.audio_buffer = []
```

---

## VAD (Voice Activity Detection)

### Frontend Implementation (Silero VAD)

```typescript
// Using Silero VAD via WebAssembly
import { MicVAD } from '@ricky0123/vad-web';

export function useVoiceInput() {
  const wsRef = useRef<WebSocket | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [vadState, setVadState] = useState<'idle' | 'speaking' | 'silence'>('idle');

  useEffect(() => {
    const vad = new MicVAD({
      onSpeechStart: () => {
        setVadState('speaking');
        // If AI is currently speaking, send interrupt
        if (wsRef.current && isAISpeaking) {
          wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
        }
      },
      onSpeechEnd: (audio: Float32Array) => {
        setVadState('silence');
        // Convert to bytes and send
        const audioBytes = float32ToInt16(audio);
        wsRef.current?.send(JSON.stringify({
          type: 'audio_chunk',
          data: base64Encode(audioBytes)
        }));
        // Send commit signal after short delay
        setTimeout(() => {
          wsRef.current?.send(JSON.stringify({ type: 'commit' }));
        }, 500);
      },
      onVADMisfire: () => {
        // False positive, ignore
        setVadState('idle');
      }
    });

    vad.start();
    return () => vad.destroy();
  }, []);

  return { isListening, vadState };
}
```

### Backend VAD Signal Handling

```python
async def handle_vad_signal(
    websocket: WebSocket,
    signal_type: str,
    session_state: VoiceSessionState,
    voice_adapter: VoiceAdapter
):
    """Handle VAD signals from frontend."""
    
    if signal_type == "commit":
        # User finished speaking
        session_state.state = "processing"
        
        # Combine audio buffer
        full_audio = b"".join(session_state.audio_buffer)
        session_state.reset_buffer()
        
        # Transcribe
        text = await voice_adapter.transcribe(full_audio)
        
        return text
    
    elif signal_type == "interrupt":
        # User started speaking during AI response
        session_state.state = "listening"
        
        # Cancel current generation
        if session_state.current_task:
            session_state.current_task.cancel()
        
        # Clear any pending audio output
        session_state.reset_buffer()
        
        return None
```

---

## Barge-in Handling

### Full Flow

```
1. AI is speaking (TTS streaming)
     ↓
2. User starts talking (VAD detects speech start)
     ↓
3. Frontend sends INTERRUPT signal
     ↓
4. Backend:
   a. Cancel current generation task
   b. Stop TTS streaming
   c. Clear audio buffers
   d. Send "interrupted" status to client
     ↓
5. Frontend stops playing audio
     ↓
6. Backend waits for new input
     ↓
7. User finishes speaking (VAD detects speech end)
     ↓
8. Frontend sends COMMIT signal
     ↓
9. Backend processes new input
```

### Backend Implementation

```python
async def handle_interrupt(
    session_id: str,
    session_state: VoiceSessionState,
    websocket: WebSocket
):
    """Handle user interrupt (barge-in)."""
    
    # 1. Cancel current task
    if session_state.current_task and not session_state.current_task.done():
        session_state.current_task.cancel()
        try:
            await session_state.current_task
        except asyncio.CancelledError:
            pass  # Expected
    
    # 2. Update state
    session_state.state = "listening"
    session_state.reset_buffer()
    
    # 3. Notify client
    await websocket.send_json({
        "type": "status",
        "content": "Listening...",
        "status": "interrupted"
    })
```

### Frontend Implementation

```typescript
function handleInterrupt(ws: WebSocket, audioPlayer: HTMLAudioElement) {
  // 1. Stop current audio playback
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
  
  // 2. Clear audio queue
  audioQueue.current = [];
  
  // 3. Send interrupt signal
  ws.send(JSON.stringify({ type: 'interrupt' }));
  
  // 4. Update UI
  setStatus('Listening...');
}
```

---

## Frontend Integration

### Voice Chat Hook

```tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { MicVAD } from '@ricky0123/vad-web';

interface VoiceChatState {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  status: string | null;
  transcript: string;
}

export function useVoiceChat(sessionId: string) {
  const ws = useRef<WebSocket | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const [state, setState] = useState<VoiceChatState>({
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    status: null,
    transcript: '',
  });

  useEffect(() => {
    // Connect WebSocket
    const socket = new WebSocket(
      `${location.origin.replace('http', 'ws')}/ws/agents/chat`
    );

    socket.onopen = () => {
      setState(s => ({ ...s, isConnected: true }));
      socket.send(JSON.stringify({ 
        type: 'init', 
        session_id: sessionId 
      }));
    };

    socket.onclose = () => {
      setState(s => ({ ...s, isConnected: false }));
    };

    socket.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        // Audio data
        const audioBuffer = await event.data.arrayBuffer();
        playAudio(audioBuffer);
        setState(s => ({ ...s, isSpeaking: true }));
      } else {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'status':
            setState(s => ({ ...s, status: data.content }));
            break;
          case 'text':
            setState(s => ({ 
              ...s, 
              transcript: s.transcript + data.content 
            }));
            break;
          case 'done':
            setState(s => ({ 
              ...s, 
              isSpeaking: false, 
              status: null 
            }));
            break;
        }
      }
    };

    ws.current = socket;

    // Initialize VAD
    const vad = new MicVAD({
      onSpeechStart: () => {
        if (state.isSpeaking) {
          // Interrupt AI
          socket.send(JSON.stringify({ type: 'interrupt' }));
        }
        setState(s => ({ ...s, isListening: true }));
      },
      onSpeechEnd: (audio) => {
        const bytes = float32ToBytes(audio);
        socket.send(JSON.stringify({
          type: 'audio_chunk',
          data: btoa(String.fromCharCode(...bytes))
        }));
        setTimeout(() => {
          socket.send(JSON.stringify({ type: 'commit' }));
        }, 300);
        setState(s => ({ ...s, isListening: false }));
      }
    });
    vad.start();

    return () => {
      vad.destroy();
      socket.close();
    };
  }, [sessionId]);

  return state;
}
```

### SSE Client Hook (Text Mode)

```tsx
export function useChatStream() {
  const [messages, setMessages] = useState<string>('');
  const [status, setStatus] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(async (message: string) => {
    setIsStreaming(true);
    setMessages('');
    
    const response = await fetch('/api/v1/agents/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'text':
                setMessages((prev) => prev + data.content);
                break;
              case 'status':
              case 'tool_call':
                setStatus(data.content);
                break;
              case 'done':
                setIsStreaming(false);
                setStatus(null);
                break;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
      setIsStreaming(false);
    }
  }, []);

  return { messages, status, isStreaming, sendMessage };
}
```

---

## Status Indicators

### Voice Status Component

```tsx
interface VoiceStatusProps {
  isListening: boolean;
  isSpeaking: boolean;
  status: string | null;
}

export function VoiceStatus({ isListening, isSpeaking, status }: VoiceStatusProps) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-100">
      {isListening && (
        <div className="flex items-center gap-2 text-red-500">
          <MicIcon className="w-5 h-5 animate-pulse" />
          <span>Listening...</span>
        </div>
      )}
      
      {isSpeaking && (
        <div className="flex items-center gap-2 text-blue-500">
          <SpeakerIcon className="w-5 h-5" />
          <span>Speaking...</span>
          <VoiceWaveform />
        </div>
      )}
      
      {status && !isListening && !isSpeaking && (
        <div className="flex items-center gap-2 text-gray-500">
          <Spinner className="w-4 h-4 animate-spin" />
          <span>{status}</span>
        </div>
      )}
    </div>
  );
}

function VoiceWaveform() {
  return (
    <div className="flex items-center gap-0.5 h-4">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-blue-500 rounded animate-pulse"
          style={{
            height: `${Math.random() * 100}%`,
            animationDelay: `${i * 100}ms`
          }}
        />
      ))}
    </div>
  );
}
```

---

## Error Handling

### WebSocket Reconnection

```typescript
function useWebSocketWithReconnect(url: string) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnects = 5;

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      reconnectAttempts.current = 0;
      setSocket(ws);
    };
    
    ws.onclose = (event) => {
      if (!event.wasClean && reconnectAttempts.current < maxReconnects) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        setTimeout(connect, delay);
      }
    };
    
    ws.onerror = () => {
      // Error will be followed by close, handled above
    };
    
    return ws;
  }, [url]);

  useEffect(() => {
    const ws = connect();
    return () => ws.close();
  }, [connect]);

  return socket;
}
```

### Backend Error Recovery

```python
async def safe_websocket_handler(websocket: WebSocket, session_id: str):
    """WebSocket handler with error recovery."""
    
    try:
        await websocket_chat(websocket, session_id)
    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {session_id}")
    except asyncio.CancelledError:
        logger.debug(f"Task cancelled: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {session_id} - {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "content": "An error occurred. Please try again.",
                "recoverable": True
            })
        except:
            pass  # Connection might be closed
    finally:
        # Cleanup
        voice_manager.disconnect(session_id)
```

### Gemini Native Audio Fallback

```python
class VoiceAdapter:
    async def transcribe(self, audio_bytes: bytes) -> str:
        """Transcribe with fallback."""
        try:
            if self.use_gemini_native:
                # Try Gemini Native Audio first
                return await self._gemini_transcribe(audio_bytes)
        except GeminiAudioNotAvailable:
            logger.warning("Gemini Native Audio unavailable, falling back to STT")
            self.use_gemini_native = False
        
        # Fallback to traditional STT
        return await self._google_stt_transcribe(audio_bytes)
```
