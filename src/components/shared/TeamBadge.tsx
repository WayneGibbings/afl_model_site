import Image from "next/image";
import { teams, type TeamKey } from "@/config/teams";

interface TeamBadgeProps {
  team: TeamKey;
  size?: "sm" | "md";
  showFullName?: boolean;
}

const iconSizes = {
  sm: 20,
  md: 26,
};

export function TeamBadge({ team, size = "sm", showFullName = false }: TeamBadgeProps) {
  const teamInfo = teams[team];
  const iconSize = iconSizes[size];
  const name = showFullName ? teamInfo.name : teamInfo.short;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200"
        style={{ width: iconSize + 10, height: iconSize + 10 }}
      >
        <Image src={teamInfo.icon} alt={`${teamInfo.name} logo`} width={iconSize} height={iconSize} />
      </span>
      <span className={`font-semibold tracking-wide text-slate-800 ${size === "md" ? "text-sm" : "text-xs"}`}>
        {name}
      </span>
    </span>
  );
}
