import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://musictop.net';

  // 1. DEFINIŠI STRUKTURU (Region i njegovi specifični žanrovi)
  const siteStructure = {
    us: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    uk: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    europa: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    latino: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    asia: ['j-pop', 'j-rock-metal', 'k-pop', 'c-pop', 'india', 'other'],
    world: ['rock', 'pop', 'hip-hop', 'rb-soul', 'country', 'dance'],
    jazz: ['jazz'],
    classical: ['classical']
  };

const mainRoutes = [
    { url: '', priority: 1.0 },
    { url: '/reviews', priority: 0.8 },
    { url: '/awards', priority: 0.8 },
  ];

  // 3. Generisanje svih kombinacija (Region -> Žanr)
  const dynamicRoutes = Object.entries(siteStructure).flatMap(([region, genres]) => {
    // Stranica regiona (npr. /region/us)
      // Stranice žanrova (npr. /region/us/rock)
   const genrePages = genres.map((genre) => ({
    url: `/region/${region}/${genre}`,
    priority: 0.7,
  }));
  
  return genrePages; // Vraćamo samo listu žanrova
});

const toursRoutes = Object.keys(siteStructure).map((region) => ({
  url: `/tours/${region}`,
  priority: 0.9,
}));


  // 4. Vesti po regionima
  const newsByRegionRoutes = Object.keys(siteStructure).map((region) => ({
    url: `/news/${region}`,
    priority: 0.9,
  }));

const festivalsRoutes = Object.keys(siteStructure).map((region) => ({
  url: `/festivals/${region}`,
  priority: 0.9,
}));


  // Sastavljanje mape
  return [...mainRoutes, ...dynamicRoutes, ...newsByRegionRoutes, ...toursRoutes, ...festivalsRoutes].map((route) => ({
    url: `${baseUrl}${route.url}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route.priority,
  }));
}
