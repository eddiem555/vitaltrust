from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class ChatRequest(BaseModel):
    message: str

@app.get("/health")
def health():
    return {"status": "aibroker_healthy", "mcp_ready": True}

@app.post("/mcp/chat")
def mcp_chat(request: ChatRequest):
    return {
        "response": f"Agent on aibroker received: {request.message}. Tool calling initiated.",
        "status": "Safe"
    }
