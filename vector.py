from langchain_ollama import OllamaEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
import os
import pandas as pd

df = pd.read_csv("realistic_restaurant_reviews.csv")
embeddings = OllamaEmbeddings(model="mxbai-embed-large")

db_location = "./chrome_langchain_db"
add_documents = not os.path.exists(db_location)

if add_documents:
    documents = []
    ids = []

    for i, row in df.iterrows():
        document = Document(
            page_content=row["Title"] + " " + row["Review"],
            metadata={"rating": row["Rating"], "date": row["Date"]},
            id=str(i),
        )
        ids.append(str(i))
        documents.append(document)

vector_store = Chroma(
    collection_name="restaurant_reviews",
    persist_directory=db_location,
    embedding_function=embeddings,
)

if add_documents:
    vector_store.add_documents(documents=documents, ids=ids)

# Default retriever (no filter) — used when no rating filter is supplied
retriever = vector_store.as_retriever(search_kwargs={"k": 5})


def get_retriever(min_rating: int | None = None, max_rating: int | None = None):
    """
    Return a retriever, optionally filtered by rating range.

    Example
    -------
    get_retriever(min_rating=4)          # only 4-star and 5-star reviews
    get_retriever(min_rating=1, max_rating=2)  # only poor reviews
    get_retriever()                      # all reviews (same as module-level `retriever`)
    """
    if min_rating is None and max_rating is None:
        return retriever  # fast path — no filter overhead

    where_clause: dict = {}
    if min_rating is not None and max_rating is not None:
        where_clause = {
            "$and": [
                {"rating": {"$gte": min_rating}},
                {"rating": {"$lte": max_rating}},
            ]
        }
    elif min_rating is not None:
        where_clause = {"rating": {"$gte": min_rating}}
    else:
        where_clause = {"rating": {"$lte": max_rating}}

    return vector_store.as_retriever(
        search_kwargs={"k": 5, "filter": where_clause}
    )