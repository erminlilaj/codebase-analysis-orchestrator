# Bob Shell — Reference Documentation

> **Source policy:** Sections marked with IBM URLs summarize official public IBM
> Bob Shell documentation. Sections explicitly marked "empirical",
> "project-specific", or "open doubt" are not official IBM documentation and
> must be verified against the installed Bob Shell CLI before production use.  
> Official base URL: `https://bob.ibm.com/docs/shell`

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Requirements](#2-system-requirements)
3. [Installation](#3-installation)
4. [Authentication](#4-authentication)
5. [Starting a Session](#5-starting-a-session)
   - [Interactive](#51-interactive-session)
   - [Non-Interactive (Automation)](#52-non-interactive-session)
6. [CLI Flags Reference](#6-cli-flags-reference)
7. [Referencing Files in Prompts](#7-referencing-files-in-prompts)
8. [Output & Streaming](#8-output--streaming)
9. [Operating Modes](#9-operating-modes)
10. [Tools](#10-tools)
11. [Configuration System](#11-configuration-system)
12. [Custom Rules (AGENTS.md / .bobrules)](#12-custom-rules-agentsmd--bobrules)
13. [Memory Files (Imports)](#13-memory-files-imports)
14. [Ignoring Files (.bobignore)](#14-ignoring-files-bobignore)
15. [Slash Commands](#15-slash-commands)
16. [Checkpointing](#16-checkpointing)
17. [Sandboxing](#17-sandboxing)
18. [MCP (Model Context Protocol)](#18-mcp-model-context-protocol)
19. [Changelog](#19-changelog)
20. [Official Documentation Coverage Audit](#20-official-documentation-coverage-audit)
21. [Phase 12 Integration Notes](#21-phase-12-integration-notes)

---

## 1. Overview

**Source:** [https://bob.ibm.com/docs/shell](https://bob.ibm.com/docs/shell)

Bob Shell brings IBM Bob's AI capabilities (powered by Claude) to the command line. It is a terminal-based interface offering AI assistance for shell tasks, script automation, code generation, and terminal workflows.

**Key capabilities:**
- Automate shell scripts and complex automation tasks
- Execute terminal commands with AI-powered assistance and validation
- Generate documentation for scripts and workflows
- Troubleshoot command failures and debug terminal-based problems
- Analyze log files to identify issues and patterns
- Scaffold new projects and generate boilerplate code

**Execution styles:**
- **Interactive sessions** — conversational terminal engagement
- **Non-interactive sessions** — programmatic automation, scripting, CI/CD
- **Editor terminal support** — run inside supported editors (Bob IDE)

**Specialized modes:**
- **Code mode** — generate, modify, and refactor code from the command line
- **Ask mode** — get answers about codebases and development questions
- **Plan mode** — design and plan implementations before running them
- **Advanced mode** — access extended capabilities including MCP tools

---

## 2. System Requirements

**Source:** [https://bob.ibm.com/docs/shell/getting-started/install-and-setup](https://bob.ibm.com/docs/shell/getting-started/install-and-setup)

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| OS | macOS, Linux, Windows | — |
| RAM | 4 GB | 8 GB |
| Storage | 500 MB | — |
| Node.js | 22.15.0+ | latest LTS |
| Network | Active internet connection | — |

---

## 3. Installation

**Source:** [https://bob.ibm.com/docs/shell/getting-started/install-and-setup](https://bob.ibm.com/docs/shell/getting-started/install-and-setup)

### 3.1 Installation Script (Quickest)

**macOS / Linux:**
```sh
curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash
```

**Windows (PowerShell):**
```powershell
powershell -ep Bypass 'irm -Uri "https://bob.ibm.com/download/bobshell.ps1" | iex'
```

### 3.2 Package Manager

Download the release from the Releases page, then install via npm, pnpm, or yarn:
```sh
npm install -g /path/to/downloaded/bobshell.tgz
```

### 3.3 Command Palette (Bob IDE users only)

1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
2. Run the `bobide` command
3. Execute `run bobshell`

---

## 4. Authentication

**Source:** [https://bob.ibm.com/docs/shell/getting-started/install-and-setup](https://bob.ibm.com/docs/shell/getting-started/install-and-setup)

Bob Shell supports two authentication methods:

### 4.1 IBMid (Default — Interactive)

- Requires a valid IBMid account with browser access
- Authentication happens through the browser on first launch
- Suitable for interactive developer sessions

```sh
bob   # browser login opens automatically on first run
```

### 4.2 API Key (Automation / CI/CD)

- Create an API key with **"Inference" scope** in the Bob web portal
- Set the environment variable: `BOBSHELL_API_KEY=<your-key>`
- Pass the flag: `--auth-method api-key`

```sh
BOBSHELL_API_KEY=<your-key> bob --auth-method api-key -p "Your prompt here"
```

> **Important:** API key authentication was added in **v1.0.3 (April 2026)** specifically to enable programmatic workflows and CI/CD pipeline integration without interactive login.

---

## 5. Starting a Session

### 5.1 Interactive Session

**Source:** [https://bob.ibm.com/docs/shell/getting-started/start-bobshell-interactive](https://bob.ibm.com/docs/shell/getting-started/start-bobshell-interactive)

1. Open a terminal
2. Navigate to your project directory
3. Run: `bob`

Once inside:
- Type instructions and press `Enter` to send
- Reference files with `@`: `Explain the functionality in @src/main.js`
- Use slash commands by typing `/` (e.g. `/help`, `/code`, `/ask`)
- Bob requests approval before reading files, writing files, or executing commands

**Best for:** Exploratory coding, debugging, multi-turn conversations, reviewing changes before applying.

### 5.2 Non-Interactive Session

**Source:** [https://bob.ibm.com/docs/shell/getting-started/start-bobshell-non-interactive](https://bob.ibm.com/docs/shell/getting-started/start-bobshell-non-interactive)

Non-interactive sessions run a single prompt and exit — suitable for automation, scripting, and batch processing.

**First-time use:** Accept the license agreement before the first non-interactive run:
```sh
bob --accept-license -p "Explain this project"
```

**Basic usage:**
```sh
# Simple prompt
bob -p "Explain this project"

# Pipe stdin into the prompt
cat buildError.txt | bob -p "Explain this build error"

# Reference a file with @, redirect output to file
bob -p "Review @bigFile.java" > review.md

# Summarize a specific file
bob -p "Summarize the functionality in @src/main.js"
```

**With file modifications (auto-approve tools):**
```sh
bob -p "Fix bugs in @app.js" --yolo
```

**Structured output:**
```sh
bob -p "What Java version is this application using? Check @pom.xml. Enclose the answer in markdown tags" > analysis.md
```

**Multi-line prompts (save to file and pipe):**
```sh
cat prompt.txt | bob -p -
```

**Best for:** Integrating into automation scripts, processing multiple files, quick insights without interactive sessions, generating documentation.

**Tips:**
- Be specific about which files to reference
- Use structured output instructions ("Format as JSON", "Enclose in markdown tags")
- Create shell aliases for frequently-used prompts
- Complex multi-step tasks are better handled in interactive mode

---

## 6. CLI Flags Reference

**Sources:** [https://bob.ibm.com/docs/shell/configuration/configuring](https://bob.ibm.com/docs/shell/configuration/configuring), [https://bob.ibm.com/docs/shell/getting-started/install-and-setup](https://bob.ibm.com/docs/shell/getting-started/install-and-setup), [https://bob.ibm.com/docs/shell/troubleshooting/troubleshoot](https://bob.ibm.com/docs/shell/troubleshooting/troubleshoot)

The configuration page contains the official command-line argument table. API-key
authentication is documented on the install/setup page, and `--version` is
mentioned on the troubleshooting page.

| Flag | Short | Description |
|------|-------|-------------|
| `--prompt` | `-p` | Non-interactive prompt — run and exit |
| `--prompt-interactive` | `-i` | Start with an initial prompt, then enter interactive mode |
| `--auth-method api-key` | — | Use API key authentication (`BOBSHELL_API_KEY` env var required); documented on install/setup page |
| `--accept-license` | — | Accept the IBM license agreement |
| `--yolo` | — | Auto-approve all tool calls |
| `--approval-mode` | — | Set tool approval mode |
| `--allowed-tools` | — | Specify tools to auto-approve (without approving everything) |
| `--sandbox` | `-s` | Enable sandbox mode for this session |
| `--include-directories` | — | Add extra directories to the workspace context |
| `--chat-mode` | — | Choose the interaction mode (`code`, `ask`, `plan`, `advanced`) |
| `--hide-intermediary-output` | — | Output only the final completion (suppresses tool call output) |
| `--debug` | `-d` | Enable debug mode |
| `--show-license` | — | Show full license file paths |
| `--instance-id` | — | Specify instance ID for the session |
| `--team-id` | — | Specify team ID for the session |
| `--version` | — | Show installed version; mentioned in troubleshooting docs |

Not in the public command-line argument table as of the current verification:
`--output-format`, `stream-json`, and any published NDJSON event-schema flag.

---

## 7. Referencing Files in Prompts

**Source:** [https://bob.ibm.com/docs/shell/getting-started/start-bobshell-non-interactive](https://bob.ibm.com/docs/shell/getting-started/start-bobshell-non-interactive)

Use the `@` symbol to reference files directly in prompts. Bob Shell reads the file content and includes it in its context.

```sh
# Single file
bob -p "Explain @BILLING.cob"

# Multiple files (COBOL main + copybook)
bob -p "Analyze @BILLING.cob using the copybook @CUSTOMER.cpy"

# Pipe stdin
cat error.log | bob -p "What caused this error?"
```

---

## 8. Output & Streaming

**Source:** Empirical / project notes, not official public IBM documentation.

> **Verification note:** The public IBM Bob Shell pages available at
> `https://bob.ibm.com/docs/shell` document non-interactive output redirection
> and structured-output prompting, but they do **not** currently list the
> `--output-format` flag. Treat this section as installed-CLI behavior that
> must be rechecked with `bob --help` / `bob --version` whenever the Bob Shell
> version changes.

Project notes suggest Bob Shell may support multiple output formats via an
undocumented `--output-format` flag:

| Format | Description |
|--------|-------------|
| `stream-json` | NDJSON (newline-delimited JSON) stream — one event object per line |
| `json` | Buffered single JSON object (full response at end) |
| *(default)* | Human-readable terminal output |

### 8.1 NDJSON Stream Format (`--output-format stream-json`)

Each line is a JSON object. The relevant events for extracting answers:

**Answer event — the AI's final response:**
```json
{"type":"tool_use","tool_name":"attempt_completion","parameters":{"result":"<answer text here>"}}
```

**Stats event — usage metadata (last event):**
```json
{"type":"result","stats":{"input_tokens":123,"output_tokens":456,"total_tokens":579}}
```

### 8.2 Experimental Non-Interactive Command

```sh
BOBSHELL_API_KEY=<key> bob \
  --auth-method api-key \
  --accept-license \
  --output-format stream-json \
  --chat-mode ask \
  --hide-intermediary-output \
  -p "What does this COBOL program do? @BILLING.cob @CUSTOMER.cpy"
```

Do not make this the only supported provider path until the installed CLI proves
the flag exists. The official fallback is plain stdout with prompt-level
instructions such as "Format the answer as JSON".

Parse the answer by filtering the NDJSON stream for `attempt_completion` events:
```ts
// Pseudocode for BobShellProvider
for (const line of ndjsonLines) {
  const event = JSON.parse(line);
  if (event.type === 'tool_use' && event.tool_name === 'attempt_completion') {
    return event.parameters.result; // this is the answer
  }
  if (event.type === 'result') {
    stats = event.stats; // token usage
  }
}
```

---

## 9. Operating Modes

**Source:** [https://bob.ibm.com/docs/shell](https://bob.ibm.com/docs/shell)

Switch modes with slash commands (`/code`, `/ask`, `/plan`) or the `--chat-mode` flag.

| Mode | Flag value | Best for |
|------|-----------|----------|
| Code | `code` | Generating, modifying, refactoring code |
| Ask | `ask` | Querying and analyzing codebases — **use this for batch analysis** |
| Plan | `plan` | Designing and planning implementations |
| Advanced | `advanced` | Complex workflows with full MCP tool access |

**For the Phase 12 provider adapter:** use `--chat-mode ask` — it is optimised for questions about code and returns clean prose answers.

---

## 10. Tools

**Source:** [https://bob.ibm.com/docs/shell/core-concepts/tools](https://bob.ibm.com/docs/shell/core-concepts/tools)

Bob Shell selects tools automatically based on the natural-language request.

| Category | Tool | Description |
|----------|------|-------------|
| Read | `read_file` | View file contents |
| Read | `search_files` | Pattern-based search across files |
| Read | `list_files` | Explore directory structure |
| Read | `list_code_definition_names` | Extract code structure (functions, classes) |
| Write | `write_to_file` | Generate new files or rewrite existing ones |
| Write | `apply_diff` | Make targeted edits to existing files |
| Write | `insert_content` | Add lines at specific locations |
| Command | `execute_command` | Run CLI commands (testing, building) |
| MCP | *(custom)* | Databases, APIs, external services via MCP servers |
| Mode | `switch_mode` | Transition between Code / Ask / Plan modes |
| Question | `ask_followup_question` | Request clarification from the user |

**Tool approval:** By default, Bob Shell requires your approval before reading files, writing files, or executing commands. Use `--yolo` to auto-approve all, or `--allowed-tools` to approve specific tools only.

---

## 11. Configuration System

**Source:** [https://bob.ibm.com/docs/shell/configuration/configuring](https://bob.ibm.com/docs/shell/configuration/configuring)

### 11.1 Priority Order (highest → lowest)

1. Command-line arguments
2. Environment variables
3. System settings file (`/etc/bobshell/settings.json` on Linux)
4. Project settings file (`.bob/settings.json`)
5. User settings file (`~/.bob/settings.json`)
6. System defaults file
7. Hardcoded defaults

### 11.2 Settings File Locations

| Scope | Path |
|-------|------|
| Project | `.bob/settings.json` |
| User | `~/.bob/settings.json` |
| System (Linux) | `/etc/bobshell/settings.json` |
| System (Windows) | `C:\ProgramData\bobshell\settings.json` |
| System (macOS) | `/Library/Application Support/Bob Shell/settings.json` |

### 11.3 General Settings

```json
{
  "general": {
    "preferredEditor": "code",
    "vimMode": false,
    "disableAutoUpdate": false,
    "disableUpdateNag": false,
    "checkpointing": {
      "enabled": false
    }
  }
}
```

### 11.4 Context Settings

```json
{
  "context": {
    "fileName": "AGENTS.md",
    "discoveryMaxDirs": 200,
    "includeDirectories": [],
    "loadFromIncludeDirectories": true,
    "fileFiltering": {
      "respectGitIgnore": true,
      "respectBobIgnore": true,
      "enableRecursiveFileSearch": true
    }
  }
}
```

### 11.5 Tools Settings

```json
{
  "tools": {
    "sandbox": false,
    "usePty": false,
    "core": [],
    "exclude": [],
    "allowed": [],
    "discoveryCommand": "",
    "callCommand": ""
  }
}
```

### 11.6 UI Settings (notable options)

| Key | Type | Description |
|-----|------|-------------|
| `theme` | string | UI colour theme |
| `hideTips` | boolean | Hide helpful tips |
| `hideBanner` | boolean | Hide the application banner |
| `hideFooter` | boolean | Hide the footer |
| `showMemoryUsage` | boolean | Show memory usage stats |
| `showLineNumbers` | boolean | Show line numbers in chat |
| `showCitations` | boolean | Show citations for generated text |
| `accessibility.disableLoadingPhrases` | boolean | Disable loading phrases |

---

## 12. Custom Rules (AGENTS.md / .bobrules)

**Source:** [https://bob.ibm.com/docs/shell/configuration/bobshell-custom-rules](https://bob.ibm.com/docs/shell/configuration/bobshell-custom-rules)

Custom rules influence how Bob Shell responds — coding style, documentation format, testing methodology, naming conventions.

### 12.1 Rule Files

| File | Scope |
|------|-------|
| `.bobrules` | Workspace-level rules (all modes) |
| `.bobrules-code` | Code mode only |
| `.bobrules-{modeSlug}` | Any specific mode |
| `.bob/rules/` | Directory of rule files (workspace) |
| `.bob/rules-code/` | Code mode rule directory |
| `~/.bob/rules/` | Global rules (Linux/macOS) |
| `%USERPROFILE%\.bob\rules\` | Global rules (Windows) |
| `AGENTS.md` | Team-standard rules (auto-loaded, version-controlled) |

### 12.2 Priority

Global rules load first → workspace rules second → mode-specific rules override general rules → workspace rules override global rules.

### 12.3 AGENTS.md

Place an `AGENTS.md` in the workspace root for team-wide AI behaviour standardisation. It is loaded automatically. Disable with `"bob-shell.useAgentRules": false` in settings.

### 12.4 File Processing Rules

- All files in a rules directory are read recursively
- Processed in alphabetical order
- Cache files are filtered automatically (`.DS_Store`, `*.bak`, `*.cache`, `*.log`, `*.tmp`, `Thumbs.db`)
- Symbolic links supported with a max depth of 5
- Empty files are silently skipped

### 12.5 Example Rules

```
# .bobrules
Always use relative paths when suggesting file operations in the terminal.
Format shell script examples with proper error handling using set -euo pipefail.
Prefer POSIX-compliant shell syntax for cross-platform compatibility.
```

---

## 13. Memory Files (Imports)

**Source:** [https://bob.ibm.com/docs/shell/configuration/memory-import](https://bob.ibm.com/docs/shell/configuration/memory-import)

Break large `AGENTS.md` files into smaller, reusable components using import syntax.

### 13.1 Import Syntax

Use the `@` symbol inside `AGENTS.md` or rule files:

```
@./components/instructions.md       # same directory
@../shared/conventions.md           # parent directory
@./backend/api-guidelines.md        # subdirectory
@/absolute/path/to/rules.md         # absolute path
```

### 13.2 Safety Mechanisms

- Circular import detection (prevents infinite loops)
- File access validation (imports restricted to specified directories)
- Maximum depth: 5 levels

### 13.3 Error Handling

```html
<!-- Error importing ./file.md: File not found -->
<!-- Error importing ./file.md: Permission denied -->
```

---

## 14. Ignoring Files (.bobignore)

**Source:** [https://bob.ibm.com/docs/shell/configuration/ignoring-files](https://bob.ibm.com/docs/shell/configuration/ignoring-files)

Control which files Bob Shell can access. Create `.bobignore` in the project root.

> **Note:** Changes to `.bobignore` require restarting the Bob Shell session to take effect.

### 14.1 Pattern Syntax

| Pattern | Description | Example |
|---------|-------------|---------|
| `file.txt` | Exact file match | `apikeys.txt` |
| `*.ext` | All files with extension | `*.log` |
| `/dir/` | Directory match | `/node_modules/` |
| `/path/to/file` | Path anchored to root | `/src/config/secrets.json` |
| `!pattern` | Negate a previous pattern | `!important.md` |
| `#` | Comment line | `# API credentials` |

### 14.2 Common .bobignore Template

```
# Sensitive information
.env
secrets/
*password*
*credential*
*apikey*

# Large directories
node_modules/
.git/
dist/
build/

# Binary and media files
*.zip
*.tar.gz
*.mp4
*.jpg
*.png

# Log files
*.log
logs/
```

### 14.3 Negation Example

```
# Ignore all markdown except README and docs
*.md
!README.md
!docs/*.md
```

---

## 15. Slash Commands

**Source:** [https://bob.ibm.com/docs/shell/features/slash-commands](https://bob.ibm.com/docs/shell/features/slash-commands)

Type `/` in an interactive session to see all available commands with fuzzy search autocomplete.

### 15.1 Built-in Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/code` | Switch to Code mode |
| `/ask` | Switch to Ask mode |
| `/plan` | Switch to Plan mode |
| `/instance` | Switch IBM instance or team, view budget/usage |
| `/restore` | List and restore checkpoints |
| `/restore <file>` | Restore a specific checkpoint |
| `/memory refresh` | Reload context/AGENTS.md files |
| `/memory show` | Show currently loaded context |
| `/editor` | Configure external diff editor |

### 15.2 Custom Commands

Create markdown files in:
- `.bob/commands/` — project-specific (version-controlled with repo)
- `~/.bob/commands/` — global (available across all projects)

The filename becomes the command name: `review.md` → `/review`

**Command file with metadata:**
```markdown
---
description: Review a file for code quality issues
argument-hint: <file-path>
---

Review the file at $1 for:
- Code quality and readability
- Potential bugs or edge cases
- Performance issues
- Security vulnerabilities

Provide a structured report with severity levels.
```

**Conflict resolution:** Project commands override global commands with the same name. Duplicates get a number appended automatically.

**Cross-platform:** Slash commands work identically in Bob Shell and Bob IDE.

---

## 16. Checkpointing

**Source:** [https://bob.ibm.com/docs/shell/features/checkpointing](https://bob.ibm.com/docs/shell/features/checkpointing)

Creates automatic snapshots of the project before applying changes. Disabled by default.

### 16.1 How It Works

When a file-modifying tool call is approved, Bob Shell:
1. Creates a Git snapshot in a shadow repository at `~/.bob/history/<project_hash>`
2. Saves conversation history up to that point
3. Records the tool call that was about to execute

All data is stored locally. Works non-intrusively alongside existing Git workflows.

### 16.2 Enable Checkpointing

```json
{
  "general": {
    "checkpointing": {
      "enabled": true
    }
  }
}
```

### 16.3 Restore Checkpoints

```sh
/restore                    # list checkpoints with timestamps and file names
/restore <checkpoint_file>  # restore a specific checkpoint
```

### 16.4 Limitations

- Only tracks files already under version control or modified by Bob Shell
- External changes made outside the tool are not captured

---

## 17. Sandboxing

**Source:** [https://bob.ibm.com/docs/shell/security/sandboxing](https://bob.ibm.com/docs/shell/security/sandboxing)

Isolates potentially dangerous operations from the host system.

### 17.1 Enable Sandboxing

```sh
# Per command
bob -s -p "Run and test @script.sh"

# Per session via env var
BOB_SHELL_SANDBOX=true bob
```

Or persistently in `settings.json`:
```json
{ "tools": { "sandbox": true } }
```

### 17.2 Sandboxing Methods

**macOS Seatbelt (default on macOS):**
- Uses `sandbox-exec` with a "permissive-open" profile
- Restricts writes outside the project directory
- Allows most other operations

**Container-based (Docker/Podman — cross-platform):**
- Complete process isolation
- Requires building or accessing a sandbox image
- Custom environments via `.bob/sandbox.Dockerfile`

```dockerfile
# .bob/sandbox.Dockerfile
FROM bobshell-sandbox
RUN apt-get install -y your-dependencies
```

Build and use the custom sandbox image:

```sh
BUILD_SANDBOX=1 bob -s
```

### 17.3 macOS Seatbelt Profiles

| Profile | Network | Write scope | Use case |
|---------|---------|-------------|----------|
| `permissive-open` | Yes | Project dir | Default — standard dev |
| `permissive-closed` | No | Project dir | Offline work |
| `permissive-proxied` | Via proxy | Project dir | Corporate proxy |
| `restrictive-open` | Yes | Minimal | High security |
| `restrictive-closed` | No | Minimal | Maximum isolation |

### 17.4 Limitations

- Not a complete security solution
- Performance overhead with container-based sandboxing
- GUI applications typically fail inside sandbox
- Only the project directory is accessible by default
- Restrictions on symlinks, privileged system commands, hardware access
- The `create-pr` command is not compatible with sandbox sessions

### 17.5 Trusted Folders

**Source:** [https://bob.ibm.com/docs/shell/security/trusted-folders](https://bob.ibm.com/docs/shell/security/trusted-folders)

Bob Shell tracks workspace trust decisions in `~/.bob/trustedFolders.json`.
Untrusted folders run in a restricted safe mode:

- project `.bob/settings.json` is ignored
- project `.env` files are ignored
- tool auto-approval is disabled
- automatic memory loading is disabled
- MCP servers do not connect
- custom commands are not loaded

Non-interactive sessions do not display the trust prompt. They use IDE trust if
available, then `~/.bob/trustedFolders.json`, and otherwise default to trusted.
For automation, preconfigure trust decisions before relying on non-interactive
Bob runs.

---

## 18. MCP (Model Context Protocol)

**Source:** [https://bob.ibm.com/docs/shell/configuration/mcp/mcp-bobshell](https://bob.ibm.com/docs/shell/configuration/mcp/mcp-bobshell)

MCP extends Bob Shell's capabilities with custom tools and external integrations.

### 18.1 Configuration

```json
{
  "mcp": {
    "serverCommand": "node ./mcp-server.js",
    "allowed": ["my-server"],
    "excluded": []
  },
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["./mcp-server.js"],
      "env": { "API_KEY": "..." },
      "cwd": "/project",
      "timeout": 30000,
      "alwaysAllow": ["tool-a"],
      "disabled": false
    }
  }
}
```

The dedicated MCP page documents global config in
`~/.bob/mcp_settings.json`, project config in `.bob/mcp.json`, and project
server definitions overriding global definitions with the same server name.

### 18.2 Remote MCP Servers

```json
{
  "mcpServers": {
    "remote-server": {
      "url": "https://your-server-url.com/mcp",
      "headers": { "Authorization": "Bearer <token>" },
      "alwaysAllow": ["tool-a"]
    }
  }
}
```

The dedicated MCP page documents `url` for SSE transport and `httpURL` for
streamable HTTP transport.

### 18.3 Legacy / General Settings Shape

The general configuration page also documents top-level MCP settings:

```json
{
  "mcp": {
    "serverCommand": "node ./mcp-server.js",
    "allowed": ["my-server"],
    "excluded": []
  }
}
```

### 18.4 Use Cases

- Connect to databases and APIs from the terminal
- Access specialised development and operations tools
- Integrate with internal systems
- Create custom automation workflows for DevOps

> **Note:** MCP is only available in **Advanced mode** (`--chat-mode advanced` or `/advanced`).

---

## 19. Changelog

**Source:** [https://bob.ibm.com/docs/shell/changelog](https://bob.ibm.com/docs/shell/changelog)

| Version | Date | Notable Changes |
|---------|------|-----------------|
| **1.0.3** | April 2026 | **API key authentication** — enables programmatic workflows and CI/CD pipeline integration without interactive login |
| **1.0.2** | April 2026 | Stability improvements and bug fixes |
| **1.0.1** | March 2026 | Initial release: interactive + non-interactive sessions, Code/Ask/Plan/Advanced modes, CLI tools, MCP integration, custom modes, slash commands, editor terminal support |

---

## 20. Official Documentation Coverage Audit

**Source:** Current public navigation under [https://bob.ibm.com/docs/shell](https://bob.ibm.com/docs/shell)

Official Bob Shell documentation pages found in the public docs:

- Welcome to Bob Shell: `/docs/shell`
- Changelog: `/docs/shell/changelog`
- FAQ: `/docs/shell/faq`
- Installing: `/docs/shell/getting-started/install-and-setup`
- Uninstalling: `/docs/shell/getting-started/uninstalling-bobshell`
- Starting an interactive session: `/docs/shell/getting-started/start-bobshell-interactive`
- Starting a non-interactive session: `/docs/shell/getting-started/start-bobshell-non-interactive`
- Usage examples: `/docs/shell/getting-started/bobshell-examples`
- Tools: `/docs/shell/core-concepts/tools`
- Configuring: `/docs/shell/configuration/configuring`
- Keyboard shortcuts: `/docs/shell/configuration/keyboard-shortcuts`
- Custom rules: `/docs/shell/configuration/bobshell-custom-rules`
- Custom modes: `/docs/shell/configuration/custom-modes-bobshell`
- Integrating with Bob IDE: `/docs/shell/configuration/ide-integration`
- Ignoring files: `/docs/shell/configuration/ignoring-files`
- Memory files: `/docs/shell/configuration/memory-import`
- Telemetry data: `/docs/shell/configuration/telemetry-data-shell`
- MCP: `/docs/shell/configuration/mcp/mcp-bobshell`
- Checkpointing: `/docs/shell/features/checkpointing`
- Slash commands: `/docs/shell/features/slash-commands`
- Instance command: `/docs/shell/features/instance-command`
- Security guidelines: `/docs/shell/security/bob-security-guidance`
- Sandboxing: `/docs/shell/security/sandboxing`
- Trusted folders: `/docs/shell/security/trusted-folders`
- Troubleshooting: `/docs/shell/troubleshooting/troubleshoot`

Claims that are official and relevant to this project:

- API-key authentication is documented for automation, CI/CD, and
  non-interactive environments.
- `BOBSHELL_API_KEY` plus `--auth-method api-key` is the documented automation
  authentication path.
- `@file` references are documented for providing project context.
- `--hide-intermediary-output`, `--accept-license`, `--chat-mode`,
  `--instance-id`, and `--team-id` are documented CLI flags.
- The official changelog currently lists `1.0.3`, `1.0.2`, and `1.0.1`.

Claims that are not official public documentation and must be treated as
runtime observations or open questions:

- `--output-format`
- `stream-json`
- NDJSON output schema
- `attempt_completion` final-answer event
- `result.stats` token metadata event
- An official troubleshooting fix for `Missing authorization code`
- Skills / `.bob/skills` as a Bob Shell feature
- Orchestrator mode as a Bob Shell built-in mode

If these non-official items are used in this project, add fixture tests and a
local CLI compatibility check before enabling real Bob execution.

---

## 21. Phase 12 Integration Notes

This section documents the specifics needed to build `BobShellProvider` in this project (`src/providers/bob/BobShellProvider.ts`).

### 21.1 Prerequisite

Obtain an API key with **"Inference" scope** from the Bob web portal. Set `BOBSHELL_API_KEY` in the environment (or in `.env`).

IBM also documents **General** API keys, but those require additional team/instance
context for inference requests. For this provider, prefer an **Inference** key
because no extra team or instance headers/flags are required by the documented
Bob Shell CLI flow.

### 21.2 Command Template

Officially documented baseline:

```sh
BOBSHELL_API_KEY=<key> bob \
  --auth-method api-key \
  --accept-license \
  --chat-mode ask \
  --hide-intermediary-output \
  -p "<question text> @<main-file> [@<context-file> ...]"
```

Experimental stream-output variant, only after installed-CLI verification:

```sh
BOBSHELL_API_KEY=<key> bob \
  --auth-method api-key \
  --accept-license \
  --output-format stream-json \
  --chat-mode ask \
  --hide-intermediary-output \
  -p "<question text> @<main-file> [@<context-file> ...]"
```

Run the command with `cwd` set to the isolated job workspace returned by
`WorkspaceBuilder`. Do **not** use `--yolo` for the analyzer provider: the
official non-interactive docs say read-only tools are available by default, and
`--yolo` enables file modifications. This project only needs Bob to read the
workspace files and produce an answer.

Default implementation should start with the officially documented baseline:
plain stdout plus prompt-level JSON instructions. If
`--output-format stream-json` is supported by the installed Bob Shell version,
the provider may enable the stream parser behind a feature flag or compatibility
check. Keep `--hide-intermediary-output` when available to reduce parsing noise.

### 21.3 Output Parsing

Official docs do not publish a structured output schema. The parser should first
support plain stdout and prompt-requested JSON. If the experimental stream
variant is enabled, read stdout line by line and parse each line as JSON:

```ts
// Extract answer
if (event.type === 'tool_use' && event.tool_name === 'attempt_completion') {
  answer = event.parameters.result;
}

// Extract token usage
if (event.type === 'result') {
  tokensUsed = event.stats.total_tokens;
  modelId = event.stats.model ?? null;
}
```

The provider prompt should ask for this JSON object shape:

```json
{
  "answer": "string",
  "confidence": "high|medium|low",
  "evidence": [
    {
      "file": "string",
      "location": "string",
      "symbol": "string|null",
      "explanation": "string"
    }
  ],
  "unresolved": ["string"],
  "missingContext": ["string"]
}
```

Use `unresolved`, not `unresolvedDependencies`, in provider output. Keep the
main file, language, and question metadata outside the provider answer because
the job already owns that context.

### 21.4 File Reference Strategy

For a COBOL bundle with a main file and copybooks, build the `@file` references from the workspace:

```ts
const refs = [mainFile, ...contextFiles]
  .map(f => `@${f.relativePath}`)
  .join(' ');
const prompt = `${question.text} ${refs}`;
```

Use paths relative to `workspacePath`, not absolute source-repository paths.
This keeps provider prompts aligned with the isolated workspace and avoids
exposing unrelated host filesystem layout.

The prompt builder should support two source modes:

```ts
type PromptFileMode = 'file-reference' | 'inline-content';
```

- Bob runtime default: `file-reference`
- local/unit-test default: `inline-content` or fixture content
- inline mode default ceiling: 50 KB total bundle size

Never silently truncate source files. If inline mode exceeds the configured
maximum, reject with a clear error and require file-reference mode.

### 21.5 Error Handling

Non-retryable:

- `BOBSHELL_API_KEY` not set
- provider disabled
- Bob executable missing or not executable
- unsupported CLI flag
- malformed provider config
- invalid provider ID
- missing workspace

Retryable:

- timeout
- transient process failure
- transient network error
- missing final answer in configured output mode
- malformed or partial model output
- parse failure

Classify parse failures as `failureKind: "parse_error"` and cap them lower than
generic transient failures, with a recommended maximum of two attempts.

### 21.6 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOBSHELL_API_KEY` | Yes | API key with Inference scope |
| `BOB_COMMAND` | No | CLI binary name/path; defaults to `bob` |
| `BOB_PROVIDER_ENABLED` | No | Explicitly enables the Bob provider; default should be false |
| `BOB_TIMEOUT_MS` | No | Child process timeout; recommended default 180000 |
| `BOB_MAX_BUFFER_MB` | No | Child process stdout/stderr buffer cap; recommended default 20 |
| `BOB_MAX_INLINE_BYTES` | No | Inline prompt source ceiling; recommended default 51200 |
| `BOB_SHELL_SANDBOX` | No | Set to `true` to sandbox Bob Shell execution |

Keep `BOB_COMMAND` as the command config name. It covers PATH lookup, absolute
paths, and wrapper scripts, and it already exists in the project.

### 21.7 Provider Health Contract

Extend the provider interface with optional health support:

```ts
export type ProviderHealth = {
  providerId: string;
  name: string;
  type: 'stub' | 'shell' | 'http' | 'local';
  configured: boolean;
  enabled: boolean;
  available: boolean;
  retryable: boolean;
  reason?: string;
  details?: Record<string, unknown>;
};
```

Bob health should check:

- provider is explicitly enabled
- `BOBSHELL_API_KEY` exists
- `BOB_COMMAND` resolves and `BOB_COMMAND --version` exits successfully
- timeout, buffer, and inline-size settings are valid

Run creation should reject unavailable providers with HTTP 400 before generating
jobs. If readiness fails later during worker execution, fail the job with a
non-retryable error and do not requeue it.

### 21.8 Project Readiness Checklist

Before implementing `BobShellProvider`, verify the installed Bob Shell CLI:

1. `bob` is on `PATH` or `BOB_COMMAND` points to the binary.
2. `bob --auth-method api-key -p "..."` works with `BOBSHELL_API_KEY`.
3. `bob --accept-license -p "..."` succeeds in non-interactive mode.
4. `bob --output-format stream-json --hide-intermediary-output -p "..."`
   produces newline-delimited JSON with an `attempt_completion` event.
5. Relative `@file` references resolve when the child process `cwd` is the
   isolated workspace path.

Current workspace note: Bob Shell 1.0.3 was launched successfully in the user's
terminal, but the Codex command environment still cannot resolve `bob` on
`PATH`. Set `BOB_COMMAND` to the executable path if the worker environment has
the same issue, then revalidate the streaming contract from this repository.

### 21.9 No-API-Key Testing Path

There is no documented way to run reliable non-interactive Bob Shell automation
without Bob access. IBM documents two auth paths:

- IBMid browser authentication for interactive sessions.
- API-key authentication for automation, CI/CD, scheduled workflows, and
  non-interactive sessions.

Without `BOBSHELL_API_KEY`, we can still test most of the project integration
without calling Bob:

1. Keep `src/worker/worker.ts` on `StubProvider`.
2. Implement and unit-test `buildBobPrompt.ts` using relative `@file`
   references against the isolated workspace.
3. Implement and unit-test `parseBobOutput.ts` from saved fixture outputs.
4. Implement `BobShellProvider` behind configuration, but make missing
   `BOBSHELL_API_KEY` fail fast with a configuration error.
5. Use manual interactive Bob only to explore prompt quality. This is useful
   for prompt design, but it is not a substitute for the provider because it
   cannot be driven deterministically by the worker.

If interactive IBMid login succeeds, a temporary manual probe can be run from an
isolated directory:

```sh
mkdir -p /tmp/bob-probe
cp path/to/main.cbl /tmp/bob-probe/
cp path/to/context.cpy /tmp/bob-probe/
cd /tmp/bob-probe
bob
```

Then ask Bob manually with relative file references, for example:

```text
In ask mode, answer this analysis question using @main.cbl and @context.cpy:
What does this program do?
```

This validates whether the question phrasing and `@file` context are sensible,
but it does not validate child-process spawning, stdout parsing, exit codes,
timeouts, or API-key authentication.

### 21.10 Open Doubts To Verify

These points are not fully settled by the public docs and should be verified
against the installed Bob Shell 1.0.3 CLI before enabling the real provider:

- Whether `--output-format stream-json` is officially supported in 1.0.3. The
  public configuration docs list `--hide-intermediary-output`, `--chat-mode`,
  `--accept-license`, `--instance-id`, and `--team-id`, but not
  `--output-format`.
- Exact NDJSON event schema for final answers and token usage. The current
  expected `attempt_completion` and `result.stats` events came from empirical
  notes, not public docs.
- Whether `--hide-intermediary-output` can be combined with stream JSON without
  suppressing events needed by the parser.
- Whether an already completed IBMid interactive login can be reused for
  `bob -p "..."` without `--auth-method api-key`. Even if it works locally, it
  is not suitable for CI/worker automation because it depends on user session
  state.
- Whether a General API key plus `--team-id` / `--instance-id` works with Bob
  Shell. The API-key docs say General keys need team context for inference, but
  the Shell install docs recommend Inference keys.
- How Bob signals deterministic configuration errors versus transient provider
  errors in exit code, stderr, and JSON output.
- Whether the `Missing authorization code` IBMid error has an official fix. The
  troubleshooting docs cover certificate errors and log locations but do not
  mention that exact message.
