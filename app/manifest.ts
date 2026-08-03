import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Statics App",
    short_name: "Statics",
    description: "Access Statics baskets, Dollar, lending, rewards, liquidity, and account tools.",
    start_url: "/app",
    display: "standalone",
    background_color: "#07120f",
    theme_color: "#07120f",
    icons: [
      {
        src: "/assets/statics-icon.png",
        sizes: "708x717",
        type: "image/png",
      },
    ],
  };
}
