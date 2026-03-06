export const teamKeys = [
  "adelaide",
  "brisbane",
  "carlton",
  "collingwood",
  "essendon",
  "fremantle",
  "geelong",
  "goldcoast",
  "gws",
  "hawthorn",
  "melbourne",
  "northmelbourne",
  "portadelaide",
  "richmond",
  "stkilda",
  "sydney",
  "westcoast",
  "bulldogs",
] as const;

export type TeamKey = (typeof teamKeys)[number];

const teamAliases: Record<string, TeamKey> = {
  adelaide: "adelaide",
  adelaidecrows: "adelaide",
  brisbane: "brisbane",
  brisbanelions: "brisbane",
  carlton: "carlton",
  collingwood: "collingwood",
  essendon: "essendon",
  fremantle: "fremantle",
  geelong: "geelong",
  geelongcats: "geelong",
  goldcoast: "goldcoast",
  goldcoastsuns: "goldcoast",
  gws: "gws",
  gwsgiants: "gws",
  greatwesternsydney: "gws",
  greatwesternsydneygiants: "gws",
  hawthorn: "hawthorn",
  melbourne: "melbourne",
  melbournedemons: "melbourne",
  northmelbourne: "northmelbourne",
  northmelbournekangaroos: "northmelbourne",
  portadelaide: "portadelaide",
  portadelaidepower: "portadelaide",
  richmond: "richmond",
  stkilda: "stkilda",
  saintkilda: "stkilda",
  sydney: "sydney",
  sydneyswans: "sydney",
  westcoast: "westcoast",
  westcoasteagles: "westcoast",
  bulldogs: "bulldogs",
  westernbulldogs: "bulldogs",
  footscray: "bulldogs",
};

export function normaliseHost(rawHost: string): string {
  return rawHost.startsWith("http") ? rawHost : `https://${rawHost}`;
}

export function warehouseIdFromHttpPath(pathValue: string): string {
  const match = pathValue.match(/\/warehouses\/([a-zA-Z0-9]+)/);
  if (!match) {
    throw new Error(`Could not extract warehouse id from DATABRICKS_HTTP_PATH: ${pathValue}`);
  }
  return match[1];
}

function normaliseTeamString(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function mapTeamKey(value: unknown, fieldName: string, nullable = false): TeamKey | null {
  if (value === null || value === undefined) {
    if (nullable) {
      return null;
    }
    throw new Error(`Missing team value for field: ${fieldName}`);
  }

  if (typeof value !== "string") {
    throw new Error(`Invalid team value for field ${fieldName}: expected string`);
  }

  if (teamKeys.includes(value as TeamKey)) {
    return value as TeamKey;
  }

  const mapped = teamAliases[normaliseTeamString(value)];
  if (mapped) {
    return mapped;
  }

  throw new Error(`Unknown team value for field ${fieldName}: ${value}`);
}
