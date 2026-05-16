import { createClient } from '../../../utils/supabase/server';
import ConcertsList from '@/components/ConcertsList';
import AdSenseBanner from '@/components/AdSenseBanner';

type Params = Promise<{ regionName: string }>;

export default async function Page({ params }: { params: Params }) {
  const { regionName } = await params;

  if (!regionName) {
    return <div className="text-center py-20 text-gray-500">Region not found.</div>;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('koncerti')
    .select('*')
    .ilike('region', regionName);

  // --- LOGIKA GRUPISANJA ---
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

  // --- MAPIRANJE REKLAMA (Svi slotovi na jednom mestu) ---
  const region = regionName.toUpperCase();
  
  const tourAdSlots: Record<
    string, 
    { top: string; mid1: string; mid2: string; mid3: string; mid4: string; bottom: string }
  > = {
    "US": {
      top: "7000000001",
      mid1: "7000000002",
      mid2: "7000000003",
      mid3: "7000000004",
      mid4: "7000000005",
      bottom: "7000000006"
    },
    "EUROPA": {
      top: "8000000001",
      mid1: "8000000002",
      mid2: "8000000003",
      mid3: "8000000004",
      mid4: "8000000005",
      bottom: "8000000006"
    },
    "ASIA": {
      top: "9000000001",
      mid1: "9000000002",
      mid2: "9000000003",
      mid3: "9000000004",
      mid4: "9000000005",
      bottom: "9000000006"
    },
    "LATINO": {
      top: "1100000001",
      mid1: "1100000002",
      mid2: "1100000003",
      mid3: "1100000004",
      mid4: "1100000005",
      bottom: "1100000006"
    },
    "WORLD": {
      top: "1200000001",
      mid1: "1200000002",
      mid2: "1200000003",
      mid3: "1200000004",
      mid4: "1200000005",
      bottom: "1200000006"
    },
    "JAZZ": {
      top: "1300000001",
      mid1: "1300000002",
      mid2: "1300000003",
      mid3: "1300000004",
      mid4: "1300000005",
      bottom: "1300000006"
    },
    "CLASSICAL": {
      top: "1400000001",
      mid1: "1400000002",
      mid2: "1400000003",
      mid3: "1400000004",
      mid4: "1400000005",
      bottom: "1400000006"
    },
    "DEFAULT": {
      top: "0000000001",
      mid1: "0000000002",
      mid2: "0000000003",
      mid3: "0000000004",
      mid4: "0000000005",
      bottom: "0000000006"
    }
  };

  const trenutniSlotovi = tourAdSlots[region] || tourAdSlots.DEFAULT;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      
      {/* 1. REKLAMA: NA SAMOM VRHU (Ostaje ovde jer ne zavisi od niza koncerata) */}
      <div className="mb-6">
        <AdSenseBanner adSlot={trenutniSlotovi.top} />
      </div>

      <h1 className="text-4xl font-bold mb-10 text-center capitalize text-white">
        Concerts for {regionName}
      </h1>

      {/* Prosleđujemo APSOLUTNO SVE SLOTOVE u ConcertsList */}
      <ConcertsList 
        dataZaPrikaz={dataZaPrikaz as any} 
        mid1={trenutniSlotovi.mid1}
        mid2={trenutniSlotovi.mid2}
        mid3={trenutniSlotovi.mid3}
        mid4={trenutniSlotovi.mid4}
        bottom={trenutniSlotovi.bottom} // <-- Dodat donji slot
      />

    </div>
  );
}