export function generisiAffiliateLink(izvorniLink: string): string {
  if (!izvorniLink) return '#';
  if (izvorniLink.includes('evyy.net')) return izvorniLink;

  const mojImpactId = '7366014';
  const proveraLinka = izvorniLink.toLowerCase();
  const affiliateMape: Record<string, { mediaRail: string; campaign: string }> = {
    'moshtix.com.au': { mediaRail: '1958987', campaign: '23905' },
    'ticketmaster.com': { mediaRail: '264167', campaign: '4272' },
    'ticketmaster.be': { mediaRail: '1958966', campaign: '23894' },
    'moshtix.co.nz': { mediaRail: '1958990', campaign: '23906' },
    'quicket.co.za': { mediaRail: '3003989', campaign: '36141' },
    'ticketmaster.com.au': { mediaRail: '1965672', campaign: '24024' },
    'ticketmaster.at': { mediaRail: '1958968', campaign: '23895' },
    'ticketmaster.com.br': { mediaRail: '2127876', campaign: '27025' },
    'ticketmaster.cl': { mediaRail: '2127878', campaign: '27026' },
    'ticketmaster.cz': { mediaRail: '1958979', campaign: '23901' },
    'ticketmaster.dk': { mediaRail: '1958964', campaign: '23893' },
    'ticketmaster.fi': { mediaRail: '1958962', campaign: '23892' },
    'ticketmaster.fr': { mediaRail: '1958960', campaign: '23891' },
    'ticketmaster.de': { mediaRail: '1958958', campaign: '23890' },
    'ticketmaster.gr': { mediaRail: '264167', campaign: '4272' },
    'ticketmaster.ie': { mediaRail: '1958956', campaign: '23889' },
    'ticketmaster.it': { mediaRail: '1958975', campaign: '23899' },
    'ticketmaster.com.mx': { mediaRail: '1958981', campaign: '23902' },
    'ticketmaster.nl': { mediaRail: '1958954', campaign: '23888' },
    'ticketmaster.co.nz': { mediaRail: '1965674', campaign: '24025' },
    'ticketmaster.no': { mediaRail: '1958977', campaign: '23900' },
    'ticketmaster.pe': { mediaRail: '2127881', campaign: '27028' },
    'ticketmaster.pl': { mediaRail: '1958971', campaign: '23896' },
    'ticketmaster.ch': { mediaRail: '1958973', campaign: '23898' },
    'ticketmaster.co.za': { mediaRail: '1958983', campaign: '23903' },
    'ticketmaster.es': { mediaRail: '1958952', campaign: '23886' },
    'ticketmaster.se': { mediaRail: '1958950', campaign: '23885' },
    'ticketmaster.com.tr': { mediaRail: '1958996', campaign: '23908' },
    'ticketmaster.ae': { mediaRail: '1958985', campaign: '23904' },
    'ticketmaster.co.uk': { mediaRail: '1965662', campaign: '24023' },
  };

  const sortiraniDomeni = Object.keys(affiliateMape).sort((a, b) => b.length - a.length);
  for (const domen of sortiraniDomeni) {
    if (proveraLinka.includes(domen)) {
      const { mediaRail, campaign } = affiliateMape[domen];
      return `https://ticketmaster.evyy.net/c/${mojImpactId}/${mediaRail}/${campaign}?u=${encodeURIComponent(izvorniLink)}`;
    }
  }

  return `https://ticketmaster.evyy.net/c/${mojImpactId}/264167/4272?u=${encodeURIComponent(izvorniLink)}`;
}
