/// <reference types="astro/client" />

declare namespace astroHTML {
  interface HTMLAttributes {
    "client:load"?: boolean;
    "client:idle"?: boolean;
    "client:visible"?: boolean;
    "client:only"?: boolean | string;
  }
}
