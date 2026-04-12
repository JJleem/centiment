export type GamePreset = {
  id: string;
  name: string;
  emoji: string;
  genre: string;
  downloads: string;
  ios_app_id: string;
  android_package: string;
};

export const SUPERCENT_GAMES: GamePreset[] = [
  {
    id: "pizza-ready",
    name: "Pizza Ready",
    emoji: "🍕",
    genre: "타이쿤",
    downloads: "3억+",
    ios_app_id: "6450917563",
    android_package: "io.supercent.pizzaidle",
  },
  {
    id: "snake-clash",
    name: "Snake Clash",
    emoji: "🐍",
    genre: "하이퍼 캐주얼",
    downloads: "글로벌 TOP",
    ios_app_id: "6449243946",
    android_package: "io.supercent.linkedcubic",
  },
  {
    id: "burger-please",
    name: "Burger Please!",
    emoji: "🍔",
    genre: "타이쿤",
    downloads: "글로벌 TOP 10",
    ios_app_id: "1668713081",
    android_package: "io.supercent.burgeridle",
  },
];
