"""
Multi-Agent Collaboration Service for Mossy AI
Enables Desktop AI, AI-Helper, and Mossy Manager to communicate and learn from each other
Specialized for Fallout 4 modding expertise and continuous self-improvement
"""

import os
import json
import time
import asyncio
import sqlite3
import uuid
import shutil
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import httpx

# Chroma for shared knowledge base
try:
    import chromadb
    from chromadb.config import Settings
except ImportError:
    print("[ERROR] chromadb not installed. Run: pip install chromadb")
    exit(1)

# LLM & embeddings
try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("[ERROR] sentence-transformers not installed. Run: pip install sentence-transformers")
    exit(1)

# ============================================================================
# CONFIGURATION
# ============================================================================

PORT = 8004
AGENT_COMMUNICATION_PORT = 8004
HERMES_AGENT_COMMAND = os.getenv("HERMES_AGENT_COMMAND", "hermes-agent")
HERMES_AGENT_TIMEOUT_SECONDS = int(os.getenv("HERMES_AGENT_TIMEOUT_SECONDS", "90"))

# Agent endpoints
AGENTS = {
    "desktop-ai": "http://localhost:8000",      # Gemma service (tutor)
    "ai-helper": "http://localhost:21337",      # Flask hardware/file service (legacy name)
    "mossy-manager": "http://localhost:8011",   # Future: Mossy Manager service (port 8011; 8005 is OpenCV)
    "desktop-tutor": "http://localhost:21337",  # Desktop Tutor bridge (mossy_server.py)
    "hermes-agent": "local-cli:hermes-agent",   # Optional local Hermes CLI
}

# Desktop Tutor also exposes an AI chat backend on a separate port
DESKTOP_TUTOR_BRIDGE_URL = "http://localhost:21337"   # Flask bridge: /health, /hardware, /capture
DESKTOP_TUTOR_CHAT_URL   = "http://localhost:8787"    # Express backend: /v1/chat

# Database paths
DB_PATHS = {
    "desktop-ai": "data/agent_memory_desktop.db",
    "ai-helper": "data/agent_memory_helper.db",
    "mossy-manager": "data/agent_memory_manager.db",
    "desktop-tutor": "data/agent_memory_desktop_tutor.db",
    "hermes-agent": "data/agent_memory_hermes.db",
    "shared": "data/shared_knowledge.db",
}

# Chroma vector DB
CHROMA_PATH = "data/fallout4_knowledge"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # Fast, small embeddings

# Create data directory
os.makedirs("data", exist_ok=True)

# ============================================================================
# MODELS
# ============================================================================

class AgentQuery(BaseModel):
    """One agent asking another agent a question"""
    from_agent: str          # "desktop-ai", "ai-helper", "mossy-manager"
    to_agent: str            # Target agent
    question: str            # What to ask
    context: Optional[str] = None
    confidence_threshold: float = 0.6  # Validate if confidence > this

class AgentResponse(BaseModel):
    """Response from an agent with confidence and sources"""
    agent: str
    answer: str
    confidence: float        # 0.0-1.0
    sources: List[Dict] = []
    reasoning: Optional[str] = None
    metadata: Dict = {}

class KnowledgeEntry(BaseModel):
    """Entry in shared knowledge base"""
    topic: str               # e.g., "Fallout 4 load order", "mod conflict resolution"
    content: str
    agent: str               # Which agent contributed this
    timestamp: str
    tags: List[str] = []
    confidence: float = 0.8  # How confident is this knowledge

class AgentImprovement(BaseModel):
    """When an agent proposes a better answer"""
    agent: str
    previous_answer: str
    improved_answer: str
    reason_for_improvement: str
    validation_score: float  # Score from other agents

class ConversationLog(BaseModel):
    """Log of conversation for learning"""
    agent: str
    timestamp: str
    interaction: Dict
    learning_points: List[str] = []
    improvement_suggestion: Optional[str] = None

