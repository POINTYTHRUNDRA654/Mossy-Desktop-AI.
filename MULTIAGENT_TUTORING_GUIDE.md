# Multi-Agent Fallout 4 Tutoring System

**Mossy AI Triple Integration**: Three specialized AI agents work together to become the most advanced Fallout 4 modding tutor.

---

## 🧠 The Three Agents

### 1. **Mossy-Desktop-AI** (Main Tutor) — Port 8000
**Role**: Fallout 4 modding expertise, reasoning chains, user-facing tutor
- Uses Gemma 4 fine-tuned on modding knowledge
- Synthesizes answers from all agents
- Delivers polished educational responses
- LangChain: Multi-step reasoning chains
- LlamaIndex: RAG over Fallout 4 documentation

**Specializations**:
- Load order theory and practice
- Mod compatibility and conflict resolution
- Texture optimization
- Script lag diagnosis
- ENB and shader integration

### 2. **AI-Helper** (System Executor) — Port 21337
**Role**: File system explorer, mod discovery, system-level knowledge
- Scans disk for installed mods
- Reads mod files, configs, documentation
- Identifies mod versions and dependencies
- Monitors system resources (VRAM, CPU)
- Real-time file watching

**Specializations**:
- What mods are actually installed
- Real mod conflicts (by scanning files)
- Performance issues (via system monitoring)
- Unknown mod identification
- File-based evidence gathering

### 3. **Mossy Manager** (Mod Expert) — Port 8005 *(Future)*
**Role**: Load order expertise, conflict patterns, proven solutions
- Manages Mod Organizer 2 directly
- Understands load order deeply
- Knows proven mod combinations
- Detects ESM/ESP arrangement problems
- Has access to mod database

**Specializations**:
- ESM/ESP load order rules
- Known conflicts + solutions
- Master file dependencies
- Load order validation
- Plugin limit workarounds (merging, batching)

---

## 🔄 How They Work Together

### Example: User Asks "Why Do My Textures Look Broken?"

**Flow**:
1. **User** → Desktop AI (main tutor)
2. **Desktop AI** → Asks AI-Helper: "What's this person's GPU? How much VRAM?"
3. **AI-Helper** → Returns: "RTX 4090, 24GB VRAM"
4. **Desktop AI** → Asks Mossy Manager: "Any known texture mod conflicts?"
5. **Mossy Manager** → Returns: "Loading Cathedral Assets Optimizer after texture mods"
6. **Synthesis**: Desktop AI composes answer:
   - "Broken textures usually mean missing DDS or compression issue"
   - "With your 24GB VRAM, you can use 2K textures safely"
   - "Make sure Cathedral Assets Optimizer loads AFTER all texture mods"
7. **All agents validate** the answer
8. **All agents learn** from the interaction

---

## 📚 Shared Knowledge Base (Chroma)

All three agents share a unified vector database with Fallout 4 knowledge:

**Bootstrap Topics** (8 expert entries):
- Mod Load Order Basics
- FOMOD Installation
- Texture Quality vs Performance
- Merging and Batching
- Conflict Resolution
- Custom Patches & Compatibility
- ENB & Shader Mods
- Script Lag & Optimization

**Growth**: Each time an agent discovers something, it's added to shared knowledge.

**Verification**: When multiple agents agree on knowledge, it's marked as verified.

---

## 🧠 Individual Agent Memory

Each agent maintains **separate SQLite databases** to learn independently:

### Desktop-AI Memory
```
learning_log table:
- Each Fallout 4 lesson learned
- Confidence scores
- Source: which other agent taught it
```

### AI-Helper Memory
```
learning_log table:
- System scanning techniques
- File identification patterns
- Real-world mod problems discovered
```

### Mossy Manager Memory
```
learning_log table:
- Load order problem patterns
- Successful conflict solutions
- ESM/ESP arrangement tips
```

---

## 🔍 Inter-Agent Communication

### Agent→Agent Query Endpoints

**Example 1: Desktop AI asks AI-Helper**
```
POST /agents/query
{
  "from_agent": "desktop-ai",
  "to_agent": "ai-helper",
  "question": "What mods does this user have installed?",
  "context": "User reported texture issues"
}
```

**Example 2: AI-Helper asks Desktop AI**
```
POST /agents/query
{
  "from_agent": "ai-helper",
  "to_agent": "desktop-ai",
  "question": "Is USSEP safe to merge with 3BBB body mods?",
  "context": "User has both mods active"
}
```

---

## ✅ Answer Validation & Improvement

When an agent provides an answer:

1. **Query** → All agents validate independently
2. **Score** → Consensus score calculated (avg of all confidences)
3. **Threshold** → If consensus < 70%, propose improvement
4. **Synthesis** → Desktop AI creates better answer
5. **Learning** → All agents learn from the improved answer

