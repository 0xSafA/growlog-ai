export type AskResponse = {
  insightId: string | null;
  persisted?: boolean;
  persistDetail?: string;
  model: string;
  insight_type: string;
  title: string | null;
  body: string;
  facts: string[];
  interpretation: string | null;
  hypotheses: string[];
  recommendation: string | null;
  confidence: { score: number; label: string };
  missing_data: string[];
  grounding: {
    source_type: string;
    source_id: string | null;
    excerpt: string | null;
  }[];
  trust_flags: string[];
};

export type ChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: AskResponse;
};
