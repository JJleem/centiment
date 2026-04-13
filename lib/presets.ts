export type GamePreset = {
  id: string;
  name: string;
  genre: string;
  downloads: string;
  icon_url: string;
  store_rating: number;
  rating_count: number;
  ios_app_id: string;
  android_package: string;
};

export const SUPERCENT_GAMES: GamePreset[] = [
  {
    id: "pizza-ready",
    name: "Pizza Ready!",
    genre: "타이쿤",
    downloads: "3억+",
    icon_url:
      "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/99/95/61/99956180-4605-039f-3c7c-f7f594f6ea34/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg",
    store_rating: 4.58,
    rating_count: 306253,
    ios_app_id: "6450917563",
    android_package: "io.supercent.pizzaidle",
  },
  {
    id: "snake-clash",
    name: "Snake Clash!",
    genre: "하이퍼 캐주얼",
    downloads: "글로벌 TOP",
    icon_url:
      "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/ca/d0/f9/cad0f95b-dee6-287b-a82d-35195a5a670a/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg",
    store_rating: 4.66,
    rating_count: 649351,
    ios_app_id: "6449243946",
    android_package: "io.supercent.linkedcubic",
  },
  {
    id: "burger-please",
    name: "Burger Please!",
    genre: "타이쿤",
    downloads: "글로벌 TOP 10",
    icon_url:
      "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/37/a3/b2/37a3b22c-535b-9f62-006d-8d5020e357ee/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg",
    store_rating: 4.67,
    rating_count: 131483,
    ios_app_id: "1668713081",
    android_package: "io.supercent.burgeridle",
  },
];
