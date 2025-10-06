// ✅ Configuration management
export const LLM_CONFIG = {
  // model: "deepseek/deepseek-r1:free",
  // model: "openai/gpt-oss-20b",
  // model: "x-ai/grok-4-fast:free",
  // model: "meituan/longcat-flash-chat:free",
  // model: "nvidia/nemotron-nano-9b-v2:free",
  // model: "llama-3.3-70b-versatile", // groq
  // model: "llama-3.1-8b-instant", // groq
  model: "openai/gpt-oss-120b", // groq
  temperature: 0.5,
  maxTokens: 65000,
  timeout: 30000, // 30 seconds
};
