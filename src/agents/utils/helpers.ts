import OpenAI from "openai";
import { MCPTool, OpenAIMessage, LLMCallOptions, LLMResponse } from "../types";
import { LLM_CONFIG } from "../configs";
import type { ChatCompletionSystemMessageParam } from "openai/resources/chat/completions";

// ✅ Secure API key handling
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  timeout: LLM_CONFIG.timeout,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

const convertMCPToolsToOpenAITools = (mcpTools: MCPTool[]) => {
  return mcpTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema || { type: "object", properties: {} },
    },
  }));
};

const buildFallbackPrompt = (mcpTools: MCPTool[]) => {
  const toolList = mcpTools
    .map((t) => {
      return `- ${t.name}(${Object.keys(t.inputSchema?.properties || {}).join(
        ", "
      )}) : ${t.description}`;
    })
    .join("\n");

  return `
You have access to these tools:
${toolList}

If you want to use a tool, ONLY respond with JSON in this format:
{
  "tool": "tool-name",
  "arguments": { "param1": "value1" }
}

Do not include extra text.`;
};

// ✅ Reusable LLM function with proper error handling
async function callLLM(
  messages: OpenAIMessage[],
  options: LLMCallOptions = {}
): Promise<LLMResponse> {
  try {
    const supportsToolCalling = [
      "openai/gpt-4o",
      "openai/gpt-4.1",
      "openai/gpt-oss-20b",
      "openai/gpt-oss-120b", // add more as needed
      "x-ai/grok-4-fast:free", // add more as needed
    ].includes(options.model || LLM_CONFIG.model);
    console.log(`Calling LLM with model: ${options.model || LLM_CONFIG.model}`);

    const response = await openai.chat.completions.create({
      model: options.model || LLM_CONFIG.model,
      messages: [
        ...(!supportsToolCalling && options.tools
          ? [
              {
                role: "system",
                content: buildFallbackPrompt(options.tools),
              } as ChatCompletionSystemMessageParam,
            ]
          : []),
        ...messages,
      ],
      temperature: options.temperature || LLM_CONFIG.temperature,
      max_tokens: options.maxTokens || LLM_CONFIG.maxTokens,
      ...(supportsToolCalling &&
        options.tools && {
          tool_choice: "auto",
          tools: convertMCPToolsToOpenAITools(options.tools),
        }),
    });

    console.log("response message:", response.choices[0].message);
    console.log("response tool calls:", response.choices[0].message.tool_calls);
    if (
      !response.choices[0].message.tool_calls &&
      !response.choices?.[0]?.message?.content
    ) {
      throw new Error("No content in LLM response");
    }

    // Log token usage for monitoring
    if (response.usage) {
      console.log(
        `Tokens used: ${response.usage.total_tokens} (cost: ~$${(
          (response.usage.total_tokens || 0) * 0.00003
        ).toFixed(4)})`
      );
    }

    return {
      success: true,
      content: response.choices[0].message.content,
      tool_calls: response.choices[0].message.tool_calls,
      usage: response.usage,
    };
  } catch (error: unknown) {
    console.error(
      "LLM call failed:",
      error instanceof Error ? error.message : String(error)
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      content: null,
    };
  }
}

export { callLLM, convertMCPToolsToOpenAITools, buildFallbackPrompt };
