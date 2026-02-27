import Image from "next/image";
import { teams, type TeamKey } from "@/config/teams";

interface TeamBadgeProps {
  team: TeamKey;
  size?: "sm" | "md";
  showFullName?: boolean;
  showName?: boolean;
}

const iconSizes = {
  sm: 20,
  md: 26,
};

export function TeamBadge({ team, size = "sm", showFullName = false, showName = true }: TeamBadgeProps) {
  const teamInfo = teams[team];
  const iconSize = iconSizes[size];
  const name = showFullName ? teamInfo.name : teamInfo.short;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
        style={{
          width: iconSize + 10,
          height: iconSize + 10,
          boxShadow: "0 1px 3px rgba(9, 29, 35, 0.08), inset 0 0 0 1px rgba(9, 29, 35, 0.06)",
        }}
      >
        <Image src={teamInfo.icon} alt={`${teamInfo.name} logo`} width={iconSize} height={iconSize} />
      </span>
      {showName ? (
        <span
          className={`font-semibold tracking-wide ${size === "md" ? "text-sm" : "text-xs"}`}
          style={{ color: "var(--foreground)" }}
        >
          {name}
        </span>
      ) : null}
    </span>
  );
}
