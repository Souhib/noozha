const NOCODB_URL = "https://admin.noozha.fr";
const TABLE_ID = "mzj71ffifgxkigl";

interface SigninResponse {
  token: string;
}

interface NocoDBRecord {
  [key: string]: unknown;
}

interface NocoDBListResponse {
  list: NocoDBRecord[];
  pageInfo: {
    totalRows: number;
    page: number;
    pageSize: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  };
}

interface ColumnOption {
  title: string;
  color: string;
}

interface Column {
  id: string;
  title: string;
  uidt: string;
  colOptions?: {
    options: ColumnOption[];
  };
}

interface TableSchema {
  id: string;
  title: string;
  columns: Column[];
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, options);
  if (res.status === 401 || res.status === 403) {
    throw new UnauthorizedError(res.statusText);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function signin(
  email: string,
  password: string,
): Promise<string> {
  const data = await request<SigninResponse>(
    `${NOCODB_URL}/api/v1/auth/user/signin`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
  );
  return data.token;
}

export async function createRecord(
  token: string,
  data: NocoDBRecord,
): Promise<NocoDBRecord> {
  return request<NocoDBRecord>(
    `${NOCODB_URL}/api/v2/tables/${TABLE_ID}/records`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xc-auth": token,
      },
      body: JSON.stringify(data),
    },
  );
}

export async function listRecords(
  token: string,
  limit = 25,
): Promise<NocoDBListResponse> {
  return request<NocoDBListResponse>(
    `${NOCODB_URL}/api/v2/tables/${TABLE_ID}/records?sort=-CreatedAt&limit=${limit}`,
    {
      headers: { "xc-auth": token },
    },
  );
}

export async function getSchema(token: string): Promise<TableSchema> {
  return request<TableSchema>(
    `${NOCODB_URL}/api/v2/meta/tables/${TABLE_ID}`,
    {
      headers: { "xc-auth": token },
    },
  );
}

export function calculateMontant(
  creneau: string,
  nbPersonnes: number,
  formule: string,
): number {
  const c = creneau.toLowerCase();
  const n = nbPersonnes;
  let base = 0;

  if (c.includes("journ")) {
    if (n <= 20) base = n * 40;
    else if (n <= 30) base = n * 35;
    else if (n <= 40) base = n * 32;
    else base = n * 28;
  } else if (c.includes("nuit")) {
    if (n <= 6) base = 180;
    else if (n <= 10) base = 210;
    else base = 240;
  } else if (c.includes("soir")) {
    if (n <= 6) base = 150;
    else if (n <= 10) base = 175;
    else base = 200;
  } else if (c.includes("matin") || c.includes("apr")) {
    if (n <= 6) base = 120;
    else if (n <= 10) base = 140;
    else base = 160;
  }

  let meal = 0;
  if (!c.includes("journ")) {
    const f = formule.toLowerCase();
    if (f.includes("menu complet")) {
      meal = n * 15;
    } else if (f.includes("plat seul")) {
      meal = n * 10;
    }
  }

  return base + meal;
}

export type { Column, TableSchema, NocoDBRecord, NocoDBListResponse };
