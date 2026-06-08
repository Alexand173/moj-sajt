import React from 'react';

interface StructuredDataProps {
  data: Record<string, any>;
}

/**
 * A reusable component to inject JSON-LD structured data into the page.
 */
const StructuredData: React.FC<StructuredDataProps> = ({ data }) => {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
};

export default StructuredData;
