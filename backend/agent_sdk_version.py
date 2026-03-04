"""
agent_sdk_version.py — REFERENCE ONLY: Claude Agent SDK version of agent.py

This shows the same agent behaviour using claude_agent_sdk instead of the
raw AsyncAnthropic client. Compare side-by-side with agent.py to see what
the SDK abstracts away.

NOT used in Phase 4. The FastAPI backend uses agent.py (raw SDK) for full
control over streaming to the frontend.

────────────────────────────────────────────────────────────────
What agent.py does MANUALLY that this file gets for FREE:
────────────────────────────────────────────────────────────────
  1. Launch the MCP server subprocess                     (stdio_client)
  2. MCP handshake                                        (session.initialize)
  3. Tool discovery                                       (session.list_tools)
  4. Convert MCP tool format → Anthropic tool format
  5. The entire agentic loop:
       while True:
           call Claude
           if tool_use → execute via MCP → feed results back
           if end_turn → break
  6. Building/tracking the messages list each turn

All of that disappears here. You just pass the MCP server config and a prompt.

────────────────────────────────────────────────────────────────
Setup (one-time, in backend/):
────────────────────────────────────────────────────────────────
    uv add claude-agent-sdk

Run:
    uv run python agent_sdk_version.py
"""

import anyio
from pathlib import Path

from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage
from dotenv import load_dotenv

load_dotenv()

# Same path resolution as agent.py
MCP_SERVER_DIR = Path(__file__).parent.parent / "mcp-server"


async def run_agent(user_message: str) -> None:
    print(f"Question: {user_message}")
    print("=" * 60)

    # This single call replaces ~100 lines of boilerplate in agent.py.
    #
    # The Agent SDK:
    #   - Launches the MCP server via the command/args/cwd below
    #   - Does the MCP handshake and discovers tools automatically
    #   - Runs the full agentic loop internally
    #   - Streams messages as they complete each turn
    #
    # mcp_servers format: { "name": { "command": ..., "args": [...], "cwd": ... } }
    # This is equivalent to the StdioServerParameters in agent.py.
    async for message in query(
        prompt=user_message,
        options=ClaudeAgentOptions(
            mcp_servers={
                "finance": {
                    "command": "uv",
                    # The Agent SDK's mcp_servers only supports: command, args, env.
                    # "cwd" is silently ignored — if you pass it, the MCP server
                    # launches from the wrong directory, uv can't find the
                    # virtualenv, and Claude gets zero tools (no error, just silence).
                    #
                    # Fix: use uv's --directory flag instead. This is equivalent to
                    # cd mcp-server/ && uv run python main.py
                    "args": ["run", "--directory", str(MCP_SERVER_DIR), "python", "main.py"],
                }
            },
            model="claude-opus-4-6",

            # The Agent SDK wraps the Claude Code CLI, which ships with a full
            # set of built-in tools: Read, Write, Edit, Bash, WebSearch,
            # WebFetch, Glob, Grep, Task, AskUserQuestion.
            #
            # By default ALL of them are available. Without this line, Claude
            # sees both our MCP finance tools AND the built-in WebSearch, and
            # picks WebSearch to answer stock-price questions — triggering a
            # permission prompt.
            #
            # disallowed_tools explicitly removes the built-in tools we don't
            # want, leaving only our MCP finance tools for Claude to use.
            disallowed_tools=[
                "WebSearch", "WebFetch",    # would bypass our MCP data layer
                "Read", "Write", "Edit",    # file system — not relevant here
                "Bash", "Glob", "Grep",     # shell / file search — same
                "Task",                     # subagents — not needed
            ],

            # Permission modes explained:
            #   "default"    — prompts user before dangerous ops
            #   "dontAsk"    — suppresses prompts but still BLOCKS MCP tools
            #   "bypassPermissions" — skips ALL permission checks, including MCP
            #
            # MCP tools require "bypassPermissions" to execute without being
            # blocked. No extra acknowledgement flag is needed in claude-agent-sdk.
            permission_mode="bypassPermissions",
        ),
    ):
        # The SDK emits several message types as the agent works.
        # ResultMessage is the final answer once the loop completes.
        if isinstance(message, ResultMessage):
            print("\nClaude's answer:")
            print("-" * 60)
            print(message.result)


if __name__ == "__main__":
    question = (
        "What is Apple's current stock price, and how is the broader "
        "market doing today?"
    )
    anyio.run(run_agent, question)
