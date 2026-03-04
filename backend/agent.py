"""
agent.py — Phase 3: Claude Agent wired to the MCP server

This is a standalone CLI script. Run it with:
    uv run python agent.py

What it does:
  1. Launches the MCP server as a subprocess (stdio transport)
  2. Asks the MCP server: "what tools do you have?"
  3. Passes those tools to Claude (Anthropic API)
  4. Runs the agentic loop:
       - Claude responds with tool_use → we execute tools via MCP → feed results back
       - Claude responds with end_turn  → print answer → done
"""

import asyncio
import json
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# ---------------------------------------------------------------------------
# Load environment variables
# ---------------------------------------------------------------------------
# python-dotenv reads .env and sets ANTHROPIC_API_KEY as an environment
# variable so the Anthropic client can find it automatically.
load_dotenv()

# ---------------------------------------------------------------------------
# Where is the MCP server?
# ---------------------------------------------------------------------------
# Path(__file__)           → absolute path to THIS file (agent.py)
# .parent                  → the backend/ folder
# .parent                  → the marketmind/ root folder
# / "mcp-server"           → the mcp-server/ folder
#
# Using Path makes this work regardless of what directory you run from.
MCP_SERVER_DIR = Path(__file__).parent.parent / "mcp-server"


# ---------------------------------------------------------------------------
# The agent
# ---------------------------------------------------------------------------
async def run_agent(user_message: str) -> None:
    """
    Run a single question through the Claude + MCP agent.

    This function:
      - Launches the MCP server as a subprocess
      - Discovers available tools
      - Runs the agentic loop until Claude gives a final answer
    """

    # AsyncAnthropic is the async version of the Anthropic client.
    # It picks up ANTHROPIC_API_KEY from the environment automatically.
    client = anthropic.AsyncAnthropic()

    # ---------------------------------------------------------------------------
    # StdioServerParameters — how to start the MCP server
    # ---------------------------------------------------------------------------
    # This tells the MCP client: "to start the MCP server, run this command
    # in this directory."
    #
    #   command = "uv"                        → the executable to run
    #   args    = ["run", "python", "main.py"] → arguments to it
    #   cwd     = MCP_SERVER_DIR               → run it from the mcp-server/ folder
    #                                             so uv finds the right virtualenv
    #
    # Equivalent to opening a terminal, cd-ing to mcp-server/, and running:
    #   uv run python main.py
    server_params = StdioServerParameters(
        command="uv",
        args=["run", "python", "main.py"],
        cwd=str(MCP_SERVER_DIR),
    )

    print(f"Question: {user_message}")
    print("=" * 60)
    print("Starting MCP server...")

    # ---------------------------------------------------------------------------
    # stdio_client — launch the MCP server and open communication pipes
    # ---------------------------------------------------------------------------
    # This is an async context manager ("async with") that:
    #   1. Launches the MCP server as a subprocess
    #   2. Opens two pipes: (read, write)
    #      - write: we send messages TO the MCP server
    #      - read:  we receive messages FROM the MCP server
    #   3. Automatically kills the subprocess when we exit the "async with" block
    async with stdio_client(server_params) as (read, write):

        # ---------------------------------------------------------------------------
        # ClientSession — wraps the raw pipes with the MCP protocol
        # ---------------------------------------------------------------------------
        # The MCP protocol defines a specific message format (JSON-RPC).
        # ClientSession handles serializing/deserializing those messages
        # so we can call high-level methods like .list_tools() and .call_tool().
        async with ClientSession(read, write) as session:

            # --- HANDSHAKE ---
            # initialize() is the MCP "hello" handshake:
            #   client → "I'm an MCP client, here are my capabilities"
            #   server → "I'm an MCP server, here are MY capabilities"
            # Must be called before anything else.
            await session.initialize()
            print("MCP server connected.\n")

            # --- TOOL DISCOVERY ---
            # list_tools() asks the MCP server: "what tools do you expose?"
            # Returns a list of Tool objects, each with:
            #   .name        → e.g. "get_stock_quote"
            #   .description → e.g. "Get the current quote for a stock ticker..."
            #   .inputSchema → JSON Schema defining the tool's parameters
            tools_result = await session.list_tools()

            print(f"Available tools ({len(tools_result.tools)}):")
            for t in tools_result.tools:
                print(f"  • {t.name}")
            print()

            # --- FORMAT CONVERSION ---
            # The MCP tool format and the Anthropic tool format are slightly different.
            # We need to convert from MCP's format to what Claude's API expects.
            #
            # MCP tool:       { name, description, inputSchema }
            # Anthropic tool: { name, description, input_schema }  ← snake_case
            tools = [
                {
                    "name": tool.name,
                    "description": tool.description,
                    "input_schema": tool.inputSchema,
                }
                for tool in tools_result.tools
            ]

            # --- INITIAL MESSAGE ---
            # The Anthropic API is stateless — we send the full conversation
            # history on every request. We start with just the user's question.
            messages = [{"role": "user", "content": user_message}]

            # -----------------------------------------------------------------------
            # THE AGENTIC LOOP
            # -----------------------------------------------------------------------
            # We keep calling Claude until it says stop_reason == "end_turn".
            #
            # Each iteration is one "turn":
            #   Turn 1: Claude reads the question → asks for tool(s)
            #   Turn 2: We send tool results → Claude asks for more tools, OR answers
            #   Turn N: Claude answers → loop ends
            #
            # In practice, for simple questions this is 2 turns.
            # For complex ones (e.g. "compare Apple vs Microsoft") it might be 3-4.
            # -----------------------------------------------------------------------
            turn = 0
            while True:
                turn += 1
                print(f"[Turn {turn}] Calling Claude...")

                response = await client.messages.create(
                    model="claude-opus-4-6",
                    max_tokens=4096,
                    # Pass the tool definitions so Claude knows what's available.
                    # Claude reads the names, descriptions, and schemas to decide
                    # which tool to call and with what arguments.
                    tools=tools,
                    messages=messages,
                )

                print(f"         stop_reason = {response.stop_reason}")

                # ---------------------------------------------------------------
                # CASE 1: Claude wants to use tools
                # ---------------------------------------------------------------
                # stop_reason == "tool_use" means Claude's response contains
                # one or more tool_use blocks — it's asking us to run tools.
                if response.stop_reason == "tool_use":

                    # Add Claude's response to the conversation history.
                    # IMPORTANT: we append the full response.content (which includes
                    # the tool_use blocks), not just the text. If we only appended
                    # the text, Claude would lose track of what tools it called.
                    messages.append({
                        "role": "assistant",
                        "content": response.content,
                    })

                    # Execute each tool call and collect results
                    tool_results = []
                    for block in response.content:
                        if block.type == "tool_use":
                            print(f"         Tool call: {block.name}({json.dumps(block.input)})")

                            # call_tool() sends the tool call to the MCP server
                            # and waits for the result synchronously.
                            # block.name  → e.g. "get_stock_quote"
                            # block.input → e.g. {"symbol": "AAPL"}
                            result = await session.call_tool(block.name, block.input)

                            # The result comes back as a list of content objects.
                            # For our tools (which return dicts/lists), FastMCP
                            # serializes them as JSON text in a TextContent object.
                            result_text = " ".join(
                                c.text for c in result.content if hasattr(c, "text")
                            )

                            print(f"         Result:    {result_text[:120]}...")

                            # A tool_result must include the tool_use_id so Claude
                            # can match this result to the tool call it made.
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": result_text,
                            })

                    # Send all tool results back to Claude as a user message.
                    # The conversation now looks like:
                    #   user:      "What is Apple's price?"
                    #   assistant: [tool_use: get_stock_quote("AAPL")]
                    #   user:      [tool_result: {"price": 264.18, ...}]
                    # Claude will read this and either call more tools or answer.
                    messages.append({
                        "role": "user",
                        "content": tool_results,
                    })

                # ---------------------------------------------------------------
                # CASE 2: Claude is done — final answer
                # ---------------------------------------------------------------
                elif response.stop_reason == "end_turn":
                    print()
                    print("Claude's answer:")
                    print("-" * 60)
                    for block in response.content:
                        if hasattr(block, "text"):
                            print(block.text)
                    break

                # ---------------------------------------------------------------
                # CASE 3: Unexpected (shouldn't happen normally)
                # ---------------------------------------------------------------
                else:
                    print(f"Unexpected stop_reason: {response.stop_reason}")
                    break


# ---------------------------------------------------------------------------
# Run it
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Try changing this question to explore different tool combinations:
    question = (
        "What is Apple's current stock price, and how is the broader "
        "market doing today?"
    )
    asyncio.run(run_agent(question))