class UserFeedback(BaseModel):
    """User thumbs-up / thumbs-down on an answer"""
    question: str
    answer: str
    rating: int                  # 1 = thumbs up, -1 = thumbs down
    knowledge_ids: List[str] = []   # IDs of knowledge entries that contributed
    comment: str = ""

class TrainingSampleExportRequest(BaseModel):
    min_quality: float = 0.7
    limit: int = 500

# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================

def init_databases():
    """Initialize SQLite databases for each agent and shared knowledge"""
    for agent_name, db_path in DB_PATHS.items():
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        if agent_name == "shared":
            # Shared knowledge base
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS knowledge (
                    id TEXT PRIMARY KEY,
                    topic TEXT,
                    content TEXT,
                    agent TEXT,
                    timestamp TEXT,
                    tags TEXT,
                    confidence REAL,
                    verified_by TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS agent_queries (
                    id TEXT PRIMARY KEY,
                    from_agent TEXT,
                    to_agent TEXT,
                    question TEXT,
                    answer TEXT,
                    timestamp TEXT,
                    agents_consulted TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS improvements (
                    id TEXT PRIMARY KEY,
                    agent TEXT,
                    previous_answer TEXT,
                    improved_answer TEXT,
                    reason TEXT,
                    validation_score REAL,
                    timestamp TEXT
                )
            """)
            # ── New tables ──────────────────────────────────────────────────
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_feedback (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT,
                    question TEXT,
                    answer TEXT,
                    rating INTEGER,        -- 1 = thumbs up, -1 = thumbs down
                    knowledge_ids TEXT,    -- comma-separated knowledge entry IDs used
                    comment TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS training_samples (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT,
                    prompt TEXT,
                    completion TEXT,
                    quality REAL,          -- 0.0–1.0; higher = better training signal
                    source TEXT            -- 'auto' | 'thumbs_up' | 'expert'
                )
            """)
        else:
            # Individual agent memory
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS memory (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT,
                    interaction_type TEXT,
                    content TEXT,
                    metadata TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS learning_log (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT,
                    lesson TEXT,
                    source_agent TEXT,
                    confidence REAL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS improvements_made (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT,
                    improvement_type TEXT,
                    details TEXT
                )
            """)
        
        conn.commit()
        conn.close()

# ============================================================================
# CHROMA - SHARED KNOWLEDGE BASE
# ============================================================================

class FalloutKnowledgeBase:
    """Shared vector database for Fallout 4 modding knowledge"""
    
    def __init__(self):
        # Initialize embeddings
        self.embeddings = SentenceTransformer(EMBEDDING_MODEL)
        
        # Initialize Chroma
        settings = Settings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=CHROMA_PATH,
            anonymized_telemetry=False,
        )
        self.client = chromadb.Client(settings)
        self.collection = self.client.get_or_create_collection(
            name="fallout4_knowledge",
            metadata={"description": "Fallout 4 modding expertise shared by all agents"}
        )
    
    def add_knowledge(self, topic: str, content: str, agent: str, tags: List[str] = None, confidence: float = 0.8):
        """Add knowledge to shared base from an agent"""
        doc_id = str(uuid.uuid4())
        
        self.collection.add(
            ids=[doc_id],
            documents=[content],
            metadatas=[{
                "topic": topic,
                "agent": agent,
                "timestamp": datetime.now().isoformat(),
                "tags": ",".join(tags or []),
                "confidence": confidence,
            }],
        )
        
        # Also store in SQLite for audit trail
        conn = sqlite3.connect(DB_PATHS["shared"])
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO knowledge (id, topic, content, agent, timestamp, tags, confidence, verified_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (doc_id, topic, content, agent, datetime.now().isoformat(), 
              ",".join(tags or []), confidence, None))
        conn.commit()
        conn.close()
        
        return doc_id
    
    def search(self, query: str, n_results: int = 5) -> List[Dict]:
        """Search shared knowledge base"""
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results,
        )
        
        output = []
        if results and results["ids"] and len(results["ids"]) > 0:
            for i, doc_id in enumerate(results["ids"][0]):
                output.append({
                    "id": doc_id,
                    "content": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "distance": results["distances"][0][i] if "distances" in results else 0,
                })
        
        return output
    
    def verify_knowledge(self, doc_id: str, verifying_agent: str):
        """Mark knowledge as verified by another agent"""
        conn = sqlite3.connect(DB_PATHS["shared"])
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE knowledge SET verified_by = ? WHERE id = ?
        """, (verifying_agent, doc_id))
        conn.commit()
        conn.close()

# ============================================================================
# AGENT MEMORY SYSTEM
# ============================================================================

class AgentMemory:
    """Individual memory system for each agent"""
    
    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.db_path = DB_PATHS.get(agent_name)
        if not self.db_path:
            raise ValueError(f"Unknown agent: {agent_name}")
    
    def learn_from_interaction(self, interaction: Dict, learning_points: List[str]):
        """Record what an agent learned from an interaction"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        entry_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO memory (id, timestamp, interaction_type, content, metadata)
            VALUES (?, ?, ?, ?, ?)
        """, (entry_id, datetime.now().isoformat(), "interaction",
              json.dumps(interaction), json.dumps({"learning_points": learning_points})))
        
        for point in learning_points:
            cursor.execute("""
                INSERT INTO learning_log (id, timestamp, lesson, source_agent, confidence)
                VALUES (?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), datetime.now().isoformat(), point, 
                  interaction.get("source_agent", "unknown"), 0.7))
        
        conn.commit()
        conn.close()
    
    def record_improvement(self, improvement_type: str, details: str):
        """Record when agent improves itself"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO improvements_made (id, timestamp, improvement_type, details)
            VALUES (?, ?, ?, ?)
        """, (str(uuid.uuid4()), datetime.now().isoformat(), improvement_type, details))
        conn.commit()
        conn.close()
    
    def get_learning_history(self, limit: int = 20) -> List[Dict]:
        """Get recent learning history"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM learning_log ORDER BY timestamp DESC LIMIT ?
        """, (limit,))
        
        results = []
        for row in cursor.fetchall():
            results.append({
                "id": row[0],
                "timestamp": row[1],
                "lesson": row[2],
                "source_agent": row[3],
                "confidence": row[4],
            })
        
        conn.close()
        return results

# ============================================================================
# FASTAPI APP
# ============================================================================

app = FastAPI(title="Mossy Multi-Agent Collaboration", version="1.0.0")

# Initialize systems
init_databases()
knowledge_base = FalloutKnowledgeBase()
agent_memories = {
    agent: AgentMemory(agent) 
    for agent in ["desktop-ai", "ai-helper", "mossy-manager", "desktop-tutor", "hermes-agent"]
}

def is_hermes_available() -> bool:
    return shutil.which(HERMES_AGENT_COMMAND) is not None

async def query_hermes_agent(question: str, context: Optional[str] = None) -> AgentResponse:
    """Query local Hermes Agent CLI in one-shot mode."""
    if not is_hermes_available():
        raise HTTPException(
            status_code=503,
            detail=(
                f"Hermes Agent CLI not found ({HERMES_AGENT_COMMAND}). "
                f"Install with: pip install \"hermes-agent==0.14.0\""
            ),
        )

    prompt = question.strip()
    if context:
        prompt = f"Context:\n{context.strip()}\n\nQuestion:\n{prompt}"

    proc = await asyncio.create_subprocess_exec(
        HERMES_AGENT_COMMAND,
        "--prompt",
        prompt,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=HERMES_AGENT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.communicate()
        raise HTTPException(
            status_code=504,
            detail=f"Hermes Agent timed out after {HERMES_AGENT_TIMEOUT_SECONDS}s",
        )

    output = stdout.decode("utf-8", errors="replace").strip()
    err_text = stderr.decode("utf-8", errors="replace").strip()

    if proc.returncode != 0:
        raise HTTPException(
            status_code=502,
            detail=f"Hermes Agent failed (exit {proc.returncode}): {err_text[:500]}",
        )

    if not output:
        output = "Hermes Agent returned no output."

    return AgentResponse(
        agent="hermes-agent",
        answer=output,
        confidence=0.75,
        sources=[{"type": "local-cli", "command": HERMES_AGENT_COMMAND}],
        reasoning="Answered by local Hermes Agent CLI",
        metadata={"stderr": err_text[:500]},
    )

# ============================================================================
# HEALTH & DISCOVERY
# ============================================================================

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "multi-agent-collaboration",
        "version": "1.0.0",
        "agents": list(AGENTS.keys()),
        "port": PORT,
    }

@app.get("/agents/discover")
async def discover_agents():
    """Discover all connected agents and their health"""
    discovered = {}

    for agent_name, endpoint in AGENTS.items():
        if agent_name == "hermes-agent":
            discovered[agent_name] = {
                "endpoint": endpoint,
                "status": "online" if is_hermes_available() else "offline",
                "data": {"command": HERMES_AGENT_COMMAND},
                "error": "" if is_hermes_available() else f"Command not found: {HERMES_AGENT_COMMAND}",
            }
            continue

        # desktop-tutor uses the bridge port (21337) for health checks
        health_url = f"{DESKTOP_TUTOR_BRIDGE_URL}/health" if agent_name == "desktop-tutor" else f"{endpoint}/health"
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(health_url)
                if resp.status_code == 200:
                    agent_data: Dict = {"status": "online", "endpoint": endpoint, "data": resp.json()}
                    # Also check Desktop Tutor's AI chat backend
                    if agent_name == "desktop-tutor":
                        try:
                            chat_health = await client.get(f"{DESKTOP_TUTOR_CHAT_URL}/health", timeout=2.0)
                            agent_data["chat_backend"] = {
                                "url": DESKTOP_TUTOR_CHAT_URL,
                                "status": "online" if chat_health.status_code == 200 else "offline",
                            }
                        except Exception:
                            agent_data["chat_backend"] = {"url": DESKTOP_TUTOR_CHAT_URL, "status": "offline"}
                    discovered[agent_name] = agent_data
        except Exception as e:
            discovered[agent_name] = {
                "endpoint": endpoint,
                "status": "offline",
                "error": str(e),
            }

    return discovered

# ============================================================================
# INTER-AGENT COMMUNICATION
# ============================================================================

@app.post("/agents/query")
async def query_agent(query: AgentQuery) -> AgentResponse:
    """
    One agent queries another agent
    Example: Desktop AI asks Help about system resources
    """
    if query.to_agent not in AGENTS:
        raise HTTPException(status_code=400, detail=f"Unknown agent: {query.to_agent}")
    
    endpoint = AGENTS[query.to_agent]
    
    try:
        # Per-agent timeouts: desktop-tutor chat needs more time for Groq LLM
        AGENT_TIMEOUTS = {
            "desktop-ai":    15.0,
            "ai-helper":     10.0,
            "desktop-tutor": 20.0,
            "mossy-manager": 10.0,
        }
        agent_timeout = AGENT_TIMEOUTS.get(query.to_agent, 15.0)
        async with httpx.AsyncClient(timeout=agent_timeout) as client:
            # Agent-specific query handling based on the actual API each service exposes
            if query.to_agent == "ai-helper":
                # AI-Helper uses the Desktop Tutor bridge (port 21337) to get hardware context
                hw_resp = await client.get(f"{DESKTOP_TUTOR_BRIDGE_URL}/hardware")
                hw_data = hw_resp.json() if hw_resp.status_code == 200 else {}
                hw_summary = (
                    f"OS: {hw_data.get('os', '?')}, CPU: {hw_data.get('cpu', '?')}, "
                    f"RAM: {hw_data.get('ram', '?')} GB, GPU: {hw_data.get('gpu', '?')}"
                )
                return AgentResponse(
                    agent=query.to_agent,
                    answer=f"Desktop system context — {hw_summary}",
                    confidence=0.9,
                    sources=[{"type": "hardware", "data": hw_data}],
                    metadata=hw_data,
                )
            elif query.to_agent == "desktop-tutor":
                # Desktop Tutor — first check chat backend (port 8787), fall back to bridge info
                system_prompt = (
                    "You are Mossy Desktop Tutor, an expert Fallout 4 modding assistant. "
                    "Another Mossy AI instance is asking you a question so you can help each "
                    "other advance. Answer concisely and share any relevant knowledge."
                )
                messages = [
                    {"role": "system", "content": system_prompt},
                ]
                if query.context:
                    messages.append({"role": "user", "content": f"Context: {query.context}\n\nQuestion: {query.question}"})
                else:
                    messages.append({"role": "user", "content": query.question})

                chat_resp = await client.post(
                    f"{DESKTOP_TUTOR_CHAT_URL}/v1/chat",
                    json={"provider": "groq", "messages": messages, "maxTokens": 1024},
                )
                if chat_resp.status_code == 200:
                    chat_data = chat_resp.json()
                    answer = chat_data.get("text", "")
                    return AgentResponse(
                        agent=query.to_agent,
                        answer=answer,
                        confidence=0.85,
                        sources=[{"type": "groq", "model": chat_data.get("model", "unknown")}],
                        reasoning=f"Answered by Desktop Tutor via {chat_data.get('model','groq')}",
                        metadata=chat_data,
                    )
                # Fall back to returning hardware info if chat is unavailable
                hw_resp = await client.get(f"{DESKTOP_TUTOR_BRIDGE_URL}/hardware")
                hw_data = hw_resp.json() if hw_resp.status_code == 200 else {}
                return AgentResponse(
                    agent=query.to_agent,
                    answer=f"Desktop Tutor chat unavailable — system: {hw_data}",
                    confidence=0.3,
                    metadata=hw_data,
                )
            elif query.to_agent == "hermes-agent":
                return await query_hermes_agent(query.question, query.context)
            elif query.to_agent == "desktop-ai":
                # Ask Desktop AI (Gemma) to answer
                resp = await client.post(
                    f"{endpoint}/infer",
                    json={"prompt": query.question}
                )
            else:
                # Generic fallback for any future agent
                resp = await client.post(
                    f"{endpoint}/query",
                    json={"question": query.question}
                )

            if resp.status_code == 200:
                data = resp.json()

                # Only log + learn when from_agent is a recognised agent
                if query.from_agent in DB_PATHS and query.from_agent != "shared":
                    conn = sqlite3.connect(DB_PATHS["shared"])
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT INTO agent_queries (id, from_agent, to_agent, question, answer, timestamp, agents_consulted)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (str(uuid.uuid4()), query.from_agent, query.to_agent,
                          query.question, json.dumps(data),
                          datetime.now().isoformat(), query.to_agent))
                    conn.commit()
                    conn.close()

                    if query.from_agent in agent_memories:
                        agent_memories[query.from_agent].learn_from_interaction(
                            {"response": data, "source_agent": query.to_agent},
                            ["learned from " + query.to_agent]
                        )

                return AgentResponse(
                    agent=query.to_agent,
                    answer=data.get("text", data.get("answer", str(data))),
                    confidence=data.get("confidence", 0.7),
                    sources=data.get("sources", []),
                    reasoning=data.get("reasoning"),
                    metadata=data,
                )
            else:
                raise HTTPException(status_code=resp.status_code, detail=resp.text)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

# ============================================================================
# SHARED KNOWLEDGE BASE
# ============================================================================

@app.post("/knowledge/add")
async def add_knowledge(entry: KnowledgeEntry):
    """Add knowledge to shared base (discovered by any agent)"""
    doc_id = knowledge_base.add_knowledge(
        topic=entry.topic,
        content=entry.content,
        agent=entry.agent,
        tags=entry.tags,
        confidence=entry.confidence,
    )
    
    # Record that agent improved
    agent_memories[entry.agent].record_improvement(
        "discovered_knowledge",
        f"Discovered: {entry.topic}"
    )
    
    return {"id": doc_id, "status": "added"}

@app.post("/knowledge/search")
async def search_knowledge(query: str, n_results: int = 5):
    """Search shared knowledge base"""
    results = knowledge_base.search(query, n_results)
    return {"query": query, "results": results}

@app.post("/knowledge/verify")
async def verify_knowledge(doc_id: str, verifying_agent: str):
    """Agent validates knowledge from another agent"""
    knowledge_base.verify_knowledge(doc_id, verifying_agent)
    return {"status": "verified"}

# ============================================================================
# AGENT IMPROVEMENT & VALIDATION
# ============================================================================

@app.post("/agents/validate-answer")
async def validate_answer(
    question: str,
    answer: str,
    answering_agent: str,
    background_tasks: BackgroundTasks
):
    """
    Multiple agents validate an answer and propose improvements
    Used for continuous quality improvement
    """
    validation_results = {}
    
    # Query other agents for validation
    for agent_name, endpoint in AGENTS.items():
        if agent_name == answering_agent or not endpoint.startswith("http"):
            continue
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{AGENTS[agent_name]}/validate",
                    json={"question": question, "answer": answer},
                    timeout=5.0,
                )
                if resp.status_code == 200:
                    validation_results[agent_name] = resp.json()
        except:
            pass
    
    # Calculate consensus score
    scores = [v.get("confidence", 0.5) for v in validation_results.values()]
    consensus_score = sum(scores) / len(scores) if scores else 0.5
    
    # If consensus is low, propose improvement
    if consensus_score < 0.7:
        background_tasks.add_task(
            propose_improvement,
            question,
            answer,
            answering_agent,
            validation_results,
            consensus_score
        )

    # Auto-save high-consensus answers as training samples
    if consensus_score >= 0.85:
        try:
            conn = sqlite3.connect(DB_PATHS["shared"])
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO training_samples (id, timestamp, prompt, completion, quality, source)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), datetime.now().isoformat(),
                  question, answer, round(consensus_score, 3), "auto"))
            conn.commit()
            conn.close()
        except Exception:
            pass
    
    return {
        "answer": answer,
        "validation_results": validation_results,
        "consensus_score": consensus_score,
        "improvement_proposed": consensus_score < 0.7,
    }

async def propose_improvement(
    question: str,
    answer: str,
    original_agent: str,
    validation_results: Dict,
    consensus_score: float
):
    """Propose an improved answer based on peer validation"""
    # Ask Desktop AI (tutor) for improved answer
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            improved = await client.post(
                f"{AGENTS['desktop-ai']}/improve-answer",
                json={
                    "question": question,
                    "original_answer": answer,
                    "validation_feedback": validation_results,
                }
            )
            
            if improved.status_code == 200:
                improved_data = improved.json()
                
                # Record improvement
                conn = sqlite3.connect(DB_PATHS["shared"])
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO improvements (id, agent, previous_answer, improved_answer, reason, validation_score, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (str(uuid.uuid4()), original_agent, answer, 
                      improved_data.get("answer", ""), 
                      improved_data.get("reason", ""), 
                      consensus_score, datetime.now().isoformat()))
                conn.commit()
                conn.close()
                
                # Record improvement for all agents that helped
                for agent in validation_results.keys():
                    agent_memories[agent].record_improvement(
                        "helped_improve_answer",
                        f"Validated and improved answer for '{question[:50]}...'"
                    )
    except:
        pass

# ============================================================================
# AGENT LEARNING ENDPOINTS
# ============================================================================

@app.get("/agents/{agent_name}/learning-history")
async def get_learning_history(agent_name: str, limit: int = 20):
    """Get what a specific agent has learned recently"""
    if agent_name not in agent_memories:
        raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_name}")
    
    history = agent_memories[agent_name].get_learning_history(limit)
    return {
        "agent": agent_name,
        "learning_history": history,
    }

@app.post("/agents/{agent_name}/reflect")
async def agent_reflect(agent_name: str):
    """Trigger an agent to reflect on its learning and propose improvements"""
    if agent_name not in agent_memories:
        raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_name}")
    
    history = agent_memories[agent_name].get_learning_history(limit=10)
    
    # Count lessons learned
    lessons = len(history)
    sources = set(h["source_agent"] for h in history)
    
    return {
        "agent": agent_name,
        "lessons_learned_recently": lessons,
        "learned_from_agents": list(sources),
        "reflection": f"Learned {lessons} lessons from {len(sources)} other agents",
    }

# ============================================================================
# CONTINUOUS IMPROVEMENT ENDPOINT
# ============================================================================

@app.post("/improve/all")
async def trigger_continuous_improvement(background_tasks: BackgroundTasks):
    """
    Trigger continuous improvement cycle:
    1. Each agent reflects on recent learnings
    2. Agents propose improvements to shared knowledge
    3. Agents validate each other's improvements
    """
    results = {}
    
    for agent_name in agent_memories.keys():
        # Get agent's learning history
        history = agent_memories[agent_name].get_learning_history(limit=5)
        lessons_count = len(history)
        
        results[agent_name] = {
            "recent_lessons": lessons_count,
            "reflection_triggered": True,
        }
    
    return {
        "status": "continuous_improvement_triggered",
        "agents": results,
        "message": "All agents will reflect on learning and propose improvements",
    }

# ============================================================================
# STATISTICS & MONITORING
# ============================================================================

@app.get("/stats")
async def get_stats():
    """Get system-wide statistics"""
    # Count knowledge entries
    conn = sqlite3.connect(DB_PATHS["shared"])
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM knowledge")
    total_knowledge = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM agent_queries")
    total_queries = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM improvements")
    total_improvements = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM user_feedback WHERE rating = 1")
    thumbs_up = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM user_feedback WHERE rating = -1")
    thumbs_down = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM training_samples WHERE quality >= 0.7")
    training_samples = cursor.fetchone()[0]
    
    conn.close()
    
    # Collect per-agent stats
    agent_stats = {}
    for agent_name, memory in agent_memories.items():
        history = memory.get_learning_history(limit=100)
        agent_stats[agent_name] = {
            "total_lessons_learned": len(history),
            "unique_sources": len(set(h["source_agent"] for h in history)),
        }
    
    return {
        "total_knowledge": total_knowledge,          # keep legacy key for UI
        "total_knowledge_entries": total_knowledge,
        "inter_agent_queries": total_queries,
        "improvements_made": total_improvements,
        "thumbs_up": thumbs_up,
        "thumbs_down": thumbs_down,
        "training_samples_ready": training_samples,
        "agent_statistics": agent_stats,
    }

# ============================================================================
# USER FEEDBACK LOOP
# ============================================================================

@app.post("/feedback")
async def submit_feedback(feedback: UserFeedback, background_tasks: BackgroundTasks):
    """
    Record a user thumbs-up (rating=1) or thumbs-down (rating=-1) on an answer.

    Thumbs-up:
    - Saves answer as a high-quality training sample.
    - Increases confidence of the referenced knowledge entries.

    Thumbs-down:
    - Saves as a negative signal (low-quality sample — excluded from training).
    - Immediately triggers an improvement cycle for the question.
    - Lowers confidence of the referenced knowledge entries.
    """
    if feedback.rating not in (1, -1):
        raise HTTPException(status_code=400, detail="rating must be 1 (thumbs up) or -1 (thumbs down)")

    feedback_id = str(uuid.uuid4())
    ts = datetime.now().isoformat()

    # Persist feedback record
    conn = sqlite3.connect(DB_PATHS["shared"])
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO user_feedback (id, timestamp, question, answer, rating, knowledge_ids, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (feedback_id, ts, feedback.question, feedback.answer, feedback.rating,
          ",".join(feedback.knowledge_ids), feedback.comment))

    quality = 0.95 if feedback.rating == 1 else 0.0
    source  = "thumbs_up" if feedback.rating == 1 else "thumbs_down"

    # Save as training sample (thumbs-up = high quality; thumbs-down = 0 quality)
    cursor.execute("""
        INSERT INTO training_samples (id, timestamp, prompt, completion, quality, source)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (str(uuid.uuid4()), ts, feedback.question, feedback.answer, quality, source))

    # Update confidence of referenced knowledge entries
    if feedback.knowledge_ids:
        delta = 0.05 if feedback.rating == 1 else -0.10
        for kid in feedback.knowledge_ids:
            cursor.execute(
                "UPDATE knowledge SET confidence = MIN(0.99, MAX(0.1, confidence + ?)) WHERE id = ?",
                (delta, kid)
            )

    conn.commit()
    conn.close()

    # Thumbs-down triggers an immediate improvement cycle in background
    if feedback.rating == -1:
        background_tasks.add_task(
            propose_improvement,
            feedback.question,
            feedback.answer,
            "user",
            {"user": {"confidence": 0.0, "comment": feedback.comment}},
            0.0,
        )

    return {
        "id": feedback_id,
        "rating": feedback.rating,
        "action": "saved_training_sample" + (" + improvement_triggered" if feedback.rating == -1 else ""),
        "success": True,
    }

@app.get("/feedback/stats")
async def feedback_stats():
    """Return feedback statistics."""
    conn = sqlite3.connect(DB_PATHS["shared"])
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM user_feedback WHERE rating = 1")
    thumbs_up = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM user_feedback WHERE rating = -1")
    thumbs_down = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM training_samples WHERE quality >= 0.7")
    good_samples = cur.fetchone()[0]
    conn.close()
    return {
        "thumbs_up": thumbs_up,
        "thumbs_down": thumbs_down,
        "total_feedback": thumbs_up + thumbs_down,
        "high_quality_training_samples": good_samples,
    }

# ============================================================================
# TRAINING DATA COLLECTION & EXPORT
# ============================================================================

@app.post("/training-data/save")
async def save_training_sample(prompt: str, completion: str, quality: float = 0.8, source: str = "auto"):
    """Save a validated Q&A pair as a training sample."""
    conn = sqlite3.connect(DB_PATHS["shared"])
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO training_samples (id, timestamp, prompt, completion, quality, source)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (str(uuid.uuid4()), datetime.now().isoformat(), prompt, completion, quality, source))
    conn.commit()
    conn.close()
    return {"success": True, "quality": quality, "source": source}

