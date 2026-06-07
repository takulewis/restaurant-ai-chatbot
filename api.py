from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_ollama.llms import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage
from vector import retriever, vector_store
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = OllamaLLM(model="llama3.2")

template = """
You are an expert assistant for a pizza restaurant.

Your rules:
- Answer ONLY using the reviews provided below.
- If the reviews do not contain enough information to answer, say exactly:
  "I don't have enough information in the reviews to answer that question."
- Do NOT make up information.
- Keep answers concise and helpful.

Conversation so far:
{history}

Relevant reviews:
{reviews}

Current question: {question}
"""
prompt = ChatPromptTemplate.from_template(template)
chain = prompt | model


class Message(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    question: str
    history: list[Message] = []   # full conversation history from frontend
    min_rating: float | None = None  # Feature 6: optional rating filter


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict]


def format_history(history: list[Message]) -> str:
    """Convert message history to a readable string for the prompt."""
    if not history:
        return "No previous messages."
    lines = []
    for msg in history:
        label = "Student" if msg.role == "user" else "Assistant"
        lines.append(f"{label}: {msg.content}")
    return "\n".join(lines)


def get_sources(question: str, min_rating: float | None) -> tuple:
    """Retrieve docs with optional rating filter (Feature 6)."""
    if min_rating is not None:
        # Filter by minimum rating using ChromaDB metadata filter
        docs = vector_store.similarity_search(
            question,
            k=5,
            filter={"rating": {"$gte": min_rating}}
        )
    else:
        docs = retriever.invoke(question)

    sources = [
        {
            "content": doc.page_content,
            "rating": doc.metadata.get("rating"),
            "date": doc.metadata.get("date"),
        }
        for doc in docs
    ]
    return docs, sources


# ── Streaming endpoint (used by frontend) ──────────────────────────────────
@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    docs, sources = get_sources(request.question, request.min_rating)
    history_str = format_history(request.history)

    def generate():
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
        for chunk in chain.stream({
            "reviews": docs,
            "question": request.question,
            "history": history_str,
        }):
            yield f"data: {json.dumps({'type': 'token', 'token': chunk})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Non-streaming fallback ──────────────────────────────────────────────────
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    docs, sources = get_sources(request.question, request.min_rating)
    history_str = format_history(request.history)
    answer = chain.invoke({
        "reviews": docs,
        "question": request.question,
        "history": history_str,
    })
    return ChatResponse(answer=answer, sources=sources)


@app.get("/health")
async def health():
    return {"status": "ok"}