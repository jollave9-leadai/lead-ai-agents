import { NextResponse } from "next/server";
import { crmAgent } from "@/agents/";
import { AGENT_ROLE } from "@/agents/enums";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ role: string }> }
) {
  const { message } = await req.json();
  const { role } = await params;
  console.log("message", message);
  if (role === AGENT_ROLE.CRM) {
    const agentResponse = await crmAgent(message);
    return NextResponse.json(agentResponse);
  }
  return NextResponse.json({ error: "Agent not found" });
}
