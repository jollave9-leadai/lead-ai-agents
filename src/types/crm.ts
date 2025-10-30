export interface PostgresInterval {
  years?: number;
  months?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
}

export interface Voice {
  id: number;
  name: string;
  provider: string;
  voiceId: string;
  model?: string;
  accent?: string;
  client_id?: number;
}

export type TaskListAssignee = "agent" | "automation" | "user";
export type TaskListEntityType = "deals" | "leads" | "contacts";
export type TaskListTaskType = "sms" | "email" | "call";
export type TaskListMode = "conversation" | "notification";
export type TaskListStatus =
  | "pending"
  | "ongoing"
  | "completed"
  | "completed (cancelled)"
  | "cancelled";


export interface CreateAgentTaskRequest {
  id?: string;
  type: TaskListTaskType;
  task_type?: TaskListTaskType;
  stage_id?: string;
  reference_time?: string;
  delay_interval?: PostgresInterval;
  execute_at?: string;
  is_scheduled?: boolean;
  for_approval?: boolean;
  is_active?: boolean;
  approval_required?: boolean;
  assignee: TaskListAssignee;
  mode: TaskListMode;
  status: TaskListStatus;
  script?: string;
  agent_settings?: {
    selected_template_name?: string;
    talking_speed?: number;
    script?: string;
    tone?: string;
    from?: string;
    voice?: Omit<Voice, "id"> & { id: string };
  };
  content?: {
    from?: string;
    to?: string;
    message?: string;
  };

  //for display purposes only
  isReadOnly?: boolean;
}
export interface AgentTask {
  id: string;
  stage_id?: string;
  type?: TaskListTaskType;
  task_type?: TaskListTaskType;
  reference_time: string | null;
  delay_interval: PostgresInterval;
  execute_at?: string;
  is_scheduled: boolean;
  approval_required: boolean;
  is_active?: boolean;
  for_approval?: boolean;
  mode: TaskListMode;
  status: TaskListStatus;
  created_by: number;
  created_at: string;
  updated_by: number | null;
  updated_at: string;
  script?: string;
  assignee: TaskListAssignee;
  agent_settings?: {
    selected_template_name?: string;
    talking_speed?: number;
    script?: string;
    tone?: string;
    from?: string;
    voice?: Omit<Voice, "id"> & { id: string };
  };
  content?: {
    from?: string;
    to?: string;
    message?: string;
  };

  //for display purposes only
  isReadOnly?: boolean;
}
export interface StageSettings {
  title: string;
  color: string;
  description: string;
  dealAgentTasks: TaskItem[];
  userAgentTasks: TaskItem[];
  successCriteria?: string;
  agentTone?: string;
  agentName?: string;
  requireApproval?: boolean;
  emailAccount?: string;
  agent_settings?: {
    name?: string;
    email_account?: string;
  }
}

export type TaskItem = AgentTask | CreateAgentTaskRequest;
