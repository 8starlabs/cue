import { createCueSocialImage } from "./social-image";

export const alt = "Cue — IDE-style autocomplete for Terminal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return createCueSocialImage();
}
