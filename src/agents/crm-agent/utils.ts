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
