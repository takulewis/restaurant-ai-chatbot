from langchain_ollama.llms import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage
from vector import get_retriever

model = OllamaLLM(model="llama3.2")

template = """
You are a helpful expert assistant for a pizza restaurant.

{context_instruction}

Conversation so far:
{history}

Current question: {question}
"""
prompt = ChatPromptTemplate.from_template(template)
chain = prompt | model

NO_DOCS_INSTRUCTION = (
    "You do not have any relevant restaurant reviews for this question. "
    "Politely tell the user you don't have that information and suggest they "
    "ask about the menu, service, or atmosphere instead."
)

# ── Conversation memory ───────────────────────────────────────────────────────
conversation_history: list[HumanMessage | AIMessage] = []


def format_history(messages: list) -> str:
    if not messages:
        return "(no previous messages)"
    lines = []
    for msg in messages:
        role = "User" if isinstance(msg, HumanMessage) else "Assistant"
        lines.append(f"{role}: {msg.content}")
    return "\n".join(lines)


# ── CLI loop ──────────────────────────────────────────────────────────────────
print("Pizza Restaurant Q&A")
print("Commands: 'q' to quit | 'clear' to reset memory | 'filter <min>-<max>' to filter by rating")
print("Example: filter 4-5  → only use 4★ and 5★ reviews\n")

min_rating: int | None = None
max_rating: int | None = None

while True:
    print("-------------------------------")
    question = input("Ask your question: ").strip()
    print()

    if question.lower() == "q":
        break

    if question.lower() == "clear":
        conversation_history.clear()
        min_rating = None
        max_rating = None
        print("Memory and filters cleared.\n")
        continue

    if question.lower().startswith("filter "):
        parts = question[7:].split("-")
        try:
            min_rating = int(parts[0]) if parts[0] else None
            max_rating = int(parts[1]) if len(parts) > 1 and parts[1] else None
            print(f"Rating filter set: min={min_rating}, max={max_rating}\n")
        except ValueError:
            print("Invalid filter format. Use: filter <min>-<max>  e.g. filter 4-5\n")
        continue

    # Retrieve with active filter
    retriever = get_retriever(min_rating=min_rating, max_rating=max_rating)
    reviews = retriever.invoke(question)

    if reviews:
        context_instruction = (
            "Use the following relevant reviews to answer the question:\n"
            + "\n---\n".join(doc.page_content for doc in reviews)
        )
    else:
        context_instruction = NO_DOCS_INSTRUCTION

    history_text = format_history(conversation_history)

    result = chain.invoke(
        {
            "context_instruction": context_instruction,
            "history": history_text,
            "question": question,
        }
    )

    print(result)

    # Store turn in memory (keep last 10 turns = 20 messages)
    conversation_history.append(HumanMessage(content=question))
    conversation_history.append(AIMessage(content=result))
    if len(conversation_history) > 20:
        conversation_history[:] = conversation_history[-20:]