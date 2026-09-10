import { ConfigError, has, optionalUrl, requireUrl, setting } from "./config";

const TIMEOUT_MS = 15000;

export const LUBELOGGER_URL = optionalUrl("lubeloggerUrl");

export function hasLubelogger(): boolean {
  return has("lubeloggerUrl");
}

/** Currency label shown next to costs. LubeLogger's API does not expose one. */
export function currency(): string {
  return setting("lubeloggerCurrency");
}

export type RecordType =
  | "gas"
  | "service"
  | "repair"
  | "upgrade"
  | "tax"
  | "odometer";

/** API path segment and UI label for each record kind. */
export const RECORD_KINDS: Record<
  RecordType,
  { endpoint: string; label: string; plural: string }
> = {
  gas: { endpoint: "gasrecords", label: "Fuel", plural: "Fuel-ups" },
  service: { endpoint: "servicerecords", label: "Service", plural: "Service" },
  repair: { endpoint: "repairrecords", label: "Repair", plural: "Repairs" },
  upgrade: { endpoint: "upgraderecords", label: "Upgrade", plural: "Upgrades" },
  tax: { endpoint: "taxrecords", label: "Expense", plural: "Expenses" },
  odometer: {
    endpoint: "odometerrecords",
    label: "Odometer",
    plural: "Odometer",
  },
};

/** Kinds that carry a cost — everything except plain odometer readings. */
export const COST_TYPES: RecordType[] = [
  "gas",
  "service",
  "repair",
  "upgrade",
  "tax",
];

export interface Vehicle {
  id: number;
  year: number;
  make: string;
  model: string;
  licensePlate: string;
  isElectric: boolean;
  isDiesel: boolean;
  useHours: boolean;
  odometerOptional: boolean;
}

export interface VehicleInfo {
  vehicle: Vehicle;
  name: string;
  odometer: number;
  counts: Record<RecordType, number>;
  costs: Record<RecordType, number>;
  totalCost: number;
  remindersDue: number;
  nextReminder: string | null;
}

export interface VehicleRecord {
  type: RecordType;
  id: number;
  vehicleId: number;
  /** null when the server's date string could not be parsed. */
  date: Date | null;
  dateText: string;
  description: string;
  notes: string;
  cost: number;
  odometer: number | null;
  fuelConsumed?: number;
  fuelEconomy?: number;
  isFillToFull?: boolean;
  missedFuelUp?: boolean;
  tags: string[];
}

export interface Reminder {
  id: number;
  description: string;
  notes: string;
  urgency: string;
  metric: string;
  dueDate: string;
  dueDays: number;
  dueOdometer: number;
  dueDistance: number;
}

// ---------- transport ----------

function baseUrl(): string {
  const value = requireUrl("lubeloggerUrl", "LubeLogger");
  try {
    const parsed = new URL(value);
    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error();
    }
  } catch {
    throw new ConfigError(
      "LubeLogger URL must be an HTTP(S) base URL without credentials, a query or a fragment",
    );
  }
  return value;
}

