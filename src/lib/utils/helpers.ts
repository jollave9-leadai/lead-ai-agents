import { AgentTask, StageSettings } from "@/types/crm";
import {
  handleRefreshToken,
  initiateCall,
  sendGmail,
  sendOutlookMail,
  sendSMS,
} from "lead-ai-npm-modules";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

export const callCustomer = async (
  customer: Record<string, unknown>,
  stage: StageSettings,
  task: AgentTask,
  script: string
) => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  const { data: vapiIntegration } = await supabase
    .schema("lead_dialer")
    .from("vapi_integration")
    .select("*")
    .eq("client_id", task?.created_by)
    .eq("phone_number", task?.agent_settings?.from)
    .single();

  console.log("vapiIntegration", vapiIntegration);
  if (!vapiIntegration) {
    throw new Error("VAPI integration not found");
  }
  const agentName = stage?.agent_settings?.name;
  const phoneCallPayload = {
    assistant: {
      name: agentName,
      firstMessage: `Hi this is ${agentName} do you have a moment?`,
      firstMessageMode: "assistant-speaks-first",
      backgroundSound: "office",
      transcriber: {
        provider: "deepgram",
        model: "nova-2",
        language: "en",
      },
      voice: {
        voiceId: task?.agent_settings?.voice?.voiceId,
        provider: task?.agent_settings?.voice?.provider,
        model: task?.agent_settings?.voice?.model,
      },
      model: {
        provider: "openai",
        model: "gpt-4.1",
        temperature: 0.2,
        maxTokens: 250,
        messages: [
          {
            role: "system",
            content: script,
          },
        ],
      },
      endCallPhrases: [],
      startSpeakingPlan: {
        waitSeconds: 4,
        smartEndpointingEnabled: true,
      },
      stopSpeakingPlan: {
        voiceSeconds: 0.5,
        numWords: 2,
      },
      // Add missing vapi_integration fields at assistant level
      // ...(vapiIntegration?.voicemailDetection && {
      //   voicemailDetection: vapiIntegration.voicemailDetection,
      // }),
      //   messagePlan: {
      //     waitSeconds: 4,
      //     smartEndpointingEnabled: true,
      //   },
      clientMessages: [],
      serverMessages: [],
      serverUrl:
        "https://weiqhneguxfutfdaxsil.supabase.co/functions/v1/outbound-agent-webhook-receiver",
    },
    type: "outboundPhoneCall",
    phoneNumberId: vapiIntegration?.phoneNumberId,
    customer: {
      number: customer?.phone_number,
    },
    metadata: {
      client_id: task?.created_by || null,
    },
  };
  const response = await initiateCall(
    phoneCallPayload,
    vapiIntegration.auth_token
  );
  console.log("response", response);
  return response;
};

export const smsCustomer = async (phoneNumber: string, message: string) => {
  return await sendSMS(phoneNumber, message, process.env.TELNYX_API_KEY!);
};

export const emailCustomer = async (
  clientId: string,
  emailFrom: string,
  emailTo: string,
  emailBody: string,
  emailSubject: string
) => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  const { data: emailData, error } = await supabase
    .from("emails")
    .select("*")
    .eq("client_id", clientId)
    .eq("email", emailFrom)
    .single();
  if (error || !emailData) {
    throw new Error("Error getting email data");
  }
  try {
    // Handle token refresh
    const expiresAt = emailData.expires_at * 1000; // convert to ms
    let accessToken = emailData.access_token;
    let refreshToken = emailData.refresh_token;
    if (Date.now() >= expiresAt) {
      const refreshedToken = await handleRefreshToken(
        refreshToken,
        emailData.provider,
        process.env.MICROSOFT_CLIENT_ID!,
        process.env.MICROSOFT_CLIENT_SECRET!,
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!
      );
      if (refreshedToken) {
        // Store the refreshed token in the database
        const now = Math.floor(Date.now() / 1000);
        await supabase
          .from("emails")
          .update({
            access_token: refreshedToken.access_token,
            refresh_token: refreshedToken.refresh_token,
            expires_at: now + refreshedToken.expires_at,
          })
          .eq("email", emailData.email)
          .eq("client_id", clientId);
        accessToken = refreshedToken.access_token;
        refreshToken = refreshedToken.refresh_token;
      }
    }
    if (emailData?.provider === "azure-ad") {
      return await sendOutlookMail(
        accessToken,
        emailTo,
        emailBody,
        emailSubject
      );
    } else {
      return await sendGmail(
        accessToken,
        emailTo,
        emailData?.email || "",
        emailBody,
        emailSubject
      );
    }
  } catch (emailError) {
    console.error("Failed to send Email:", emailError);
    return null;
  }
};

export const handleImmediateTaskExecution = async (
  client_id: number,
  customer: Record<string, unknown>,
  stage: StageSettings,
  task: AgentTask,
  messageBody: string
) => {
  switch (task.type) {
    case "call":
      const call = await callCustomer(
        customer,
        stage,
        task as AgentTask,
        messageBody
      );
      console.log("call", call);
      break;
    case "sms":
      const sms = await smsCustomer(
        customer?.phone_number as string,
        messageBody
      );
      console.log("sms", sms);
      break;
    case "email":
      let body: string;
      let subject: string;
      try {
        const parsed = JSON.parse(messageBody);
        console.log("parsed", parsed);
        body = parsed.body;
        subject = parsed.subject;
      } catch (error) {
        console.error("Error parsing email body and subject:", error);
        break;
      }
      if (!body || !subject) {
        console.error("Email body and subject are required");
        break;
      }
      const email = await emailCustomer(
        client_id.toString(),
        stage?.agent_settings?.email_account ?? "",
        customer?.email as string,
        body,
        subject
      );
      console.log("email", email);
      break;
    default:
      console.error("Invalid task type:", task.type);
      break;
  }
};

export const sendTaskToInbox = async (
  client_id: number,
  customer: Record<string, unknown>,
  stage: StageSettings,
  task: AgentTask,
  messageBody: string
) => {
  return await axios.post(`${process.env.NESTJS_API_URL}/api/v1/inbox`, {
    clientId: client_id,
    title: `${task.type} for ${customer?.full_name}`,
    content: {
      description: messageBody,
      communicationType: task.type?.toLowerCase() ?? "",
      customer,
      stage_agent_settings: stage?.agent_settings,
      stage,
      status: "pending",
    },
    category: "approval",
    relatedEntityId: task.id,
    relatedEntityType: "task",
  });
};
