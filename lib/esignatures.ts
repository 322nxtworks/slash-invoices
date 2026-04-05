import crypto from "node:crypto";

const ESIGNATURES_BASE_URL = "https://esignatures.com/api";

export class ESignaturesConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ESignaturesConfigError";
  }
}

export interface ESignaturesTemplateListItem {
  template_id: string;
  title: string;
}

export interface ESignaturesTemplateDetails {
  template_id: string;
  title: string;
  created_at?: string;
  placeholder_fields?: string[];
  signer_field_ids?: string[];
  document_elements?: unknown[];
}

export interface ESignaturesTemplateCollaborator {
  template_collaborator_id: string;
  template_id: string;
  name?: string;
  email?: string;
  template_collaborator_editor_url: string;
}

export interface ESignaturesSigner {
  id?: string;
  name: string;
  email?: string;
  mobile?: string;
  company_name?: string;
  sign_page_url?: string;
  signer_field_values?: Record<string, string>;
}

export interface ESignaturesContract {
  id: string;
  status?: string;
  title: string;
  metadata?: string;
  source?: string;
  test?: "yes" | "no";
  contract_pdf_url?: string;
  signers?: ESignaturesSigner[];
}

interface ESignaturesDataResponse<T> {
  data: T;
}

interface CreateContractPayload {
  template_id: string;
  title?: string;
  metadata?: string;
  test: "yes" | "no";
  save_as_draft: "yes" | "no";
  signers: Array<{
    name: string;
    email?: string;
    mobile?: string;
    company_name?: string;
  }>;
  placeholder_fields?: Array<{
    placeholder_key: string;
    value: string;
  }>;
  signer_fields?: Array<{
    signer_field_id: string;
    default_value: string;
  }>;
}

function getEsignaturesApiToken() {
  const token = process.env.ESIGNATURES_API_TOKEN?.trim();
  if (!token) {
    throw new ESignaturesConfigError(
      "eSignatures is not configured — add ESIGNATURES_API_TOKEN"
    );
  }

  return token;
}

export function verifyEsignaturesWebhookSignature(
  payload: string,
  signature: string | null
) {
  if (!signature) return false;

  const token = getEsignaturesApiToken();
  const expected = crypto
    .createHmac("sha256", token)
    .update(payload)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

export function getEsignaturesDefaultTemplateId() {
  const templateId = process.env.ESIGNATURES_DEFAULT_TEMPLATE_ID?.trim();
  return templateId || null;
}

function getAuthHeader(token: string) {
  return `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
}

async function parseJsonOrThrow(response: Response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (!response.ok) {
      throw new Error(text);
    }

    return text;
  }
}

async function esignaturesFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = getEsignaturesApiToken();
  const headers = new Headers(init?.headers);

  headers.set("Authorization", getAuthHeader(token));
  headers.set("Accept", "application/json");

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${ESIGNATURES_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = await parseJsonOrThrow(response);

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : typeof payload === "string"
          ? payload
          : `eSignatures request failed with status ${response.status}`;

    throw new Error(message);
  }

  return payload as T;
}

function withEmbeddedMode(url: string) {
  const next = new URL(url);
  next.searchParams.set("embedded", "yes");
  return next.toString();
}

export async function listTemplates() {
  const response = await esignaturesFetch<
    ESignaturesDataResponse<ESignaturesTemplateListItem[]>
  >("/templates");

  return response.data || [];
}

export async function getTemplate(templateId: string) {
  const response = await esignaturesFetch<
    ESignaturesDataResponse<ESignaturesTemplateDetails>
  >(`/templates/${encodeURIComponent(templateId)}`);

  return response.data;
}

export async function updateTemplate(
  templateId: string,
  payload: {
    title?: string;
    labels?: string[];
    document_elements?: unknown[];
  }
) {
  return esignaturesFetch<{ status: string }>(
    `/templates/${encodeURIComponent(templateId)}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function listTemplateCollaborators(templateId: string) {
  const response = await esignaturesFetch<
    ESignaturesDataResponse<ESignaturesTemplateCollaborator[]>
  >(`/templates/${encodeURIComponent(templateId)}/collaborators`);

  return response.data || [];
}

export async function addTemplateCollaborator(
  templateId: string,
  collaborator: { name: string; email?: string }
) {
  const response = await esignaturesFetch<
    ESignaturesDataResponse<ESignaturesTemplateCollaborator[]>
  >(`/templates/${encodeURIComponent(templateId)}/collaborators`, {
    method: "POST",
    body: JSON.stringify(collaborator),
  });

  return response.data?.[0];
}

export async function getOrCreateTemplateEditorUrl(
  templateId: string,
  collaborator: { name: string; email?: string }
) {
  const existingCollaborators = await listTemplateCollaborators(templateId);
  const existing = existingCollaborators.find((item) => {
    if (collaborator.email && item.email) {
      return item.email.toLowerCase() === collaborator.email.toLowerCase();
    }

    return item.name?.trim() === collaborator.name.trim();
  });

  if (existing?.template_collaborator_editor_url) {
    return withEmbeddedMode(existing.template_collaborator_editor_url);
  }

  const created = await addTemplateCollaborator(templateId, collaborator);
  if (!created?.template_collaborator_editor_url) {
    throw new Error("Could not create a template editor session");
  }

  return withEmbeddedMode(created.template_collaborator_editor_url);
}

export async function createContract(payload: CreateContractPayload) {
  const response = await esignaturesFetch<
    ESignaturesDataResponse<{ contract: ESignaturesContract }> & {
      status: string;
    }
  >("/contracts", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response;
}

export async function getContract(contractId: string) {
  const response = await esignaturesFetch<
    ESignaturesDataResponse<{ contract: ESignaturesContract }>
  >(`/contracts/${encodeURIComponent(contractId)}`);

  return response.data.contract;
}
