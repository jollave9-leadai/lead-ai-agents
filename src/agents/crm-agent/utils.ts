import { createClient } from "@supabase/supabase-js";

export const getCustomer = async (customerPipelineItemId: string) => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase
    .from("customer_pipeline_items_with_customers")
    .select("*")
    .eq("id", customerPipelineItemId)
    .single();
  if (error) {
    console.error("Error fetching customer:", error);
  }
  console.log("Customer Pipeline Item With Customer:", data);
  return data;
};

export const getPipelineStage = async (pipelineStageId: string) => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("*, stage_actions(*, agent_tasks(*))")
    .eq("id", pipelineStageId)
    .single();
  if (error) {
    console.error("Error fetching pipeline stage:", error);
  }
  console.log("Pipeline stage:", data);
  console.log("Pipeline stage stage_actions:", data?.stage_actions);
  // TODO: get the correct stage action
  console.log(
    "Pipeline stage agent_tasks:",
    data?.stage_actions?.[5]?.agent_tasks
  );
  return data;
};

export const sendToInbox = async (
  client_id: string,
  task_id: string,
  script: string,
  customer_id: string
) => {
  const supabasePersonal = createClient(
    process.env.PERSONAL_SUPABASE_URL!,
    process.env.PERSONAL_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabasePersonal
    .from("inbox")
    .insert({ client_id, task_id, script, customer_id });
  if (error) {
    console.error("Error sending to inbox:", error);
  }
  console.log("Inbox sent to:", data);
  return data;
};
