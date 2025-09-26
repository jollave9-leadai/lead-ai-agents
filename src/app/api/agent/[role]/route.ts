import { NextResponse } from "next/server";
import { crmAgent } from "@/agents/";
import { AGENT_ROLE } from "@/agents/enums";
import axios from "axios";
import { callLLM } from "@/agents/utils/helpers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ role: string }> }
) {
  const body = await req.json();
  const { role } = await params;
  console.log("body", body);
  if (role === AGENT_ROLE.CRM) {
    const {
      message,
      systemInstructions,
      assistantInstructions,
      record,
      exposeTools,
    } = body;
    if (record) {
      const { data: stage } = await axios.get(
        `${process.env.BASE_SUPABASE_FUNCTIONS_URL}/pipeline-stages/${record.pipeline_stage_id}`
      );
      const customer = stage?.data?.customer_pipeline_items_with_customers?.[0];
      // TODO: get the client_id from the customer
      const client_id = record.created_by;
      console.log("stage", stage);
      console.log("stage?.stage_actions", stage?.data?.stage_actions);
      console.log("customer", customer);
      // TODO: get the correct stage action
      const recordTasks = stage?.data?.stage_actions?.[0]?.agent_tasks;
      console.log("recordTasks", recordTasks);
      const agentInstructions = stage?.data?.agent_settings?.instructions;

      // Promise.allSettled to make the requests in parallel
      const taskMessages = recordTasks
        ? await Promise.allSettled(
            recordTasks?.map(async (task: { type: string; script: string }) => {
              console.log("agentInstructions", agentInstructions);
              console.log("task.script", task.script);

              let messageBody = "";
              if (task.type === "SMS") {
                // TODO: Implement mcp sampling for generating the script
                const { content } = await callLLM([
                  {
                    role: "system",
                    content: agentInstructions,
                  },
                  {
                    role: "assistant",
                    content:
                      "You are an agent that is communicating in a SMS communication.",
                  },
                  {
                    role: "user",
                    content: `Generate a message for the customer in SMS format.`,
                  },
                ]);
                // If the task type is a SMS, then the message will based on the conversation context.
                messageBody = content || "";
              } else {
                // If the task type is a call, then pass directly the script to the outbound agent
                messageBody = task.script;
              }
              const toolCallMessage = `${task.type}-customer,
                {name: ${customer?.full_name}, client_id: ${client_id}, ${
                task.type === "Call" ? "script:" : "message:"
              } ${messageBody}}\n\n`;
              await crmAgent(toolCallMessage);
            })
          )
        : [];
      return NextResponse.json(taskMessages);
    } else {
      const agentResponse = await crmAgent(
        message,
        systemInstructions,
        assistantInstructions,
        exposeTools
      );
      return NextResponse.json(agentResponse);
    }
  }
  return NextResponse.json({ error: "Agent not found" });
}
