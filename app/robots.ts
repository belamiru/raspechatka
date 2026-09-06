import type { MetadataRoute } from "next";

const siteUrl = "https://xn--80aaas0a1afjm2c.xn--e1afffngyp.xn--p1ai";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/order/",
        "/payment/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}