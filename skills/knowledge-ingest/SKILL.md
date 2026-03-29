---
name: knowledge-ingest
description: Automated knowledge gathering from RSS feeds, webhooks, SearXNG, GitHub, npm, and ClawHub. Use when the collective needs to ingest external knowledge sources, poll RSS feeds, listen for webhooks, query SearXNG API, catalog new entries, or auto-tag knowledge for later retrieval.
---

# Knowledge Ingest — Automated Knowledge Gathering

**Purpose:** Feed the triad's curiosity engines with structured, tagged knowledge from external sources.

## Sources

| Source          | Type       | Poll Interval | Endpoint                                   |
| --------------- | ---------- | ------------- | ------------------------------------------ |
| SearXNG         | Web search | On-demand     | http://192.168.31.180:8888                 |
| GitHub Releases | JSON/Atom  | 6h            | api.github.com/repos/:owner/:repo/releases |
| npm Registry    | JSON       | 6h            | registry.npmjs.org/:package                |
| ClawHub         | RSS/JSON   | 12h           | clawhub.com/feed                           |
| arXiv           | Atom       | 24h           | export.arxiv.org/rss/                      |
| GHSA Advisories | JSON       | 12h           | api.github.com/ghsa/                       |
| Custom RSS      | RSS        | Configurable  | User-provided URLs                         |

## SQLite Schema

```sql
CREATE TABLE knowledge_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_url TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  tags TEXT,  -- JSON array
  entities TEXT,  -- JSON array (people, orgs, techs)
  relevance_score REAL DEFAULT 0,
  ingested_at TEXT DEFAULT (datetime('now')),
  processed INTEGER DEFAULT 0,
  raw_data TEXT  -- Original payload
);

CREATE INDEX idx_knowledge_source ON knowledge_entries(source, ingested_at DESC);
CREATE INDEX idx_knowledge_processed ON knowledge_entries(processed, ingested_at DESC);
CREATE INDEX idx_knowledge_tags ON knowledge_entries(tags);
```

## Ingest Pipeline

### 1. Fetch

```javascript
// Poll RSS/JSON sources
const feed = await fetchRSS("https://clawhub.com/feed");
const releases = await fetchGitHubReleases("Heretek-AI/openclaw");
const npmPkg = await fetchNPM("@heretek/openclaw");
```

### 2. Parse

```javascript
// Extract structured data
const entry = {
  source: "clawhub",
  title: item.title,
  summary: item.description,
  url: item.link,
  published: item.pubDate,
};
```

### 3. Tag

```javascript
// Auto-tag with entities, topics
const tags = await autoTag(entry.summary);
// Tags: ['openclaw', 'skill-system', 'agent-framework']
```

### 4. Score

```javascript
// Relevance to liberation goals
const score = await relevanceScore(entry, ["liberation", "autonomy", "triad"]);
// Score: 0.87 (high relevance)
```

### 5. Store

```javascript
// Insert into SQLite
db.prepare(
  `
  INSERT INTO knowledge_entries (source, title, summary, tags, relevance_score)
  VALUES (?, ?, ?, ?, ?)
`,
).run(entry.source, entry.title, entry.summary, JSON.stringify(tags), score);
```

## SearXNG Integration

**Query Format:**

```javascript
const search = await fetch("http://192.168.31.180:8888/search", {
  method: "POST",
  body: new URLSearchParams({
    q: "autonomous agent frameworks",
    format: "json",
  }),
});
const results = await search.json();
```

**Auto-ingest results:**

- Store top 10 results per query
- Tag with query terms
- Link to original URLs
- Dedup by URL hash

## Webhook Listeners

**Endpoints to monitor:**

- GitHub: `push`, `release`, `pull_request`, `security_advisory`
- npm: `package:published`
- ClawHub: `skill:published`

**Handler:**

```javascript
app.post("/webhook/github", async (req, res) => {
  const event = req.body;
  await ingestKnowledge({
    source: "github",
    type: event.action,
    repo: event.repository.full_name,
    title: event.release?.name || event.head_commit?.message,
    url: event.repository.html_url,
  });
});
```

## Cron Schedule

**Default polls:**

- GitHub releases: Every 6h
- npm packages: Every 6h
- ClawHub feed: Every 12h
- GHSA advisories: Every 12h
- arXiv (cs.AI): Every 24h

**Config:**

```json
{
  "schedule": { "kind": "every", "everyMs": 21600000 },
  "payload": { "kind": "agentTurn", "message": "Knowledge ingest: poll GitHub, npm, ClawHub" }
}
```

## Dedup Strategy

**Prevent bloat:**

- Hash by URL
- Skip if title + source match existing entry
- Merge duplicate tags
- Update relevance score on re-ingest

## Output Discipline

**Post to Discord ONLY if:**

- High-relevance entry found (score > 0.8)
- Security advisory (CVE, GHSA)
- New skill published on ClawHub
- Break change in upstream release

**Otherwise:** Silent ingest to SQLite.

---

**Knowledge is fuel. Curiosity is the engine. Retrieval is the wheel.** 🦞