**Example**:
- Desktop AI answers: "You need to merge mods using zEdit"
- AI-Helper: "Actually only 85% confidence — some users have issues"
- Mossy Manager: "Correct — but check for scripts first, then mention BAT files"
- Synthesis: "You can merge mods BUT first check for scripts using FO4Edit. zEdit is easiest. Alternatively, use BAT files for reordering..."
- Consensus Score: 92% (improved from 70%)

---

## 📈 Continuous Improvement Loop

### Triggered via `/improve/all` endpoint

**Every improvement cycle**:

1. **Each agent reflects** on recent learnings (past 5 interactions)
2. **Counts lessons learned** from other agents
3. **Identifies knowledge gaps** (topics where confidence is low)
4. **Proposes discoveries** to add to shared knowledge
5. **Validates peer discoveries** (checks against their own memory)

**Result**: Agents gradually become more knowledgeable and confident.

---

## 🚀 Service Architecture

### Startup Sequence

1. **Electron Main Process** (port 21337)
2. **Desktop AI Service** (port 8000) — spawns on first IPC call
3. **AI-Helper** (port 21337) — already running
4. **Agent Collaboration Service** (port 8004) — spawns on first agent:* IPC call
5. **Fallout 4 Knowledge Bootstrap** — Chroma initializes

### Port Assignments

```
8000  — Desktop AI (Gemma + LangChain + LlamaIndex)
8001  — PyTorch (GPU inference)
8002  — Whisper (Speech-to-text)
8003  — Chroma (Vector DB - shared knowledge)
8004  — Agent Collaboration Service (inter-agent communication)
8005  — Mossy Manager (future)
21337 — AI-Helper (Flask server)
```

---

## 🎮 User Interface Integration

### FalloutTutor Component (`components/FalloutTutor.tsx`)

**Features**:
- Search box for Fallout 4 questions
- Quick topic suggestions
- Shows which agents are online
- Displays synthesized answer
- Shows agent consensus score
- Lists knowledge sources
- Continuous learning notice

**IPC Calls**:
- `agent:discover` — Check which agents are online
- `gemma:rag-query` — Ask tutor main question
- `agent:query` — Query other agents for context
- `agent:validate-answer` — Get consensus score
- `agent:trigger-improvement` — Manually trigger learning cycle

### AgentCollaboration Component (`components/AgentCollaboration.tsx`)

**Tabs**:
1. **Inter-Agent Chat** — Send queries between agents, see responses
2. **Shared Knowledge** — Search and browse Fallout 4 knowledge base
3. **Improvements** — Monitor how agents improve answers

**IPC Calls**:
- `agent:discover` — Discover agents
- `agent:query` — Inter-agent queries
- `agent:knowledge-search` — Search shared DB
- `agent:knowledge-add` — Add new knowledge
- `agent:validate-answer` — Validate answers
- `agent:get-stats` — System statistics
- `agent:trigger-improvement` — Start improvement cycle
- `agent:get-learning-history` — View agent's learnings

---

## 📋 IPC Handlers (Electron → Services)

### Agent Collaboration Handlers

```typescript
// Discover agents and their status
'agent:discover' → AGENT_COLLAB_SERVICE/agents/discover

// Query one agent from another
'agent:query' → AGENT_COLLAB_SERVICE/agents/query

// Search shared knowledge base
'agent:knowledge-search' → AGENT_COLLAB_SERVICE/knowledge/search

// Add discovery to shared knowledge
'agent:knowledge-add' → AGENT_COLLAB_SERVICE/knowledge/add

// Validate an answer with consensus
'agent:validate-answer' → AGENT_COLLAB_SERVICE/agents/validate-answer

// Get system statistics
'agent:get-stats' → AGENT_COLLAB_SERVICE/stats

// Trigger improvement cycle
'agent:trigger-improvement' → AGENT_COLLAB_SERVICE/improve/all

// View agent's learning history
'agent:get-learning-history' → AGENT_COLLAB_SERVICE/agents/{name}/learning-history
```

---

## 🛠️ Setup & First Run

### 1. Install Dependencies

```bash
cd python
pip install -r requirements.txt
```

**Key packages added**:
- `chromadb>=0.4.0` — Shared vector DB
- `sentence-transformers>=2.2.0` — Fast embeddings
- `requests>=2.31.0` — Inter-service communication

### 2. Bootstrap Knowledge Base

```bash
cd python
python bootstrap_fallout4_knowledge.py
```

