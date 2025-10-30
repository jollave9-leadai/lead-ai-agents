import { NextResponse } from "next/server";
import { crmAgent } from "@/agents/";
import { AGENT_ROLE } from "@/agents/enums";
import axios from "axios";
import { callLLM } from "@/agents/utils/helpers";
import {
  handleImmediateTaskExecution,
  sendTaskToInbox,
} from "@/lib/utils/helpers";
import { AgentTask } from "@/types/crm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ role: string }> }
) {
  const { searchParams } = new URL(req.url);
  const validationToken = searchParams.get("validationToken");
  // if (validationToken !== process.env.VALIDATION_TOKEN) {
  if (validationToken) {
    return new NextResponse(validationToken, { status: 200 });
  }
  const body = await req.json();
  const { role } = await params;
  console.log("body", body);

  // Outlook webhook will be handled here
  if (body.value) {
    // Just return the value for now to skip the agent logic
    return NextResponse.json({ value: body.value });
  }

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
            recordTasks?.map(
              async (task: {
                id: string;
                type: string;
                script: string;
                for_approval: boolean;
                agent_settings: {
                  script: string;
                  from: string;
                };
              }) => {
                console.log("agentInstructions", agentInstructions);
                console.log("task.script", task.script);

                let messageBody = "";
                if (task.type === "sms" || task.type === "email") {
                  // TODO: Implement mcp sampling for generating the script
                  const { content } = await callLLM([
                    {
                      role: "system",
                      content: `You are a CRM agent that is communicating in a ${task.type} communication.`,
                    },
                    {
                      role: "assistant",
                      content: `Generate a message in ${task.type} format. ${
                        task.type === "email"
                          ? "Respond with a JSON object with the following properties: subject, body, and attachments."
                          : ""
                      }`,
                    },
                    {
                      role: "user",
                      content: task.script,
                    },
                  ]);
                  // If the task type is a SMS, then the message will based on the conversation context.
                  messageBody = content || "";
                } else {
                  // If the task type is a call, then pass directly the script to the outbound agent
                  messageBody = task?.agent_settings?.script;
                }
                // Send the message to the inbox if it's for approval
                if (task.for_approval) {
                  try {
                    console.log("messageBody", messageBody);
                    const inbox = await sendTaskToInbox(
                      client_id,
                      customer,
                      stage?.data,
                      task as AgentTask,
                      messageBody
                    );
                    console.log("inbox", inbox.data);
                    return NextResponse.json(inbox.data);
                  } catch (error) {
                    console.error("Error sending to inbox:", error);
                  }
                }
                await handleImmediateTaskExecution(
                  client_id,
                  customer,
                  stage?.data,
                  task as AgentTask,
                  messageBody
                );
              }
            )
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
