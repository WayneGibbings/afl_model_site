export type TeamKey =
  | "adelaide"
  | "brisbane"
  | "carlton"
  | "collingwood"
  | "essendon"
  | "fremantle"
  | "geelong"
  | "goldcoast"
  | "gws"
  | "hawthorn"
  | "melbourne"
  | "northmelbourne"
  | "portadelaide"
  | "richmond"
  | "stkilda"
  | "sydney"
  | "westcoast"
  | "bulldogs";

export interface TeamInfo {
  name: string;
  short: string;
  primary: string;
  secondary: string;
  icon: string;
}

export const teams: Record<TeamKey, TeamInfo> = {
  adelaide: { name: "Adelaide", short: "ADE", primary: "#002B5C", secondary: "#FFD200", icon: "/teams/adelaide.svg" },
  brisbane: { name: "Brisbane Lions", short: "BRI", primary: "#A30046", secondary: "#0055A3", icon: "/teams/brisbane.svg" },
  carlton: { name: "Carlton", short: "CAR", primary: "#0E1E2D", secondary: "#FFFFFF", icon: "/teams/carlton.svg" },
  collingwood: { name: "Collingwood", short: "COL", primary: "#000000", secondary: "#FFFFFF", icon: "/teams/collingwood.svg" },
  essendon: { name: "Essendon", short: "ESS", primary: "#CC2031", secondary: "#000000", icon: "/teams/essendon.svg" },
  fremantle: { name: "Fremantle", short: "FRE", primary: "#2A0D45", secondary: "#FFFFFF", icon: "/teams/fremantle.svg" },
  geelong: { name: "Geelong", short: "GEE", primary: "#001F3D", secondary: "#FFFFFF", icon: "/teams/geelong.svg" },
  goldcoast: { name: "Gold Coast", short: "GCS", primary: "#D63239", secondary: "#F6BD00", icon: "/teams/goldcoast.svg" },
  gws: { name: "GWS Giants", short: "GWS", primary: "#F47920", secondary: "#4A4F55", icon: "/teams/gws.svg" },
  hawthorn: { name: "Hawthorn", short: "HAW", primary: "#4D2004", secondary: "#FBBF15", icon: "/teams/hawthorn.svg" },
  melbourne: { name: "Melbourne", short: "MEL", primary: "#0F1131", secondary: "#CC2031", icon: "/teams/melbourne.svg" },
  northmelbourne: { name: "North Melbourne", short: "NTH", primary: "#013B9F", secondary: "#FFFFFF", icon: "/teams/northmelbourne.svg" },
  portadelaide: { name: "Port Adelaide", short: "PTA", primary: "#008AAB", secondary: "#000000", icon: "/teams/portadelaide.svg" },
  richmond: { name: "Richmond", short: "RIC", primary: "#000000", secondary: "#FED102", icon: "/teams/richmond.svg" },
  stkilda: { name: "St Kilda", short: "STK", primary: "#ED0F05", secondary: "#000000", icon: "/teams/stkilda.svg" },
  sydney: { name: "Sydney", short: "SYD", primary: "#ED171F", secondary: "#FFFFFF", icon: "/teams/sydney.svg" },
  westcoast: { name: "West Coast", short: "WCE", primary: "#002B5C", secondary: "#F2A900", icon: "/teams/westcoast.svg" },
  bulldogs: { name: "Western Bulldogs", short: "WBD", primary: "#014896", secondary: "#E31937", icon: "/teams/bulldogs.svg" },
};
