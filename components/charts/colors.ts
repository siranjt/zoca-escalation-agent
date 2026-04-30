// Shared chart palette. Channel + classification colors mirror the chip/border
// colors used elsewhere in the dashboard so a slice of the donut and a chip in
// the timeline are obviously the same thing.

export const CHANNEL_COLORS: Record<string, string> = {
  app_chat: "#5b8cff",
  email: "#7f77dd",
  phone: "#3ecf8e",
  video: "#d4537e",
  sms: "#f5b656",
};

export const CHANNEL_LABELS: Record<string, string> = {
  app_chat: "App Chat",
  email: "Email",
  phone: "Phone",
  video: "Video",
  sms: "SMS",
};

export const SENDER_COLORS = {
  client: "#ffa8cd",
  team: "#5b8cff",
  unknown: "#7e8794",
};

export const CLASSIFICATION_COLORS: Record<string, string> = {
  "Churn Ticket": "#ef5b5b",
  "Retention Risk Alert": "#ef9f27",
  "Subscription Support Ticket": "#4d65ff",
  paid_user_offboarding: "#7f77dd",
  Subscription_Cancellation: "#d4537e",
};

export const CLASSIFICATION_LABELS: Record<string, string> = {
  "Churn Ticket": "Churn",
  "Retention Risk Alert": "Retention Risk",
  "Subscription Support Ticket": "Sub Support",
  paid_user_offboarding: "Paid Off",
  Subscription_Cancellation: "Sub Cancel",
};

export const CHART_TOOLTIP_STYLE = {
  background: "#161827",
  border: "1px solid #2a2e44",
  borderRadius: "10px",
  fontSize: "12px",
  color: "#f4f7fa",
  padding: "8px 12px",
};

export const CHART_TOOLTIP_LABEL_STYLE = { color: "#8b94a8", fontSize: "11px" };
export const CHART_TOOLTIP_ITEM_STYLE = { color: "#f4f7fa" };
