# OpenCode — Reference Documentation

> **Source policy:** Sections with `opencode.ai` URLs summarize the official
> OpenCode documentation. Sections marked "GitHub repository", "project-specific",
> "recommended integration", or "open doubt" are derived from the public
> `anomalyco/opencode` repository or from this orchestrator's integration needs
> and must be verified against an installed OpenCode CLI before production use.
>
> Official documentation base URL: `https://opencode.ai/docs`
> GitHub repository: `https://github.com/anomalyco/opencode`
>
> Research snapshot date: 2026-05-18.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Repository Snapshot](#2-repository-snapshot)
3. [System Requirements](#3-system-requirements)
4. [Installation](#4-installation)
5. [Authentication and Provider Setup](#5-authentication-and-provider-setup)
6. [Starting OpenCode](#6-starting-opencode)
7. [CLI Command Reference](#7-cli-command-reference)
8. [Non-Interactive Automation](#8-non-interactive-automation)
9. [Configuration System](#9-configuration-system)
10. [Models and Providers](#10-models-and-providers)
11. [Agents](#11-agents)
12. [Permissions and Safety](#12-permissions-and-safety)
13. [Tools](#13-tools)
14. [Rules and Instructions](#14-rules-and-instructions)
15. [Custom Commands](#15-custom-commands)
16. [Agent Skills](#16-agent-skills)
17. [MCP Servers](#17-mcp-servers)
18. [LSP, Formatters, and Diagnostics](#18-lsp-formatters-and-diagnostics)
19. [Server and SDK](#19-server-and-sdk)
20. [Desktop, Web, IDE, GitHub, and GitLab Surfaces](#20-desktop-web-ide-github-and-gitlab-surfaces)
21. [Data, Sessions, Sharing, and Storage](#21-data-sessions-sharing-and-storage)
22. [Environment Variables](#22-environment-variables)
23. [Security and Operational Considerations](#23-security-and-operational-considerations)
24. [Official Documentation Coverage Audit](#24-official-documentation-coverage-audit)
25. [Integration Notes for This Orchestrator](#25-integration-notes-for-this-orchestrator)
26. [Open Doubts Before Real Execution](#26-open-doubts-before-real-execution)

---

## 1. Overview

**Sources:**
- [https://opencode.ai/docs](https://opencode.ai/docs)
- [https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)

OpenCode is an open-source AI coding agent. The official docs describe it as
available through multiple user surfaces:

- Terminal UI (`opencode`)
- Non-interactive CLI commands (`opencode run ...`)
- Desktop app
- IDE integrations
- Web/mobile-accessible server-backed interface
- Programmatic HTTP server and JavaScript SDK

OpenCode is model/provider-flexible. It uses the AI SDK and Models.dev provider
metadata, supports many hosted providers, supports OpenAI-compatible custom
providers, and can be configured for local models.

Important conceptual distinction for this project:

- Bob Shell is a vendor-specific shell agent tied to IBM Bob access.
- OpenCode is a general coding-agent runtime that can talk to many model
  providers.

That makes OpenCode a plausible generic `AnalysisProvider` backend for this
orchestrator, but it also means we should explicitly constrain it for read-only,
batch analysis.

---

## 2. Repository Snapshot

**Source:** [https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)

Public repository facts observed on 2026-05-18:

| Item | Observed value |
|------|----------------|
| Repository | `anomalyco/opencode` |
| Description | Open source AI coding agent |
| License | MIT |
| Default branch shown | `dev` |
| Latest release shown | `v1.15.4`, dated 2026-05-17 |
| Primary languages shown | TypeScript and MDX |
| Package ecosystem signals | npm package, Homebrew tap, binary releases, Docker image |

Repository tree highlights visible from GitHub:

- `.opencode/` project-level OpenCode configuration/rules
- `packages/` implementation packages
- `sdks/vscode/` VS Code integration code
- `specs/` API/spec-related material
- localized README files
- `install` script at repository root

> **Verification note:** GitHub metadata such as star count, fork count, latest
> release, and branch state changes frequently. Treat the table above as a
> dated snapshot, not a stable contract.

---

## 3. System Requirements

**Source:** [https://opencode.ai/docs](https://opencode.ai/docs)

The official intro lists two practical prerequisites for terminal use:

1. A modern terminal emulator.
2. API keys for the LLM providers the user wants to use.

Examples of terminal emulators mentioned in the docs include WezTerm,
Alacritty, Ghostty, and Kitty.

Windows guidance in the intro recommends WSL for the best experience because it
provides better compatibility and performance for OpenCode's terminal-centric
features.

---

## 4. Installation

**Sources:**
- [https://opencode.ai/docs](https://opencode.ai/docs)
- [https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)

### 4.1 Install Script

The quickest official path is:

```sh
curl -fsSL https://opencode.ai/install | bash
```

The repository README notes that the install script honors installation path
environment variables, with custom install directory taking priority over XDG
and default user-bin locations.

### 4.2 Node Package Managers

OpenCode can be installed globally as `opencode-ai`:

```sh
npm install -g opencode-ai
bun install -g opencode-ai
pnpm install -g opencode-ai
yarn global add opencode-ai
```

The GitHub README shows `opencode-ai@latest` in the npm example.

### 4.3 Homebrew

Official docs recommend the OpenCode tap as the fresher Homebrew source:

```sh
brew install anomalyco/tap/opencode
```

The repository README also mentions the official Homebrew formula:

```sh
brew install opencode
```

but notes it may update less frequently.

### 4.4 Windows

Documented Windows install paths include:

```powershell
choco install opencode
scoop install opencode
npm install -g opencode-ai
```

The docs recommend WSL for best compatibility.

### 4.5 Arch Linux, Mise, Nix, Docker, Releases

Other documented installation paths:

```sh
sudo pacman -S opencode
paru -S opencode-bin
mise use -g github:anomalyco/opencode
nix run nixpkgs#opencode
docker run -it --rm ghcr.io/anomalyco/opencode
```

The docs and README also point users to GitHub releases for binary downloads.

### 4.6 Desktop App

**Source:** [https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)

The repository README describes a beta desktop application distributed from the
releases page and `opencode.ai/download`. Platform-specific artifact names are
listed for macOS, Windows, and Linux, and package-manager installation is shown
for the desktop app on Homebrew and Scoop.

---

## 5. Authentication and Provider Setup

**Sources:**
- [https://opencode.ai/docs](https://opencode.ai/docs)
- [https://opencode.ai/docs/cli/](https://opencode.ai/docs/cli/)
- [https://opencode.ai/docs/providers](https://opencode.ai/docs/providers)

OpenCode needs model-provider credentials before real model calls can run.

### 5.1 Interactive Setup

The intro recommends the `/connect` flow inside the TUI:

```text
/connect
```

From there the user selects OpenCode Zen or another provider, signs in or
creates provider credentials, and stores the API key.

### 5.2 CLI Auth Command

The CLI docs list:

```sh
opencode auth login
```

Provider selection can be scoped with:

```sh
opencode auth login --provider <provider-id-or-name>
```

The docs state credentials are stored in:

```text
~/.local/share/opencode/auth.json
```

At startup, OpenCode also reads provider keys from environment variables and
project `.env` files when available.

### 5.3 Auth Inspection

For provider troubleshooting, the docs recommend:

```sh
opencode auth list
```

This checks whether OpenCode sees credentials for the intended provider.

---

## 6. Starting OpenCode

**Sources:**
- [https://opencode.ai/docs](https://opencode.ai/docs)
- [https://opencode.ai/docs/cli/](https://opencode.ai/docs/cli/)

### 6.1 Terminal UI

Running OpenCode with no arguments starts the terminal UI:

```sh
opencode
```

The CLI reference also supports:

```sh
opencode [project]
```

where `[project]` is the project directory.

### 6.2 Project Initialization

Inside the TUI, the recommended project setup command is:

```text
/init
```

The docs say `/init` analyzes the repo and creates or updates an `AGENTS.md`
file. That file should be committed so future sessions and teammates get the
same project-specific instructions.

### 6.3 File References in Prompts

OpenCode supports `@` file references in user prompts. The intro describes
using `@` to fuzzy-search project files in the TUI, and the custom commands docs
describe `@path/to/file` references whose file content is included in the prompt.

Example:

```text
How is authentication handled in @packages/functions/src/api/index.ts?
```

---

## 7. CLI Command Reference

**Source:** [https://opencode.ai/docs/cli/](https://opencode.ai/docs/cli/)

The CLI page is the primary automation reference. OpenCode starts the TUI by
default, but it also exposes commands for scripting and integration.

### 7.1 TUI Flags

Relevant TUI flags:

| Flag | Purpose |
|------|---------|
| `--continue`, `-c` | Continue the last session |
| `--session`, `-s` | Continue a specific session ID |
| `--fork` | Fork when continuing a session |
| `--prompt` | Start with a prompt |
| `--model`, `-m` | Choose `provider/model` |
| `--agent` | Choose an agent |
| `--port` | Server port |
| `--hostname` | Server hostname |
| `--mdns` | Enable mDNS |
| `--cors` | Add CORS origins |

### 7.2 Command Families

Documented command groups include:

| Command | Purpose |
|---------|---------|
| `opencode agent` | Manage agents |
| `opencode attach` | Attach a TUI to an existing server |
| `opencode auth` | Manage provider credentials |
| `opencode github` | GitHub integration commands |
| `opencode mcp` | MCP management |
| `opencode models` | List/select models |
| `opencode run` | Non-interactive prompt execution |
| `opencode serve` | Headless HTTP server |
| `opencode session` | Session management |
| `opencode stats` | Usage/session statistics |
| `opencode export` | Export session data |
| `opencode import` | Import session data |
| `opencode web` | Web client/server interface |
| `opencode acp` | Agent Client Protocol integration |
| `opencode plugin` / `plug` | Install plugin and update config |
| `opencode pr` | Fetch and check out a GitHub PR branch, then run OpenCode |
| `opencode db` | Database tools |
| `opencode debug` | Debugging and troubleshooting tools |
| `opencode uninstall` | Remove OpenCode files |
| `opencode upgrade` | Upgrade OpenCode |

### 7.3 Global Flags

Global flags:

| Flag | Purpose |
|------|---------|
| `--help`, `-h` | Show help |
| `--version`, `-v` | Print version |
| `--print-logs` | Print logs to stderr |
| `--log-level` | Set log level |
| `--pure` | Run without external plugins |

---

## 8. Non-Interactive Automation

**Source:** [https://opencode.ai/docs/cli/](https://opencode.ai/docs/cli/)

### 8.1 Basic Usage

The CLI docs show:

```sh
opencode run "Explain how closures work in JavaScript"
```

This is the most relevant entry point for this orchestrator because it runs one
prompt and exits.

### 8.2 Recommended Batch-Analysis Shape

For this project, prefer an invocation shaped like:

```sh
opencode run \
  --dir "$WORKSPACE_PATH" \
  --agent plan \
  --model "$OPENCODE_MODEL" \
  --format json \
  "$PROMPT"
```

> **Recommended integration:** The exact final argument order and `--format json`
> output shape must be confirmed with `opencode run --help` and a real local
> probe before implementing production parsing.

### 8.3 Why `plan` Agent for Analysis

The repository README describes built-in agents:

- `build`: default development agent with full-access behavior.
- `plan`: read-only analysis/planning agent; denies file edits by default and
  asks before shell commands.

For this orchestrator's "analyze source and return answer" workload, `plan` is
the safer default.

### 8.4 Expected Failure Modes

Provider integration should treat these as distinct cases:

- CLI not installed or not on `PATH`.
- Provider credentials missing.
- Model not configured or unavailable.
- Permission prompts block non-interactive execution.
- Output is not valid JSON despite `--format json`.
- Process timeout.
- Buffer limit exceeded.
- Model/provider transient failure.
- Agent writes to workspace unexpectedly because permissions were too broad.

---

## 9. Configuration System

**Source:** [https://opencode.ai/docs/config/](https://opencode.ai/docs/config/)

### 9.1 File Format

OpenCode configuration uses JSON or JSONC. Official examples use:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "autoupdate": true
}
```

The TUI has a separate schema:

```jsonc
{
  "$schema": "https://opencode.ai/tui.json"
}
```

### 9.2 Merge and Precedence

The config docs say config files are merged rather than replaced. Later sources
override earlier sources only where keys conflict.

Documented precedence order:

1. Remote config from `.well-known/opencode`
2. Global config: `~/.config/opencode/opencode.json`
3. Custom config via `OPENCODE_CONFIG`
4. Project config: `opencode.json`
5. `.opencode` directories for agents, commands, plugins, etc.
6. Inline config via `OPENCODE_CONFIG_CONTENT`
7. Managed system config files
8. macOS managed preferences through MDM

### 9.3 Config Locations

Common locations:

| Scope | Path |
|-------|------|
| Global | `~/.config/opencode/opencode.json` |
| Global TUI | `~/.config/opencode/tui.json` |
| Project | `opencode.json` in project root |
| Project TUI | `tui.json` near project config |
| Project directories | `.opencode/agents`, `.opencode/commands`, `.opencode/plugins`, etc. |
| Custom config file | `OPENCODE_CONFIG=/path/to/file.json` |
| Custom config dir | `OPENCODE_CONFIG_DIR=/path/to/dir` |

The docs note plural directory names are preferred, while singular names remain
supported for backwards compatibility.

### 9.4 Managed Settings

Enterprise/admin-managed settings can be loaded from:

| Platform | Path |
|----------|------|
| macOS | `/Library/Application Support/opencode/` |
| Linux | `/etc/opencode/` |
| Windows | `%ProgramData%\opencode` |

macOS MDM can also enforce settings through the `ai.opencode.managed`
preference domain. Managed settings have highest priority and cannot be
overridden by user or project config.

### 9.5 Important Schema Areas

The config schema covers:

- server settings
- shell choice
- tools and permissions
- providers and models
- image attachment limits
- themes
- agents
- default agent
- sharing
- custom commands
- keybinds
- snapshots
- autoupdate
- formatters
- LSP servers
- compaction
- file watcher
- MCP servers
- plugins
- instructions
- enabled/disabled providers
- experimental switches

---

## 10. Models and Providers

**Sources:**
- [https://opencode.ai/docs/providers](https://opencode.ai/docs/providers)
- [https://opencode.ai/docs/config/](https://opencode.ai/docs/config/)

OpenCode uses AI SDK provider packages plus Models.dev metadata. The providers
docs state OpenCode supports many model providers and local models.

### 10.1 Main and Small Models

Config fields:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4-5"
}
```

`small_model` is used for lightweight tasks such as title generation. If a
cheaper model is available from the provider, OpenCode tries to use it;
otherwise it falls back to the main model.

### 10.2 Provider Options

Provider-level options include:

| Option | Purpose |
|--------|---------|
| `timeout` | Overall provider request timeout in milliseconds; documented default is `300000` |
| `chunkTimeout` | Timeout between streamed chunks |
| `setCacheKey` | Ensure a cache key is set for a provider |

### 10.3 Provider-Specific Options

The config docs include provider-specific options, such as Amazon Bedrock
region/profile/endpoint settings. The providers docs include many provider setup
sections, all following a similar shape:

1. Create a provider API key or token.
2. Run `/connect`.
3. Select/search for the provider.
4. Paste the credential.
5. Run `/models` to choose a model.

### 10.4 Custom OpenAI-Compatible Provider

OpenCode supports custom providers that are not listed in `/connect`.

The documented process:

1. Run `/connect`.
2. Select `Other`.
3. Choose a unique provider ID.
4. Store the API key.
5. Add provider metadata to `opencode.json`.
6. Run `/models`.

Minimal shape:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "myprovider": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "My Provider",
      "options": {
        "baseURL": "https://api.myprovider.com/v1"
      },
      "models": {
        "my-model-name": {
          "name": "My Model"
        }
      }
    }
  }
}
```

For `/v1/responses` providers, the docs say to use `@ai-sdk/openai`; for
standard OpenAI-compatible chat completions, use `@ai-sdk/openai-compatible`.

### 10.5 Provider Troubleshooting

Official checks:

- `opencode auth list`
- Match provider ID in `/connect` with provider ID in config.
- Verify the right AI SDK npm package.
- Verify `options.baseURL`.
- For custom providers, verify model IDs and token limits.

---

## 11. Agents

**Sources:**
- [https://opencode.ai/docs/agents/](https://opencode.ai/docs/agents/)
- [https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)

Agents specialize the system prompt, model, tool/permission access, and UI
presentation for different tasks.

### 11.1 Built-In Agents

The repository README identifies:

| Agent | Role |
|-------|------|
| `build` | Default development agent |
| `plan` | Read-only analysis and planning agent |
| `general` | General subagent for complex searches and multistep work |

The TUI can switch primary agents with `Tab`. The `general` subagent can be
invoked with `@general` in messages.

### 11.2 Agent Definition Locations

Agents can be configured in JSON:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "code-reviewer": {
      "description": "Reviews code for correctness and maintainability",
      "model": "anthropic/claude-sonnet-4-5",
      "prompt": "Review code without editing files.",
      "permission": {
        "edit": "deny"
      }
    }
  }
}
```

They can also be defined as markdown files under:

- `~/.config/opencode/agents/`
- `.opencode/agents/`

### 11.3 Agent Modes

The agent `mode` controls how the agent can be used:

| Mode | Meaning |
|------|---------|
| `primary` | User-selectable primary agent |
| `subagent` | Callable by other agents or via `@` |
| `all` | Both primary and subagent use |

If omitted, the docs say `mode` defaults to `all`.

### 11.4 Default Agent

The default primary agent can be set:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "plan"
}
```

The default must be a primary agent. If invalid, OpenCode falls back to `build`
with a warning.

### 11.5 Agent Permissions

Agents can override global permissions. Agent rules take precedence over global
rules after merging.

Example read-only review agent:

```markdown
---
description: Code review without edits
mode: subagent
permission:
  edit: deny
  bash:
    "*": ask
    "git diff": allow
    "git log*": allow
  webfetch: deny
---

Only analyze code and suggest changes.
```

### 11.6 Task Permissions

Agents can control which subagents they may invoke via `permission.task`.
Patterns are glob-like, and the last matching rule wins.

```jsonc
{
  "agent": {
    "orchestrator": {
      "mode": "primary",
      "permission": {
        "task": {
          "*": "deny",
          "orchestrator-*": "allow",
          "code-reviewer": "ask"
        }
      }
    }
  }
}
```

---

## 12. Permissions and Safety

**Source:** [https://opencode.ai/docs/permissions/](https://opencode.ai/docs/permissions/)

OpenCode uses `permission` config to decide whether actions run automatically,
ask for approval, or are blocked.

### 12.1 Permission Actions

| Action | Meaning |
|--------|---------|
| `allow` | Run without approval |
| `ask` | Prompt the user |
| `deny` | Block |

Legacy `tools` boolean config is deprecated as of v1.1.1, but still supported
for backwards compatibility.

### 12.2 Global Permission Example

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "*": "ask",
    "bash": "allow",
    "edit": "deny"
  }
}
```

### 12.3 Granular Rules

Most permissions can be object-valued and matched against tool input:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "bash": {
      "*": "ask",
      "git *": "allow",
      "npm *": "allow",
      "rm *": "deny"
    },
    "edit": {
      "*": "deny",
      "docs/*.md": "allow"
    }
  }
}
```

Rules use simple wildcards. The last matching rule wins, so put broad rules
first and specific exceptions later.

### 12.4 Available Permission Keys

Documented permission keys:

| Key | Covers |
|-----|--------|
| `read` | Reading files |
| `edit` | File modifications, including edit/write/patch |
| `glob` | File globbing |
| `grep` | Content search |
| `bash` | Shell commands |
| `task` | Launching subagents |
| `skill` | Loading skills |
| `lsp` | LSP queries |
| `question` | Asking the user questions |
| `webfetch` | Fetching URLs |
| `websearch` | Web searches |
| `external_directory` | Access outside project working directory |
| `doom_loop` | Repeated identical tool calls |

### 12.5 Defaults

The permissions docs state:

- Most permissions default to `allow`.
- `doom_loop` defaults to `ask`.
- `external_directory` defaults to `ask`.
- `read` defaults to `allow`, but `.env` and `.env.*` are denied by default,
  while `.env.example` is allowed.

### 12.6 What `ask` Means

When OpenCode asks, the UI supports:

- approve once
- always approve matching future requests for the current session
- reject

In non-interactive batch operation, `ask` is a likely automation blocker.

### 12.7 Recommended Safe Baseline for This Orchestrator

> **Recommended integration:** Start with a project-local generated config that
> denies edits and asks or denies bash. Use the `plan` agent by default.

Example:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "plan",
  "permission": {
    "*": "ask",
    "read": "allow",
    "glob": "allow",
    "grep": "allow",
    "edit": "deny",
    "bash": "deny",
    "webfetch": "deny",
    "websearch": "deny",
    "external_directory": "deny"
  },
  "agent": {
    "plan": {
      "permission": {
        "edit": "deny",
        "bash": "deny"
      }
    }
  }
}
```

If shell access is required for repo analysis, change `bash` from `deny` to a
small explicit allowlist, such as read-only `git` and search commands.

---

## 13. Tools

**Source:** [https://opencode.ai/docs/tools/](https://opencode.ai/docs/tools/)

OpenCode comes with built-in tools and can be extended with custom tools or MCP
servers.

### 13.1 Built-In Tool Categories

The tools docs describe tools for:

- reading files
- writing files
- editing files
- applying patches
- searching files with grep/glob
- shell command execution
- LSP interactions
- subagent tasks
- todo tracking
- skill loading
- web fetch and web search
- asking the user questions

`apply_patch` is controlled by the `edit` permission, along with other file
modification tools.

### 13.2 Web Tools

`webfetch` retrieves specific web pages.

`websearch` performs web search. The docs state it is available with the
OpenCode provider or when `OPENCODE_ENABLE_EXA` is truthy. It uses Exa's hosted
MCP service and does not require a separate Exa API key according to the tools
page.

### 13.3 Todo Tool

`todowrite` lets the model manage task lists during complex sessions. The docs
say it is disabled for subagents by default, but can be enabled manually.

### 13.4 Tool Search Internals and Ignore Behavior

The tools docs say `grep` and `glob` use ripgrep internally. By default, ripgrep
respects `.gitignore`. To include otherwise ignored directories, a project
`.ignore` file can add explicit allow patterns.

Example:

```gitignore
!node_modules/
!dist/
!build/
```

For this orchestrator, this matters because generated workspaces may intentionally
include only selected source and context files; OpenCode search should operate
inside that prepared workspace.

---

## 14. Rules and Instructions

**Source:** [https://opencode.ai/docs/rules/](https://opencode.ai/docs/rules/)

OpenCode uses `AGENTS.md` for custom instructions. This is comparable to project
rules in other coding agents.

### 14.1 Project Rules

Project-level file:

```text
AGENTS.md
```

The docs recommend committing project `AGENTS.md` so team members share the same
agent guidance.

### 14.2 Global Rules

Global file:

```text
~/.config/opencode/AGENTS.md
```

Use this for personal rules that should not be committed.

### 14.3 Claude Code Compatibility

Fallback files:

| Scope | Fallback |
|-------|----------|
| Project | `CLAUDE.md` |
| Global | `~/.claude/CLAUDE.md` |
| Skills | `~/.claude/skills/` |

Disable compatibility with:

```sh
export OPENCODE_DISABLE_CLAUDE_CODE=1
export OPENCODE_DISABLE_CLAUDE_CODE_PROMPT=1
export OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1
```

### 14.4 Precedence

The rules docs say OpenCode looks for rule files in this order:

1. Local files by walking up from the current directory: `AGENTS.md`, then
   `CLAUDE.md`.
2. Global `~/.config/opencode/AGENTS.md`.
3. Global Claude Code fallback `~/.claude/CLAUDE.md`, unless disabled.

The first matching file wins in each category.

### 14.5 Additional Instruction Files

The `instructions` config field can include local globs or remote URLs:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "CONTRIBUTING.md",
    "docs/guidelines.md",
    ".cursor/rules/*.md"
  ]
}
```

Remote instruction files are fetched with a documented 5-second timeout.

---

## 15. Custom Commands

**Source:** [https://opencode.ai/docs/commands/](https://opencode.ai/docs/commands/)

Custom commands define reusable prompts that can be invoked in the TUI with
slash commands.

### 15.1 Locations

Commands can be configured in JSON or markdown files:

| Scope | Path |
|-------|------|
| Global | `~/.config/opencode/commands/` |
| Project | `.opencode/commands/` |

File name becomes the command name.

Example:

```text
.opencode/commands/test.md
```

is invoked as:

```text
/test
```

### 15.2 Markdown Command Shape

```markdown
---
description: Run tests with coverage
agent: build
model: anthropic/claude-3-5-sonnet-20241022
---

Run the full test suite with coverage report and show any failures.
Focus on failing tests and suggest fixes.
```

### 15.3 JSON Command Shape

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "command": {
    "test": {
      "template": "Run the full test suite and summarize failures.",
      "description": "Run tests",
      "agent": "build",
      "model": "anthropic/claude-3-5-sonnet-20241022"
    }
  }
}
```

### 15.4 Prompt Placeholders

Documented prompt features:

- `$ARGUMENTS` for the full argument string.
- `$1`, `$2`, etc. for positional arguments.
- `!` command injection syntax to include shell output in the prompt.
- `@file` references to include file contents.

For automation, shell-output injection should be avoided unless explicitly
needed and permitted.

---

## 16. Agent Skills

**Source:** [https://opencode.ai/docs/skills/](https://opencode.ai/docs/skills/)

Agent skills are reusable instruction bundles loaded on demand through the
`skill` tool.

### 16.1 Skill Locations

OpenCode searches:

| Scope | Path |
|-------|------|
| Project OpenCode | `.opencode/skills/<name>/SKILL.md` |
| Global OpenCode | `~/.config/opencode/skills/<name>/SKILL.md` |
| Project Claude-compatible | `.claude/skills/<name>/SKILL.md` |
| Global Claude-compatible | `~/.claude/skills/<name>/SKILL.md` |
| Project agent-compatible | `.agents/skills/<name>/SKILL.md` |
| Global agent-compatible | `~/.agents/skills/<name>/SKILL.md` |

For project-local paths, OpenCode walks upward from the current directory until
the Git worktree root.

### 16.2 Skill Frontmatter

Recognized fields:

- `name` (required)
- `description` (required)
- `license` (optional)
- `compatibility` (optional)
- `metadata` (optional string-to-string map)

Unknown frontmatter fields are ignored.

Skill names must be lowercase alphanumeric with single hyphen separators and
must match the directory name.

### 16.3 Skill Permissions

Skills can be controlled with the `skill` permission:

```jsonc
{
  "permission": {
    "skill": {
      "*": "allow",
      "internal-*": "deny",
      "experimental-*": "ask"
    }
  }
}
```

Custom agents and built-in agents can override skill permissions.

---

## 17. MCP Servers

**Source:** [https://opencode.ai/docs/mcp-servers/](https://opencode.ai/docs/mcp-servers/)

OpenCode supports local and remote MCP servers. Once configured, MCP tools become
available alongside built-in tools.

### 17.1 Caution

The docs warn that MCP servers add to context and can consume many tokens,
especially broad integrations such as GitHub MCP.

### 17.2 Local MCP Server

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "my-local-mcp-server": {
      "type": "local",
      "command": ["npx", "-y", "my-mcp-command"],
      "enabled": true,
      "environment": {
        "MY_ENV_VAR": "value"
      }
    }
  }
}
```

Local options include:

| Option | Meaning |
|--------|---------|
| `type` | Must be `local` |
| `command` | Command and args to launch the server |
| `environment` | Environment variables |
| `enabled` | Enable/disable |
| `timeout` | Tool-fetch timeout in milliseconds; documented default is 5000 |

### 17.3 Remote MCP Server

Remote MCP servers use `type: "remote"` and a URL. The docs also describe OAuth
flows for remote MCP servers.

### 17.4 Project Integration Position

For this orchestrator, MCP should be disabled for the initial OpenCode provider
unless a concrete analysis use case requires it. Batch source-code analysis is
better served by explicitly prepared workspaces and deterministic prompts.

---

## 18. LSP, Formatters, and Diagnostics

**Sources:**
- [https://opencode.ai/docs/lsp/](https://opencode.ai/docs/lsp/)
- [https://opencode.ai/docs/formatters/](https://opencode.ai/docs/formatters/)

OpenCode can integrate with Language Server Protocol servers so the LLM can use
diagnostics while working with code.

### 18.1 LSP Enablement

`lsp` can be:

- omitted: disabled
- `true`: enable all built-ins
- `{}`: built-ins enabled with room for overrides
- `false`: disable all

Example:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "lsp": true
}
```

### 18.2 Built-In LSP Coverage

The LSP docs list built-in support for many languages including TypeScript,
JavaScript, Go, Rust, Python, Java, C/C++, PHP, Ruby, Swift, Kotlin, Terraform,
YAML, Vue, Svelte, Astro, and more.

COBOL is not listed in the built-in LSP table.

### 18.3 Automatic LSP Downloads

OpenCode can auto-install some LSP servers when requirements are met. This can
be disabled with:

```sh
OPENCODE_DISABLE_LSP_DOWNLOAD=true
```

For reproducible orchestrator runs, automatic downloads should usually be
disabled.

### 18.4 Custom LSP Servers

Custom LSP entries include:

| Property | Meaning |
|----------|---------|
| `disabled` | Disable this server |
| `command` | Command to start the server |
| `extensions` | Extensions handled |
| `env` | Environment variables |
| `initialization` | LSP initialization options |

---

## 19. Server and SDK

**Sources:**
- [https://opencode.ai/docs/server/](https://opencode.ai/docs/server/)
- [https://opencode.ai/docs/sdk/](https://opencode.ai/docs/sdk/)

### 19.1 Server

OpenCode can run a headless HTTP server:

```sh
opencode serve --port 4096 --hostname 127.0.0.1
```

The docs describe the server as exposing an OpenAPI 3.1 spec at:

```text
http://<hostname>:<port>/doc
```

The server backs multiple clients. The TUI itself is a client talking to a
server.

### 19.2 Server Authentication

Set:

```sh
OPENCODE_SERVER_PASSWORD=your-password
```

to protect `opencode serve` and `opencode web` with HTTP basic auth. The
default username is `opencode`, overridable with:

```sh
OPENCODE_SERVER_USERNAME=your-username
```

### 19.3 Server API Areas

The server docs list API groups for:

- global health and events
- projects
- path and VCS
- config
- providers and provider auth
- sessions
- messages
- commands
- files
- experimental tools
- LSP, formatters, and MCP
- agents
- logs
- TUI
- auth
- docs

### 19.4 SDK

The JavaScript SDK package is:

```ts
import { createOpencode, createOpencodeClient } from "@opencode-ai/sdk"
```

`createOpencode()` starts both server and client. `createOpencodeClient()` can
connect to an existing server.

### 19.5 Structured Output via SDK

The SDK docs describe structured JSON output by passing a JSON schema in the
session prompt request. The model uses a structured-output tool and retries
validation failures.

For this orchestrator, the SDK path may eventually be more robust than parsing
CLI stdout if we need strong structured output contracts.

---

## 20. Desktop, Web, IDE, GitHub, and GitLab Surfaces

**Sources:**
- [https://opencode.ai/docs](https://opencode.ai/docs)
- [https://opencode.ai/docs/cli/](https://opencode.ai/docs/cli/)
- [https://opencode.ai/docs/server/](https://opencode.ai/docs/server/)

OpenCode's docs navigation includes:

- TUI
- CLI
- Web
- IDE
- Zen
- Share
- GitHub
- GitLab
- ACP support

For this orchestrator, these surfaces matter only insofar as they share
configuration, credentials, sessions, permissions, and server infrastructure
with CLI execution.

### 20.1 Web

`opencode web` starts a server-backed web/mobile-accessible interface. It shares
server flags such as port, hostname, mDNS, and CORS.

### 20.2 IDE and ACP

The docs include IDE and ACP support. ACP starts OpenCode as an agent subprocess
over stdio JSON-RPC for ACP-compatible editors.

### 20.3 GitHub and GitLab

GitHub/GitLab documentation exists in the official navigation. For orchestrator
analysis jobs, these integrations should stay disabled unless job requirements
explicitly need remote repository or issue/PR context.

---

## 21. Data, Sessions, Sharing, and Storage

**Sources:**
- [https://opencode.ai/docs/config/](https://opencode.ai/docs/config/)
- [https://opencode.ai/docs/cli/](https://opencode.ai/docs/cli/)
- [https://opencode.ai/docs/server/](https://opencode.ai/docs/server/)

### 21.1 Sessions

OpenCode has persistent sessions. CLI flags can continue or fork sessions:

```sh
opencode --continue
opencode --session <session-id>
opencode --fork --session <session-id>
```

The server API lists session endpoints for listing, creating, reading, deleting,
and checking session status.

### 21.2 Export and Import

The CLI exposes:

```sh
opencode export
opencode import
```

Use these for session portability, not for primary orchestrator output, unless
future implementation needs full session archives.

### 21.3 Sharing

Sharing is controlled by config:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "share": "manual"
}
```

Values:

| Value | Meaning |
|-------|---------|
| `manual` | User explicitly runs `/share`; documented default |
| `auto` | Share new conversations automatically |
| `disabled` | Disable sharing |

For this orchestrator, set `share: "disabled"` in generated project config.

### 21.4 Auth Storage

Credential storage documented by the CLI page:

```text
~/.local/share/opencode/auth.json
```

Do not copy this file into analysis workspaces.

---

## 22. Environment Variables

**Source:** [https://opencode.ai/docs/cli/](https://opencode.ai/docs/cli/)

Documented general variables:

| Variable | Purpose |
|----------|---------|
| `OPENCODE_AUTO_SHARE` | Automatically share sessions |
| `OPENCODE_GIT_BASH_PATH` | Git Bash path on Windows |
| `OPENCODE_CONFIG` | Custom config file |
| `OPENCODE_TUI_CONFIG` | Custom TUI config file |
| `OPENCODE_CONFIG_DIR` | Custom config directory |
| `OPENCODE_CONFIG_CONTENT` | Inline JSON config content |
| `OPENCODE_DISABLE_AUTOUPDATE` | Disable auto-update checks |
| `OPENCODE_DISABLE_PRUNE` | Disable pruning old data |
| `OPENCODE_DISABLE_TERMINAL_TITLE` | Disable terminal title changes |
| `OPENCODE_PERMISSION` | Inline JSON permissions config |
| `OPENCODE_DISABLE_DEFAULT_PLUGINS` | Disable default plugins |
| `OPENCODE_DISABLE_LSP_DOWNLOAD` | Disable automatic LSP downloads |
| `OPENCODE_ENABLE_EXPERIMENTAL_MODELS` | Enable experimental models |
| `OPENCODE_DISABLE_AUTOCOMPACT` | Disable automatic context compaction |
| `OPENCODE_DISABLE_CLAUDE_CODE` | Disable `.claude` compatibility |
| `OPENCODE_DISABLE_CLAUDE_CODE_PROMPT` | Disable `~/.claude/CLAUDE.md` |
| `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS` | Disable `.claude/skills` |
| `OPENCODE_DISABLE_MODELS_FETCH` | Disable remote model metadata fetching |
| `OPENCODE_DISABLE_MOUSE` | Disable mouse capture in TUI |
| `OPENCODE_FAKE_VCS` | Fake VCS provider for testing |
| `OPENCODE_CLIENT` | Client identifier; default is `cli` |
| `OPENCODE_ENABLE_EXA` | Enable Exa web search tools |
| `OPENCODE_SERVER_PASSWORD` | Basic auth password for server/web |
| `OPENCODE_SERVER_USERNAME` | Basic auth username; default `opencode` |
| `OPENCODE_MODELS_URL` | Custom model config URL |

Experimental variables:

| Variable | Purpose |
|----------|---------|
| `OPENCODE_EXPERIMENTAL` | Enable all experimental features |
| `OPENCODE_EXPERIMENTAL_ICON_DISCOVERY` | Icon discovery |
| `OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT` | Disable copy-on-select |
| `OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS` | Bash tool timeout |
| `OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX` | Max output tokens |
| `OPENCODE_EXPERIMENTAL_FILEWATCHER` | Enable full-dir watcher |
| `OPENCODE_EXPERIMENTAL_OXFMT` | Enable oxfmt formatter |
| `OPENCODE_EXPERIMENTAL_LSP_TOOL` | Enable experimental LSP tool |
| `OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER` | Disable file watcher |
| `OPENCODE_EXPERIMENTAL_EXA` | Enable experimental Exa features |
| `OPENCODE_EXPERIMENTAL_LSP_TY` | Enable TY LSP for Python |
| `OPENCODE_EXPERIMENTAL_PLAN_MODE` | Enable experimental plan mode |

### 22.1 Recommended Orchestrator-Specific Env Wrapper

> **Recommended integration:** The orchestrator should expose its own stable
> env names rather than leaking OpenCode's full config surface into core code.

Suggested variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENCODE_PROVIDER_ENABLED` | `false` | Enable provider readiness/execution |
| `OPENCODE_COMMAND` | `opencode` | CLI binary or wrapper path |
| `OPENCODE_MODEL` | empty | Required for deterministic execution unless config supplies one |
| `OPENCODE_AGENT` | `plan` | Agent for `opencode run` |
| `OPENCODE_TIMEOUT_MS` | `180000` | Child process timeout |
| `OPENCODE_MAX_BUFFER_MB` | `20` | stdout/stderr cap |
| `OPENCODE_CONFIG_CONTENT` | generated | Inline safe config override |
| `OPENCODE_DISABLE_AUTOUPDATE` | `true` | Prevent update checks during batch runs |
| `OPENCODE_DISABLE_LSP_DOWNLOAD` | `true` | Prevent runtime downloads |
| `OPENCODE_DISABLE_DEFAULT_PLUGINS` | `true` | Reduce nondeterminism |

---

## 23. Security and Operational Considerations

**Sources:**
- [https://opencode.ai/docs/permissions/](https://opencode.ai/docs/permissions/)
- [https://opencode.ai/docs/tools/](https://opencode.ai/docs/tools/)
- [https://opencode.ai/docs/server/](https://opencode.ai/docs/server/)

### 23.1 Default Permissions Are Too Broad for Batch Analysis

The official docs state most permissions default to `allow`. That is reasonable
for an interactive coding agent but too permissive for automated analysis jobs.

For this orchestrator:

- use `plan` by default
- deny edits
- deny external directories
- deny or heavily constrain bash
- disable sharing
- disable default plugins if possible
- disable automatic LSP downloads
- keep each job in an isolated workspace

### 23.2 Secrets

`.env` files are denied by default under read permissions, but orchestrator
workspaces should avoid copying secrets in the first place.

Provider credentials live outside the project in OpenCode's auth storage or
environment variables. Do not write them into generated `opencode.json` files
unless using explicit env interpolation and the file is ignored/private.

### 23.3 Server Exposure

If using `opencode serve`, bind to `127.0.0.1` by default and set
`OPENCODE_SERVER_PASSWORD` if any browser/network access is possible.

For simple one-shot jobs, prefer `opencode run` over a long-lived server until
the server/SDK path is proven more reliable.

### 23.4 Reproducibility

Sources of nondeterminism:

- model/provider routing changes
- model metadata fetched from remote sources
- plugins
- MCP servers
- web search/fetch
- LSP auto-installation
- continuing prior sessions
- auto-compaction

Mitigations:

- specify `model`
- specify `agent`
- use a fresh workspace
- do not continue prior sessions
- disable plugins/MCP/web tools
- enforce structured output instructions
- save raw stdout/stderr and parsed metadata

---

## 24. Official Documentation Coverage Audit

**Source:** [https://opencode.ai/docs](https://opencode.ai/docs)

Official navigation pages observed:

### Top-Level

- Intro: `/docs`
- Config: `/docs/config/`
- Providers: `/docs/providers`
- Network: `/docs/network/`
- Enterprise: `/docs/enterprise/`
- Troubleshooting: `/docs/troubleshooting/`
- Windows: `/docs/windows/`

### Usage

- Go: `/docs/go/`
- TUI: `/docs/tui/`
- CLI: `/docs/cli/`
- Web: `/docs/web/`
- IDE: `/docs/ide/`
- Zen: `/docs/zen/`
- Share: `/docs/share/`
- GitHub: `/docs/github/`
- GitLab: `/docs/gitlab/`

### Configure

- Tools: `/docs/tools/`
- Rules: `/docs/rules/`
- Agents: `/docs/agents/`
- Models: `/docs/models/`
- Themes: `/docs/themes/`
- Keybinds: `/docs/keybinds/`
- Commands: `/docs/commands/`
- Formatters: `/docs/formatters/`
- Permissions: `/docs/permissions/`
- LSP Servers: `/docs/lsp/`
- MCP servers: `/docs/mcp-servers/`
- ACP Support: `/docs/acp/`
- Agent Skills: `/docs/skills/`
- Custom Tools: `/docs/custom-tools/`

### Develop

- SDK: `/docs/sdk/`
- Server: `/docs/server/`
- Plugins: `/docs/plugins/`
- Ecosystem: `/docs/ecosystem/`

Pages most important for this orchestrator:

1. CLI
2. Config
3. Providers
4. Permissions
5. Agents
6. Server
7. SDK
8. Tools

---

## 25. Integration Notes for This Orchestrator

**Project-specific.**

### 25.1 Fit

OpenCode can be used as another `AnalysisProvider`, parallel to Bob:

```text
src/providers/opencode/
  OpenCodeShellProvider.ts
  OpenCodeProviderHealth.ts
  OpenCodePromptBuilder.ts
  OpenCodeOutputParser.ts
  OpenCodeShellProvider.test.ts
  OpenCodeProviderHealth.test.ts
  OpenCodePromptBuilder.test.ts
  OpenCodeOutputParser.test.ts
```

### 25.2 Proposed Provider Config

```env
OPENCODE_PROVIDER_ENABLED=false
OPENCODE_COMMAND=opencode
OPENCODE_MODEL=
OPENCODE_AGENT=plan
OPENCODE_TIMEOUT_MS=180000
OPENCODE_MAX_BUFFER_MB=20
OPENCODE_MAX_INLINE_BYTES=51200
```

Optional:

```env
OPENCODE_CONFIG_CONTENT=
OPENCODE_DISABLE_AUTOUPDATE=true
OPENCODE_DISABLE_LSP_DOWNLOAD=true
OPENCODE_DISABLE_DEFAULT_PLUGINS=true
```

### 25.3 Readiness Check

Readiness should verify:

1. `OPENCODE_PROVIDER_ENABLED=true`
2. `OPENCODE_COMMAND` is not empty
3. `OPENCODE_COMMAND --version` succeeds
4. either `OPENCODE_MODEL` is set or a resolved OpenCode config provides a model
5. provider credentials are likely present
6. safe config can be supplied

Possible health probe:

```sh
opencode --version
opencode auth list
opencode models
```

> **Open doubt:** Confirm which auth/model commands are stable, script-friendly,
> and non-interactive in the installed OpenCode version.

### 25.4 Prompt Builder

OpenCode prompt builder should support:

- file-reference mode using `@relative/path`
- inline-content mode for deterministic tests
- explicit JSON output instructions
- job metadata: project, bundle, question ID/key, unresolved dependencies
- "do not edit files" instruction even when permissions also deny edits

Suggested prompt skeleton:

```text
You are analyzing a source-code bundle for a codebase-analysis orchestrator.

Rules:
- Do not modify files.
- Do not run commands unless required.
- Answer only the requested question.
- Return strict JSON matching the schema below.

Main file:
@MAIN_FILE

Context files:
@CONTEXT_FILE_1
@CONTEXT_FILE_2

Question:
QUESTION_TEXT

JSON schema:
{
  "summary": "string",
  "evidence": [{"file": "string", "details": "string"}],
  "confidence": "low|medium|high",
  "notes": ["string"]
}
```

### 25.5 Execution Strategy

Initial shell adapter:

```sh
opencode run \
  --dir "$workspacePath" \
  --agent "$OPENCODE_AGENT" \
  --model "$OPENCODE_MODEL" \
  --format json \
  "$prompt"
```

Persist:

- raw stdout
- raw stderr
- exit code
- timeout flag
- duration
- parsed answer
- parse status
- OpenCode version
- args with prompt redacted
- prompt mode
- referenced files

### 25.6 Output Parser

Parser should handle:

- strict JSON object stdout
- JSON embedded in surrounding text
- NDJSON/stream output if `--format json` streams events
- empty stdout
- stderr-only failure
- nonzero exit
- timeout
- permission prompt text
- auth/model configuration error text

Return soft failures via metadata so `WorkerLoop` can classify permanent vs
transient cases.

### 25.7 Worker Dispatch Prerequisite

Current worker construction uses one provider instance. The database stores a
free-form `providerId`, but processing does not yet dispatch per job provider.

Before Bob and OpenCode can coexist cleanly, add a provider resolver:

```ts
type AnalysisProviderResolver = {
  get(providerId: string): AnalysisProvider | undefined;
};
```

Then `WorkerLoop.processJob` should select the provider for each job's
`providerId`.

### 25.8 Why Not Use SDK First?

The SDK may eventually be better for structured output and avoiding CLI stdout
parsing. However, the shell-provider path is closer to the existing Bob provider
scaffold and easier to test with injected process executors.

Recommended path:

1. Implement shell adapter first.
2. Capture real `opencode run` outputs as fixtures.
3. Add SDK/server provider only if shell output is unstable or if session APIs
   offer materially better structured output.

---

## 26. Open Doubts Before Real Execution

**Open doubt / verification checklist.**

Run these against the installed CLI before enabling real jobs:

```sh
opencode --version
opencode run --help
opencode run --dir /tmp/opencode-probe --agent plan --format json "Return {\"ok\": true} as JSON only"
opencode auth list
opencode models
```

Verify:

1. Exact `opencode run` flag names and accepted order.
2. Whether `--dir` or another cwd flag is used by `run` in the installed version.
3. Exact `--format json` stdout shape.
4. Whether `--format json` is strict final JSON or streamed event JSON.
5. Whether `--agent plan` prevents edits in non-interactive mode.
6. Whether permissions that would `ask` cause non-interactive hangs or hard
   failures.
7. Whether `OPENCODE_CONFIG_CONTENT` is honored by `opencode run`.
8. Whether auth credentials can be reliably checked without exposing secrets.
9. Whether a model must be supplied on each run for reproducibility.
10. Whether OpenCode emits provider/model names and token usage in machine-
    parseable output.
11. Whether stdout/stderr can exceed current buffer defaults during errors.
12. Whether OpenCode reads global `AGENTS.md`, `.claude`, plugins, or MCP despite
    project-local config unless explicitly disabled.

### 26.1 Minimal Probe Workspace

```sh
mkdir -p /tmp/opencode-probe
cat > /tmp/opencode-probe/example.cob <<'EOF'
       IDENTIFICATION DIVISION.
       PROGRAM-ID. EXAMPLE.
       PROCEDURE DIVISION.
           DISPLAY "HELLO".
           STOP RUN.
EOF
cd /tmp/opencode-probe
opencode run --agent plan --format json "Summarize @example.cob as strict JSON."
```

Save:

- stdout fixture
- stderr fixture
- exit code
- OpenCode version
- resolved config if available through `opencode debug config`

These fixtures should become parser tests before the provider is enabled.

