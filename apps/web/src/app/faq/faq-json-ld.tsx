"use client";

import { useServerInsertedHTML } from "next/navigation";
import { useRef } from "react";
import { faqStructuredData, serializeJsonLd } from "./structured-data";

interface FaqJsonLdProps {
  nonce?: string;
  siteUrl: string;
}

export function FaqJsonLd({ nonce, siteUrl }: FaqJsonLdProps) {
  const inserted = useRef(false);

  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;

    return (
      <>
        {faqStructuredData(siteUrl).map((schema) => (
          <script
            key={schema.id}
            id={schema.id}
            type="application/ld+json"
            nonce={nonce}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema.data) }}
          />
        ))}
      </>
    );
  });

  return null;
}
