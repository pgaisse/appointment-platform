export type TemplateItem = {
  id: string;
  label: string;
  content: string;
};

export type UploadedMedia = {
  file: File;
  previewUrl: string;
  mimeType: string;
};

export type MessagePayload = {
  body: string;
  conversationId?: string;
  to?: string; // phone or recipient id
  org_id?: string;
  media?: { name: string; type: string; dataUrl?: string }[];
  metadata?: Record<string, any>;
};




export type MessageComposerProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  onSend?: (payload: MessagePayload) => Promise<void> | void;

  conversationId?: string;
  to?: string;
  org_id?: string;
  metadata?: Record<string, any>;

  placeholder?: string;
  isLoading?: boolean;
  disabled?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  allowAttachments?: boolean;
  compact?: boolean;

  templates?: TemplateItem[];
  onOpenTemplates?: () => void;

  onAttachFiles?: (files: File[]) => void;
  allowNewLines?: boolean; // true: Ctrl+Enter envía; false: Enter envía
};
