import Image from "next/image";
import { teams, type TeamKey } from "@/config/teams";

interface TeamBadgeProps {
  team: TeamKey;
  size?: "sm" | "md";
  showFullName?: boolean;
}

const iconSizes = {
  sm: 20,
  md: 28,
};

export function TeamBadge({ team, size = "sm", showFullName = false }: TeamBadgeProps) {
  const teamInfo = teams[team];
  const iconSize = iconSizes[size];
  const name = showFullName ? teamInfo.name : teamInfo.short;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm"
        style={{ width: iconSize + 8, height: iconSize + 8 }}
      >
        <Image src={teamInfo.icon} alt={`${teamInfo.name} logo`} width={iconSize} height={iconSize} />
      </span>
      <span className="font-semibold tracking-wide text-slate-800">{name}</span>
    </span>
  );
}