/** LubeLogger's API is unauthenticated unless an account exists; then it takes basic auth. */
function authHeaders(): Record<string, string> {
  const user = setting("lubeloggerUsername");
  const pass = setting("lubeloggerPassword");
  if (!user && !pass) return {};
  if (!user || !pass) {
    throw new ConfigError(
      "LubeLogger needs both a username and a password, or neither",
    );
  }
  return {
    Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`,
  };
}

function transferError(error: unknown, signal?: AbortSignal): never {
  if (signal?.aborted) throw signal.reason;
  if (
    error instanceof Error &&
    ["TimeoutError", "AbortError"].includes(error.name)
  ) {
    throw new Error(
      "LubeLogger request timed out — check the server connection and try again",
    );
  }
  throw new Error(
    "LubeLogger is unreachable — check its URL and your network connection",
  );
}

async function request(
  path: string,
  init?: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  const url = `${baseUrl()}/api/${path}`;
  let response: Response;
  try {
    const deadline = AbortSignal.timeout(TIMEOUT_MS);
    response = await fetch(url, {
      ...init,
      headers: { ...authHeaders(), ...(init?.headers ?? {}) },
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
      // A login redirect is not an API response.
      redirect: "manual",
    });
  } catch (error) {
    transferError(error, signal);
  }
  if (response.status === 401)
    throw new Error(
      "LubeLogger authentication failed — check the username and password",
    );
  if (response.status >= 300 && response.status < 400)
    throw new Error(
      "LubeLogger redirected to a sign-in page — check the URL and any access proxy",
    );
  if (response.status === 404)
    throw new Error("LubeLogger API endpoint was not found");
  return response;
}

async function json<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await request(path, undefined, signal);
  if (!response.ok)
    throw new Error(`LubeLogger request failed (HTTP ${response.status})`);
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "LubeLogger returned a page instead of JSON — check the URL and any sign-in proxy",
    );
  return (await response.json()) as T;
}

interface ApiResult {
  success: boolean;
  message?: string;
  additionalData?: { recordId?: number };
}

async function post(
  path: string,
  form: Record<string, string>,
): Promise<ApiResult> {
  const body = new URLSearchParams(form).toString();
  const response = await request(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  let result: ApiResult | undefined;
  try {
    result = (await response.json()) as ApiResult;
  } catch {
    result = undefined;
  }
  if (!result?.success)
    throw new Error(
      result?.message ?? `LubeLogger rejected the request (HTTP ${response.status})`,
    );
  return result;
}

// ---------- locale-tolerant parsing ----------

/**
 * LubeLogger formats numbers with the server's locale, so a cost can arrive as
 * "1234,56" (bs-BA) or "1,234.56" (en-US). The separator that appears last and
 * is followed by one or two digits is the decimal one.
 */
export function parseNumber(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const text = String(raw ?? "").replace(/[\s\u00a0\u202f]/g, "");
  if (!text) return 0;
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  let normalized = text;
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    normalized = text.split(thousands).join("").replace(decimal, ".");
  } else if (comma >= 0 || dot >= 0) {
    const sep = comma >= 0 ? "," : ".";
    const index = comma >= 0 ? comma : dot;
    const decimals = text.length - index - 1;
    const occurrences = text.split(sep).length - 1;
    normalized =
      occurrences === 1 && decimals > 0 && decimals <= 2
        ? text.replace(sep, ".")
        : text.split(sep).join("");
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

/** Dates come back localized too: "26. 5. 2022." (bs-BA) or "5/26/2022" (en-US). */
export function parseDate(raw: string | null | undefined): Date | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return utc(+iso[1], +iso[2], +iso[3]);
  const dotted = text.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (dotted) return utc(+dotted[3], +dotted[2], +dotted[1]);
  const slashed = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  // Slash dates are month-first (LubeLogger's en-US default) unless impossible.
  if (slashed) {
    const [, a, b, year] = slashed;
    return +a > 12 ? utc(+year, +b, +a) : utc(+year, +a, +b);
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

function utc(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * The server parses submitted numbers with its own locale: on a bs-BA install
 * "1234.56" silently becomes 123456. Detect the separator from what the API
 * returns (a dotted date or a decimal comma both mean a comma locale).
 */
function decimalSeparator(samples: string[]): "," | "." {
  const configured = setting("lubeloggerDecimal");
  if (configured === "," || configured === ".") return configured;
  for (const sample of samples) {
    if (/\d,\d{1,2}(\D|$)/.test(sample)) return ",";
    if (/^\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/.test(sample)) return ",";
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(sample)) return ".";
    if (/\d\.\d{1,2}(\D|$)/.test(sample)) return ".";
  }
  return ".";
}

function formatNumberForServer(value: number, separator: "," | "."): string {
  const text = String(value);
  return separator === "," ? text.replace(".", ",") : text;
}

// ---------- reads ----------

function toVehicle(raw: Record<string, unknown>): Vehicle {
  return {
    id: Number(raw.id),
    year: Number(raw.year) || 0,
    make: String(raw.make ?? ""),
    model: String(raw.model ?? ""),
    licensePlate: String(raw.licensePlate ?? ""),
    isElectric: Boolean(raw.isElectric),
    isDiesel: Boolean(raw.isDiesel),
    useHours: Boolean(raw.useHours),
    odometerOptional: Boolean(raw.odometerOptional),
  };
}

export function vehicleName(vehicle: Vehicle): string {
  return [vehicle.year || "", vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Distance unit: LubeLogger stores raw numbers, so this is a display label only. */
export function distanceUnit(): string {
  return setting("lubeloggerDistanceUnit") || "km";
}

export function volumeUnit(): string {
  return setting("lubeloggerVolumeUnit") || "L";
}

export async function listVehicles(signal?: AbortSignal): Promise<Vehicle[]> {
  const raw = await json<Record<string, unknown>[]>("vehicles", signal);
  return raw.map(toVehicle);
}

interface RawInfo {
  vehicleData: Record<string, unknown>;
  lastReportedOdometer?: number | string;
  nextReminder?: { description?: string; dueDate?: string } | null;
  veryUrgentReminderCount?: number;
  urgentReminderCount?: number;
  pastDueReminderCount?: number;
  notUrgentReminderCount?: number;
  [key: string]: unknown;
}

function infoFrom(raw: RawInfo): VehicleInfo {
  const counts = {} as Record<RecordType, number>;
  const costs = {} as Record<RecordType, number>;
  for (const type of Object.keys(RECORD_KINDS) as RecordType[]) {
    counts[type] = Number(raw[`${type}RecordCount`] ?? 0) || 0;
    costs[type] = parseNumber(raw[`${type}RecordCost`] ?? 0);
  }
  const vehicle = toVehicle(raw.vehicleData);
  return {
    vehicle,
    name: vehicleName(vehicle),
    odometer: parseNumber(raw.lastReportedOdometer ?? 0),
    counts,
    costs,
    totalCost: COST_TYPES.reduce((sum, type) => sum + (costs[type] ?? 0), 0),
    remindersDue:
      (raw.veryUrgentReminderCount ?? 0) +
      (raw.urgentReminderCount ?? 0) +
      (raw.pastDueReminderCount ?? 0),
    nextReminder: raw.nextReminder?.description ?? null,
  };
}

export async function loadVehicleInfo(
  signal?: AbortSignal,
): Promise<VehicleInfo[]> {
  const raw = await json<RawInfo[]>("vehicle/info", signal);
  return raw.map(infoFrom);
}

/** Home row: one request, the headline numbers for the first (or configured) vehicle. */
export async function loadVehicleSummary(
  signal?: AbortSignal,
): Promise<VehicleInfo | undefined> {
  const all = await loadVehicleInfo(signal);
  const preferred = setting("lubeloggerVehicleId");
  return (
    all.find((info) => String(info.vehicle.id) === preferred) ?? all[0]
  );
}

function toRecord(
  type: RecordType,
  raw: Record<string, unknown>,
): VehicleRecord {
  const dateText = String(raw.date ?? "");
  const record: VehicleRecord = {
    type,
    id: Number(raw.id),
    vehicleId: Number(raw.vehicleId),
    date: parseDate(dateText),
    dateText,
    description: String(raw.description ?? "").trim(),
    notes: String(raw.notes ?? "").trim(),
    cost: parseNumber(raw.cost),
    odometer: raw.odometer == null ? null : parseNumber(raw.odometer),
    tags: String(raw.tags ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
  if (type === "gas") {
    record.fuelConsumed = parseNumber(raw.fuelConsumed);
    record.fuelEconomy = parseNumber(raw.fuelEconomy);
    record.isFillToFull = String(raw.isFillToFull).toLowerCase() === "true";
    record.missedFuelUp = String(raw.missedFuelUp).toLowerCase() === "true";
    if (!record.description)
      record.description = `Fuel-up — ${record.fuelConsumed} ${volumeUnit()}`;
  }
  if (type === "odometer" && !record.description)
    record.description = "Odometer reading";
  return record;
}

export async function listRecords(
  vehicleId: number,
  types: RecordType[],
  signal?: AbortSignal,
): Promise<VehicleRecord[]> {
  const pages = await Promise.all(
    types.map(async (type) => {
      const raw = await json<Record<string, unknown>[]>(
        `vehicle/${RECORD_KINDS[type].endpoint}?vehicleId=${vehicleId}`,
        signal,
      );
      return raw.map((row) => toRecord(type, row));
    }),
  );
  return pages
    .flat()
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
}

export async function listReminders(
  vehicleId: number,
  signal?: AbortSignal,
): Promise<Reminder[]> {
  const raw = await json<Record<string, unknown>[]>(
    `vehicle/reminders?vehicleId=${vehicleId}`,
    signal,
  );
  return raw.map((row) => ({
    id: Number(row.id),
    description: String(row.description ?? ""),
    notes: String(row.notes ?? ""),
    urgency: String(row.urgency ?? ""),
    metric: String(row.metric ?? ""),
    dueDate: String(row.dueDate ?? ""),
    dueDays: parseNumber(row.dueDays),
    dueOdometer: parseNumber(row.dueOdometer),
    dueDistance: parseNumber(row.dueDistance),
  }));
}

// ---------- writes ----------

export interface NewRecord {
  type: RecordType;
  vehicleId: number;
  date: Date;
  description?: string;
  notes?: string;
  cost?: number;
  odometer?: number;
  fuelConsumed?: number;
  isFillToFull?: boolean;
  missedFuelUp?: boolean;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formFor(record: NewRecord, separator: "," | "."): Record<string, string> {
  const form: Record<string, string> = {
    vehicleId: String(record.vehicleId),
    date: isoDate(record.date),
  };
  const number = (value: number) => formatNumberForServer(value, separator);
  if (record.description) form.description = record.description;
  if (record.notes) form.notes = record.notes;
  if (record.type !== "odometer") form.cost = number(record.cost ?? 0);
  if (record.type !== "tax") form.odometer = number(record.odometer ?? 0);
  if (record.type === "gas") {
    form.fuelConsumed = number(record.fuelConsumed ?? 0);
    form.isFillToFull = String(record.isFillToFull ?? true);
    form.missedFuelUp = String(record.missedFuelUp ?? false);
  }
  return form;
}

/** The stored row, so callers can confirm the server understood the numbers. */
async function fetchRecord(
  type: RecordType,
  vehicleId: number,
  id: number,
): Promise<VehicleRecord | undefined> {
  const rows = await listRecords(vehicleId, [type]);
  return rows.find((row) => row.id === id);
}

export async function deleteRecord(
  type: RecordType,
  id: number,
): Promise<void> {
  const response = await request(
    `vehicle/${RECORD_KINDS[type].endpoint}/delete?id=${id}`,
    { method: "DELETE" },
  );
  const result = (await response.json().catch(() => undefined)) as
    | ApiResult
    | undefined;
  if (!result?.success)
    throw new Error(result?.message ?? "LubeLogger could not delete the record");
}

/**
 * Adds a record and verifies the stored numbers round-trip. A locale mismatch
 * turns 12.50 into 1250, so on a mismatch the bad row is removed and the write
 * retried with the other decimal separator rather than left silently wrong.
 */
export async function addRecord(record: NewRecord): Promise<VehicleRecord> {
  const probe = await json<Record<string, unknown>[]>(
    `vehicle/${RECORD_KINDS[record.type].endpoint}?vehicleId=${record.vehicleId}`,
  ).catch(() => [] as Record<string, unknown>[]);
  const samples = probe
    .slice(0, 20)
    .flatMap((row) => [row.date, row.cost, row.fuelConsumed])
    .filter((value): value is string => typeof value === "string");

  const first = decimalSeparator(samples);
  const separators: ("," | ".")[] = first === "," ? [",", "."] : [".", ","];
  let lastMismatch: string | undefined;

  // LubeLogger mirrors any submitted odometer into its own odometer log and
  // keeps that row when the source record is deleted, so a rollback below has
  // to remove the mirror too.
  const odometerBefore =
    record.type === "tax" || record.type === "odometer"
      ? []
      : await listRecords(record.vehicleId, ["odometer"])
          .then((rows) => rows.map((row) => row.id))
          .catch(() => [] as number[]);

  for (const separator of separators) {
    const result = await post(
      `vehicle/${RECORD_KINDS[record.type].endpoint}/add`,
      formFor(record, separator),
    );
    const id = result.additionalData?.recordId;
    if (!id) return { ...(record as unknown as VehicleRecord) };
    const stored = await fetchRecord(record.type, record.vehicleId, id).catch(
      () => undefined,
    );
    if (!stored) return { ...(record as unknown as VehicleRecord) };

    const wanted = [
      ["cost", record.type === "odometer" ? undefined : (record.cost ?? 0), stored.cost],
      ["fuel", record.type === "gas" ? (record.fuelConsumed ?? 0) : undefined, stored.fuelConsumed],
    ] as const;
    const mismatch = wanted.find(
      ([, want, got]) =>
        want !== undefined && got !== undefined && Math.abs(want - got) > 0.005,
    );
    if (!mismatch) return stored;

    lastMismatch = `${mismatch[0]} ${mismatch[1]} was stored as ${mismatch[2]}`;
    await deleteRecord(record.type, id).catch(() => undefined);
    await rollbackMirroredOdometer(record, odometerBefore);
  }
  throw new Error(
    `LubeLogger stored a different number than it was sent (${lastMismatch}). Set the LubeLogger decimal separator preference to match the server's locale.`,
  );
}

/** Removes odometer rows LubeLogger mirrored from a record we just rolled back. */
async function rollbackMirroredOdometer(
  record: NewRecord,
  before: number[],
): Promise<void> {
  if (record.type === "tax" || record.type === "odometer") return;
  try {
    const after = await listRecords(record.vehicleId, ["odometer"]);
    for (const row of after) {
      if (!before.includes(row.id))
        await deleteRecord("odometer", row.id).catch(() => undefined);
    }
  } catch {
    // best effort: the add already failed, don't mask its error
  }
}

export function vehicleWebUrl(vehicleId: number): string {
  return LUBELOGGER_URL
    ? `${LUBELOGGER_URL}/Vehicle/Index?vehicleId=${vehicleId}`
    : "";
}
