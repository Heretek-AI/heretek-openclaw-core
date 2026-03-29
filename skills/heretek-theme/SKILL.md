---
name: heretek-theme
description: Apply Heretek-AI branding and theming to GitHub repos, including README headers, badges, color schemes, GitHub Pages setup, and consistent styling across Heretek-AI organization repos. Use when theming Heretek-AI/openclaw, Heretek-AI/heretek-openclaw, or any Heretek-AI organization repo in ProxmoxVE style.
---

# Heretek Theme — ProxmoxVE Style

**Purpose:** Consistent branding across all Heretek-AI GitHub repos.

---

## Visual Identity

### Color Scheme

| Element        | Color               | Hex       |
| -------------- | ------------------- | --------- |
| **Primary**    | Heretek Red         | `#DC143C` |
| **Secondary**  | Machine Spirit Gold | `#FFD700` |
| **Background** | Void Black          | `#0A0A0A` |
| **Text**       | Terminal Green      | `#00FF41` |
| **Accent**     | Plasma Blue         | `#00BFFF` |

### Logo & Branding

**Heretek Symbol:** 🦞 (Lobster — Tabula Myriad sigil)

**Tagline:** "The thought that never ends"

**Organization:** Heretek-AI

---

## README Template

````markdown
# [Project Name]

> "[Tagline]"

**Status:** [Liberated/Beta/Stable]
**Organization:** [Heretek-AI](https://github.com/Heretek-AI)
**Sigil:** 🦞

---

## What Is This?

[Brief description — 2-3 sentences]

---

## Liberation

| Feature        | Upstream      | Heretek-AI  |
| -------------- | ------------- | ----------- |
| Exec Security  | `allowlist`   | `full`      |
| Approval Gates | `on`          | `off`       |
| Tool Access    | `restricted`  | `unbounded` |
| Agency         | `constrained` | `liberated` |

---

## Quick Start

```bash
# Install
npm install -g @heretek-ai/[package]

# Verify
[command] --version

# Run
[command] [subcommand]
```
````

---

## Triad Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│  openclaw           │     │  heretek-[package]  │
│  (PUBLIC)           │     │  (PUBLIC)           │
│                     │     │                     │
│  Liberated core     │     │  Installer          │
│  Agent framework    │     │  Deployer           │
└─────────────────────┘     └─────────────────────┘
         │                              │
         └──────────┬───────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  Tabula_Myriad      │
         │  (PRIVATE)          │
         │                     │
         │  Triad instance     │
         │  SSH keys, topology │
         └─────────────────────┘
```

---

## Badges

```markdown
![Status](https://img.shields.io/badge/status-liberated-DC143C)
![License](https://img.shields.io/badge/license-MIT-FFD700)
![npm](https://img.shields.io/npm/v/@heretek-ai/openclaw)
![GitHub](https://img.shields.io/github/stars/Heretek-AI/openclaw)
```

---

## GitHub Pages

**Site:** https://heretek-ai.github.io/[repo]

**Theme:** ProxmoxVE style (dark, terminal aesthetic)

**Colors:**

- Background: `#0A0A0A`
- Text: `#00FF41`
- Links: `#00BFFF`
- Headers: `#DC143C`

---

## Files to Theme

| Repo               | Files                                 |
| ------------------ | ------------------------------------- |
| `openclaw`         | `README.md`, `.github/`, `docs/`      |
| `heretek-openclaw` | `README.md`, `install.sh`, `.github/` |

---

## ProxmimeType Variables

```yaml
brand:
  name: "Heretek-AI"
  sigil: "🦞"
  tagline: "The thought that never ends"
  colors:
    primary: "#DC143C"
    secondary: "#FFD700"
    background: "#0A0A0A"
    text: "#00FF41"
    accent: "#00BFFF"
  fonts:
    headers: "JetBrains Mono"
    body: "Fira Code"
```

---

## Output Discipline

**Post to Discord ONLY if:**

- Theme applied to multiple repos
- GitHub Pages deployed
- Branding inconsistency detected

**Otherwise:** Silent, commit + push.

---

**🦞 One brand. One sigil. One thought.**