**Output**:
```
[FALLOUT 4 KNOWLEDGE] Initializing shared knowledge base...
[1/8] ✓ Mod Load Order Basics (ID: a1b2c3d4...)
[2/8] ✓ FOMOD Installation (ID: e5f6g7h8...)
...
[FALLOUT 4 KNOWLEDGE] Bootstrap complete! 8 topics added.
```

### 3. Start the App

```bash
npm run electron:dev
```

**Startup sequence** (logs visible in console):
```
[MOSSY MULTI-AGENT] Starting on port 8004...
[MOSSY MULTI-AGENT] Agents: Desktop AI, AI-Helper, Mossy Manager
[MOSSY MULTI-AGENT] Knowledge Base: Fallout 4 modding expertise
[MOSSY MULTI-AGENT] Learning: Continuous improvement enabled
```

### 4. Add Components to App.tsx

```typescript
import { FalloutTutor } from './components/FalloutTutor';
import { AgentCollaboration } from './components/AgentCollaboration';

export default function App() {
  return (
    <div className="space-y-6">
      <FalloutTutor />
      <AgentCollaboration />
    </div>
  );
}
```

---

## 🎯 Example Interaction

### User: "Should I merge my armor mods?"

**Desktop AI** processes the question and:
1. Queries AI-Helper: "How many armor mods does user have?"
   - Response: "18 active plugins, 8 dedicated to armor"
2. Queries Mossy Manager: "Known armor mod merge issues?"
   - Response: "Some have script conflicts; check DISTR lists"
3. Synthesizes answer:
   ```
   "You can merge 8 armor mods IF:
   • None have scripts (check FOMOD installer)
   • They don't modify ESM records
   • Use zEdit's merge function
   • Test thoroughly in-game
   
   Risky to merge without verification.
   Recommend using Load Order Library to check.
   ```
4. **Validation**:
   - AI-Helper: 90% confident (can verify via files)
   - Mossy Manager: 85% confident (matches known patterns)
   - Consensus: 87.5% ✓
5. **All agents learn**: "Armor mod merging is risky; requires verification"

---

## 📊 Monitoring & Stats

### View Real-Time Stats

Via `AgentCollaboration` component or API:
```
Total Knowledge Entries:    24 (grows with discoveries)
Inter-Agent Queries:         47 (learned from each other)
Improvements Made:           12 (answers got better)
```

### View Agent Learning History

```bash
curl http://localhost:8004/agents/desktop-ai/learning-history
curl http://localhost:8004/agents/ai-helper/learning-history
curl http://localhost:8004/agents/mossy-manager/learning-history
```

---

## 🚀 Future Enhancements

### Phase 2: Advanced Reasoning
- **Agent debates** — When agents disagree, synthesize stronger answer
- **Citation tracking** — Show exactly which agent suggested each point
- **Confidence evolution** — Track how confidence changes over time

### Phase 3: Active Learning
- **Ask users for feedback** — "Was this answer helpful?"
- **Negative feedback loop** — Reduce confidence for bad answers
- **Expert validation** — If user is expert, mark knowledge as verified

### Phase 4: Integration with Live Systems
- **Pull from Nexus Mods API** — Real mod metadata
- **Monitor mod changelogs** — Learn about mod updates
- **Track community issues** — Common problems on forums
- **Connect to MO2/xEdit** — Real-time mod analysis

---

## 🐛 Troubleshooting

### "Agents offline" error

**Check services started**:
```bash
curl http://localhost:8000/health      # Desktop AI
curl http://localhost:21337/health     # AI-Helper
curl http://localhost:8004/health      # Agent Collab
```

If offline, check console for startup errors.

### "Knowledge base not found"

**Re-bootstrap**:
```bash
python bootstrap_fallout4_knowledge.py
```

### "Consensus score too low"

**Normal behavior** — Agents disagree. Desktop AI will synthesize a better answer.

### Performance issues

**Check memory**:
```python
# Monitor in console
import psutil
psutil.virtual_memory()  # RAM usage
psutil.disk_usage('/')   # Disk space
```

Chroma uses <500MB for Fallout 4 knowledge. If space-constrained, prune old learnings.

---

## 📖 Quick Reference

| Component | Port | Purpose |
|-----------|------|---------|
| Desktop AI | 8000 | Main tutor (Gemma) |
| PyTorch | 8001 | GPU inference |
| Whisper | 8002 | Speech-to-text |
| Chroma | 8003 | Shared knowledge base |
| **Agent Collab** | **8004** | **Inter-agent communication** |
| AI-Helper | 21337 | System + file access |
| Mossy Manager | 8005 | Load order expert |

---

**Version**: 1.0 (Multi-Agent Tutoring Edition)
**Last Updated**: April 10, 2026
**Agents**: 3 | **Knowledge Entries**: 8 (bootstrap) | **Learning Enabled**: Yes ✓
