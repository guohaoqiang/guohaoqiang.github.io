# Agents, MCP, and Skills

Agents execute instructions defined in Skills and use MCP tools to perform actions.

## Agents

An agent (or bot) works autonomously to solve complex problems within a defined domain. Agents follow the workflows and rules specified in a Skill and call MCPs when instructed.

## MCP (Model-Connected Protocol)

MCPs are discrete tools or capabilities available to an agent. Each MCP defines a specific action the agent can perform — for example: fetching data, running a computation, calling an external API, or updating state.

## Skills

A Skill is a prompt-driven workflow that defines how an agent should process a larger job. It contains step-by-step procedures and guidance for the agent, and explicitly specifies when and which MCPs should be used at each step.

## Example

- Skill: "Summarize and translate a document"
  - Step 1: Use MCP `fetch_document` to retrieve the source text.
  - Step 2: Use MCP `summarize` to produce a concise summary.
  - Step 3: Use MCP `translate` to convert the summary to the target language.

This structure keeps agent behavior predictable and auditable by separating high-level workflows (Skills) from the concrete actions (MCPs) they invoke.
