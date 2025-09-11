// MCP Tool Type Definition
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
  outputSchema?: any;
  title?: string;
}

// Import OpenAI types
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";

// Use OpenAI SDK types
export type OpenAIMessage = ChatCompletionMessageParam;

// LLM Call Options Type
export interface LLMCallOptions {
  model?: string;
  tools?: MCPTool[];
  temperature?: number;
  maxTokens?: number;
}

// LLM Response Types
export interface LLMResponse {
  success: boolean;
  content: string | null;
  tool_calls?: ChatCompletionMessageToolCall[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}
