const siteUrl = "https://xn--80aaas0a1afjm2c.xn--e1afffngyp.xn--p1ai";

function toJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: toJsonLd(data) }}
    />
  );
}

export function LocalBusinessStructuredData() {
  const organizationId = `${siteUrl}/#organization`;
  const businessId = `${siteUrl}/#print-shop`;

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": organizationId,
            name: "Типография Copyleft",
            url: siteUrl,
            email: "zakaz@listovok.ru",
            telephone: "+7-473-206-61-77",
          },
          {
            "@type": ["PrintShop", "LocalBusiness"],
            "@id": businessId,
            name: "Типография Copyleft",
            url: siteUrl,
            parentOrganization: {
              "@id": organizationId,
            },
            telephone: "+7-473-206-61-77",
            email: "zakaz@listovok.ru",
            address: {
              "@type": "PostalAddress",
              streetAddress: "ул. Шукшина, д. 21, офис 8",
              addressLocality: "Воронеж",
              addressRegion: "Воронежская область",
              addressCountry: "RU",
            },
            openingHoursSpecification: [
              {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: [
                  "https://schema.org/Monday",
                  "https://schema.org/Tuesday",
                  "https://schema.org/Wednesday",
                  "https://schema.org/Thursday",
                  "https://schema.org/Friday",
                ],
                opens: "10:00",
                closes: "18:30",
              },
              {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: "https://schema.org/Saturday",
                opens: "10:00",
                closes: "16:00",
              },
            ],
            hasOfferCatalog: {
              "@type": "OfferCatalog",
              name: "Услуги типографии Copyleft",
              itemListElement: [
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "Чёрно-белая печать документов",
                    url: siteUrl,
                  },
                },
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "Цветная печать",
                    url: `${siteUrl}/color-printing`,
                  },
                },
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "Фотопечать",
                    url: `${siteUrl}/photo-printing`,
                  },
                },
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "Ламинация документов",
                    url: `${siteUrl}/lamination`,
                  },
                },
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "Переплёт документов",
                    url: `${siteUrl}/metal-binding`,
                  },
                },
              ],
            },
          },
        ],
      }}
    />
  );
}

export function BreadcrumbStructuredData({
  items,
}: {
  items: Array<{
    name: string;
    path: string;
  }>;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: new URL(item.path, siteUrl).toString(),
        })),
      }}
    />
  );
}