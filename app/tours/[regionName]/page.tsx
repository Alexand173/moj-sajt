import { createClient } from '../../../utils/supabase/server';

type Params = Promise<{ regionName: string }>;

export default async function Page({ params }: { params: Params }) {
  const { regionName } = await params;

  if (!regionName) {
    return <div className="text-center py-20">Region not found.</div>;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('koncerti')
    .select('*')
    .ilike('region', regionName);

  // --- LOGIKA GRUPISANJA ---
  // Transformišemo niz u objekat gde je ključ ime benda
  const grupisani = data?.reduce((acc: any, item: any) => {
    const key = item.artist_name;
    if (!acc[key]) {
      acc[key] = {
        artist_name: item.artist_name,
        image_url: item.image_url,
        events: []
      };
    }
    acc[key].events.push({
      id: item.id,
      date: item.date,
      location: item.location,
      ticket_link: item.ticket_link
    });
    return acc;
  }, {});

  const dataZaPrikaz = grupisani ? Object.values(grupisani) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-10 text-center capitalize">
        Concerts for {regionName}
      </h1>

      {dataZaPrikaz && dataZaPrikaz.length > 0 ? (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-4">
          {dataZaPrikaz.map((grupa: any) => (
            <div 
              key={grupa.artist_name} 
              className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
            >
              {/* Slika se sada prikazuje jednom po bendu */}
              {grupa.image_url && (
                <div className="h-40 w-full overflow-hidden">
                  <img 
                    src={grupa.image_url} 
                    alt={grupa.artist_name} 
                    className="w-full h-full object-cover" 
                  />
                </div>
              )}
              
              <div className="p-4 flex flex-col flex-grow">
                <h2 className="text-lg font-bold mb-3 text-gray-800">{grupa.artist_name}</h2>
                
                {/* Lista događaja za taj bend */}
                <div className="space-y-3">
                  {grupa.events.map((event: any) => (
                    <div key={event.id} className="border-t pt-2 flex justify-between items-center text-xs text-gray-600">
                      <div>
                        <p>{event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}</p>
                        <p className="font-semibold">{event.location}</p>
                      </div>
                      <a 
                        href={event.ticket_link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="bg-black text-white px-3 py-1 rounded-md hover:bg-gray-800 transition"
                      >
                        Tickets
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-20">
          <p className="text-lg">No concerts found for this region.</p>
        </div>
      )}
    </div>
  );
}