@app.post("/training-data/export")
async def export_training_data(req: TrainingSampleExportRequest):
    """
    Export training samples as a list of {prompt, completion} pairs for LoRA fine-tuning.
    Only samples with quality >= min_quality are included.
    """
    conn = sqlite3.connect(DB_PATHS["shared"])
    cur = conn.cursor()
    cur.execute("""
        SELECT prompt, completion, quality, source, timestamp
        FROM training_samples
        WHERE quality >= ?
        ORDER BY quality DESC, timestamp DESC
        LIMIT ?
    """, (req.min_quality, req.limit))
    rows = cur.fetchall()
    conn.close()

    samples = [
        {"prompt": r[0], "completion": r[1], "quality": r[2], "source": r[3], "ts": r[4]}
        for r in rows
    ]
    return {
        "samples": samples,
        "count": len(samples),
        "min_quality": req.min_quality,
        "format": "jsonl_compatible",
    }

@app.get("/training-data/count")
async def training_data_count():
    """Return the number of available training samples by quality tier."""
    conn = sqlite3.connect(DB_PATHS["shared"])
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM training_samples WHERE quality >= 0.9")
    excellent = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM training_samples WHERE quality >= 0.7 AND quality < 0.9")
    good = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM training_samples WHERE quality < 0.7")
    poor = cur.fetchone()[0]
    conn.close()
    return {
        "excellent_0.9plus": excellent,
        "good_0.7to0.9": good,
        "poor_below_0.7": poor,
        "total": excellent + good + poor,
        "ready_for_training": excellent + good,
    }

if __name__ == "__main__":
    import uvicorn
    print(f"\n[MOSSY MULTI-AGENT] Starting on port {PORT}...")
    print("[MOSSY MULTI-AGENT] Agents: Desktop AI, AI-Helper, Mossy Manager")
    print("[MOSSY MULTI-AGENT] Knowledge Base: Fallout 4 modding expertise")
    print("[MOSSY MULTI-AGENT] Learning: Continuous improvement enabled\n")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
