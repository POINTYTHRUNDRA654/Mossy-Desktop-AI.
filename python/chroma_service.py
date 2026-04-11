#!/usr/bin/env python3
"""
Chroma Vector Database Service
Provides semantic search and knowledge base storage with embeddings.
Runs as FastAPI service on port 8003.
Integrates with LlamaIndex for document ingestion.
"""

import os
import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
import uuid
import asyncio

import uvicorn
from fastapi import FastAPI, HTTPException, File, UploadFile
from pydantic import BaseModel
import chromadb
from chromadb.config import Settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Chroma Vector Database Service", version="1.0.0")

# ────────────────────────────────────────────────────────────────────────────
# Configuration
# ────────────────────────────────────────────────────────────────────────────

CHROMA_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "chroma_db")
os.makedirs(CHROMA_DB_PATH, exist_ok=True)

# Global Chroma client and collections
chroma_client = None
collections = {}
default_collection = "mossy_knowledge_base"

# ────────────────────────────────────────────────────────────────────────────
# Pydantic Models
# ────────────────────────────────────────────────────────────────────────────

class Document(BaseModel):
    id: Optional[str] = None
    text: str
    metadata: Optional[Dict[str, Any]] = None
    source: Optional[str] = None

class SearchQuery(BaseModel):
    query: str
    collection: Optional[str] = default_collection
    n_results: Optional[int] = 5
    metadata_filter: Optional[Dict[str, Any]] = None

class SearchResult(BaseModel):
    id: str
    text: str
    distance: float
    metadata: Dict[str, Any]

class HealthStatus(BaseModel):
    status: str
    collections_count: int
    db_path: str

# ────────────────────────────────────────────────────────────────────────────
# Service Initialization
# ────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Initialize Chroma client on startup"""
    global chroma_client, collections
    try:
        logger.info(f"Initializing Chroma with persistent storage at {CHROMA_DB_PATH}")
        
        # Create Chroma client with persistent storage
        settings = Settings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=CHROMA_DB_PATH,
            anonymized_telemetry=False
        )
        
        chroma_client = chromadb.Client(settings)
        
        # Get or create default collection with embedding function
        # Chroma defaults to all-MiniLM-L6-v2 embeddings (384 dimensions)
        collections[default_collection] = chroma_client.get_or_create_collection(
            name=default_collection,
            metadata={"hnsw:space": "cosine"}
        )
        
        logger.info("Chroma client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Chroma: {e}")
        raise

# ────────────────────────────────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthStatus)
async def health_check():
    """Check service health"""
    return HealthStatus(
        status="healthy" if chroma_client else "unhealthy",
        collections_count=len(collections),
        db_path=CHROMA_DB_PATH
    )

@app.post("/add-document")
async def add_document(document: Document):
    """Add a document to the knowledge base"""
    if not chroma_client:
        raise HTTPException(status_code=503, detail="Chroma client not initialized")
    
    try:
        collection = collections.get(default_collection)
        if not collection:
            raise HTTPException(status_code=500, detail="Default collection not found")
        
        doc_id = document.id or str(uuid.uuid4())
        metadata = document.metadata or {}
        if document.source:
            metadata["source"] = document.source
        
        collection.add(
            ids=[doc_id],
            documents=[document.text],
            metadatas=[metadata]
        )
        
        logger.info(f"Document added: {doc_id}")
        return {"success": True, "id": doc_id}
    except Exception as e:
        logger.error(f"Failed to add document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/add-documents")
async def add_documents(documents: List[Document]):
    """Add multiple documents to the knowledge base"""
    if not chroma_client:
        raise HTTPException(status_code=503, detail="Chroma client not initialized")
    
    try:
        collection = collections.get(default_collection)
        if not collection:
            raise HTTPException(status_code=500, detail="Default collection not found")
        
        ids = []
        texts = []
        metadatas = []
        
        for doc in documents:
            doc_id = doc.id or str(uuid.uuid4())
            ids.append(doc_id)
            texts.append(doc.text)
            
            metadata = doc.metadata or {}
            if doc.source:
                metadata["source"] = doc.source
            metadatas.append(metadata)
        
        collection.add(ids=ids, documents=texts, metadatas=metadatas)
        
        logger.info(f"Added {len(documents)} documents")
        return {"success": True, "count": len(documents), "ids": ids}
    except Exception as e:
        logger.error(f"Failed to add documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search", response_model=List[SearchResult])
async def search(query: SearchQuery):
    """Search knowledge base by semantic similarity"""
    if not chroma_client:
        raise HTTPException(status_code=503, detail="Chroma client not initialized")
    
    try:
        collection = collections.get(query.collection, collections.get(default_collection))
        if not collection:
            raise HTTPException(status_code=400, detail=f"Collection not found: {query.collection}")
        
        # Query collection
        results = collection.query(
            query_texts=[query.query],
            n_results=query.n_results,
            where=query.metadata_filter if query.metadata_filter else None
        )
        
        # Format results
        search_results = []
        if results and results["ids"] and len(results["ids"]) > 0:
            for i, doc_id in enumerate(results["ids"][0]):
                search_results.append(SearchResult(
                    id=doc_id,
                    text=results["documents"][0][i],
                    distance=results["distances"][0][i] if results["distances"] else 0.0,
                    metadata=results["metadatas"][0][i] if results["metadatas"] else {}
                ))
        
        logger.info(f"Search query returned {len(search_results)} results")
        return search_results
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/collection/{collection_name}")
async def get_collection_stats(collection_name: str = default_collection):
    """Get collection statistics"""
    if not chroma_client:
        raise HTTPException(status_code=503, detail="Chroma client not initialized")
    
    try:
        collection = collections.get(collection_name, collections.get(default_collection))
        if not collection:
            raise HTTPException(status_code=400, detail=f"Collection not found: {collection_name}")
        
        count = collection.count()
        return {
            "name": collection_name,
            "document_count": count,
            "metadata": collection.metadata
        }
    except Exception as e:
        logger.error(f"Failed to get collection stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/document/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a document from the knowledge base"""
    if not chroma_client:
        raise HTTPException(status_code=503, detail="Chroma client not initialized")
    
    try:
        collection = collections.get(default_collection)
        if not collection:
            raise HTTPException(status_code=500, detail="Default collection not found")
        
        collection.delete(ids=[doc_id])
        logger.info(f"Document deleted: {doc_id}")
        return {"success": True, "id": doc_id}
    except Exception as e:
        logger.error(f"Failed to delete document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/clear")
async def clear_collection(collection: str = default_collection):
    """Clear all documents from a collection"""
    if not chroma_client:
        raise HTTPException(status_code=503, detail="Chroma client not initialized")
    
    try:
        coll = collections.get(collection)
        if not coll:
            raise HTTPException(status_code=400, detail=f"Collection not found: {collection}")
        
        # Delete and recreate collection
        chroma_client.delete_collection(name=collection)
        collections[collection] = chroma_client.get_or_create_collection(
            name=collection,
            metadata={"hnsw:space": "cosine"}
        )
        return {"success": True, "collection": collection}
    except Exception as e:
        logger.error(f"Failed to clear collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/collections")
async def list_collections():
    """List all collections"""
    try:
        all_collections = chroma_client.list_collections() if chroma_client else []
        return {
            "collections": [c.name for c in all_collections],
            "count": len(all_collections)
        }
    except Exception as e:
        logger.error(f"Failed to list collections: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    logger.info("Starting Chroma Vector Database Service on port 8003")
    uvicorn.run(app, host="127.0.0.1", port=8003, log_level="info")
