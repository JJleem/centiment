import Image from "next/image";
import type { GamePreset } from "@/lib/presets";

interface Props {
  game: GamePreset;
  size?: number;
  className?: string;
}

export default function GameIcon({ game, size = 40, className = "" }: Props) {
  return (
    <Image
      src={game.icon_url}
      alt={game.name}
      width={size}
      height={size}
      className={`rounded-xl ${className}`}
      unoptimized
    />
  );
}
