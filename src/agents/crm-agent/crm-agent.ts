import { callLLM } from "../utils/helpers";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CreateMessageRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export async function crmAgent(
  message: string,
  systemInstructions?: string,
  assistantInstructions?: string,
  exposeTools: boolean = true
) {
  console.log("process.env.MCP_URL", process.env.MCP_SERVER_URL);
  const transport = new StreamableHTTPClientTransport(
    new URL(
      process.env.MCP_SERVER_URL ||
        "https://lead-ai-mcp-server.vercel.app/api/mcp"
    )
  );
  const client = new Client(
    { name: "http-client", version: "1.0.0" },
    {
      // You must declare that this client supports sampling
      capabilities: { sampling: {} },
    }
  );
  await client.connect(transport);

  console.log("Connected successfully!");
  // Listen to server’s sampling requests:
  client.setRequestHandler(
    // This handler is invoked when server does sampling/createMessage
    CreateMessageRequestSchema,
    async (req) => {
      const { messages} = req.params;
      console.log("messages", messages);
      // Here, call your LLM (e.g. OpenAI, local model, etc.)
      const { content } = await callLLM([
        { role: "user", content: messages[0].content.text as string },
      ]);

      // Return in the expected response format
      return {
        role: "assistant",
        content: {
          type: "text",
          text: content,
        },
      };
    }
  );
  // List available tools and resources
  const { tools } = await client.listTools();
  // console.log("Available tools:", tools);

  const { tool_calls, content, usage } = await callLLM(
    [
      {
        role: "system",
        content: systemInstructions || "You are a Professional CRM agent.",
      },
      {
        role: "assistant",
        content:
          assistantInstructions ||
          "You are able to use the available tools to help the user if needed.",
      },
      { role: "user", content: message },
    ],
    exposeTools ? { tools } : {}
  );

  const tool_calls_result = [];
  if (tool_calls) {
    for (const tool_call of tool_calls) {
      if (tool_call.type === "function") {
        const { name, arguments: toolArgs } = tool_call.function;
        if (name) {
          const parsedArgs = JSON.parse(toolArgs);
          const result = await client.callTool({
            name,
            arguments: parsedArgs,
          });
          console.log("Tool result:", result);
          tool_calls_result.push(result);
        }
      }
    }
  }

  console.log({ tool_calls, content, usage });
  return { tool_calls, content, usage, tool_calls_result };
}
