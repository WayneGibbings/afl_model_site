export type GenieAction = "start" | "message" | "poll" | "result";

export type GenieStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED" | "UNKNOWN";

export interface GenieQueryResult {
  columns: string[];
  rows: Array<Array<string | number | boolean | null>>;
  rowCount: number;
  truncated: boolean;
}

export interface GenieStartRequest {
  action: "start";
  content: string;
}

export interface GenieMessageRequest {
  action: "message";
  conversationId: string;
  content: string;
}

export interface GeniePollRequest {
  action: "poll";
  conversationId: string;
  messageId: string;
}

export interface GenieResultRequest {
  action: "result";
  conversationId: string;
  messageId: string;
  attachmentId: string;
}

export type GenieProxyRequest =
  | GenieStartRequest
  | GenieMessageRequest
  | GeniePollRequest
  | GenieResultRequest;

export interface GenieStartResponse {
  conversationId: string;
  messageId: string;
  status: GenieStatus;
}

export type GenieMessageResponse = GenieStartResponse;

export interface GeniePollResponse {
  status: GenieStatus;
  rawStatus: string | null;
  assistantText: string | null;
  query: string | null;
  hasQueryResult: boolean;
  attachmentId: string | null;
  error: string | null;
}

export interface GenieResultResponse {
  queryResult: GenieQueryResult;
}

export interface GenieErrorPayload {
  error: {
    code: string;
    message: string;
  };
}

export type GenieProxyResponse =
  | GenieStartResponse
  | GenieMessageResponse
  | GeniePollResponse
  | GenieResultResponse
  | GenieErrorPayload;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  status: GenieStatus;
  rawStatus?: string | null;
  elapsedMs?: number;
  query?: string | null;
  queryResult?: GenieQueryResult | null;
  error?: string | null;
}
