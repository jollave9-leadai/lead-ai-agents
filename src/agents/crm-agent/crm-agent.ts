import { callLLM } from "../utils/helpers";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export async function crmAgent(message: string) {
  console.log("process.env.MCP_URL", process.env.MCP_SERVER_URL);
  const transport = new StreamableHTTPClientTransport(
    new URL(
      process.env.MCP_SERVER_URL ||
        "https://lead-ai-mcp-server.vercel.app/api/mcp"
    )
  );
  const client = new Client({ name: "http-client", version: "1.0.0" });
  await client.connect(transport);

  console.log("Connected successfully!");

  // List available tools and resources
  const { tools } = await client.listTools();
  console.log("Available tools:", tools);

  const { tool_calls, content, usage } = await callLLM(
    [
      {
        role: "assistant",
        content:
          "You are a CRM agent. You are able to use the available tools to help the user.",
      },
      { role: "user", content: message },
    ],
    { tools }
  );

  if (tool_calls) {
    for (const tool_call of tool_calls) {
      if (tool_call.type === "function") {
        const { name, arguments: toolArgs } = tool_call.function;
        if (name) {
          const parsedArgs = JSON.parse(toolArgs);
          const { result } = await client.callTool({
            name,
            arguments: parsedArgs,
          });
          console.log("Tool result:", result);
        }
      }
    }
  }

  console.log({ tool_calls, content, usage });
  return { tool_calls, content, usage };
}
