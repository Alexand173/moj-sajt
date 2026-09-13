import { getPublicSupabaseClient } from '@/lib/supabase-public';
import { generateTourProfileCopy, applyTourProfileCopy } from '@/lib/tour-profile-ai';
import { getSeededTourProfile } from '@/lib/tour-profile-seeds';
import { normalizeArtistIdentity } from '@/lib/tour-profile-core';

const slug = process.argv[2]?.trim().toLowerCase() || 'metallica';

async function main() {
  const seed = getSeededTourProfile(slug);
  if (!seed) throw new Error(`No seeded tour profile exists for ${slug}. Add a reviewed seed before enrichment.`);

  const trustedFacts = [
    `Official artist source: https://www.metallica.com/`,
    `Grammy artist reference: https://www.grammy.com/artists/metallica/12834`,
    ...seed.sourceUrls,
    `Current ticket events are loaded from the koncerti table and must remain the source of truth for dates and Ticketmaster URLs.`,
  ].join('\n');
  const draft = await generateTourProfileCopy({ profile: seed, trustedFacts });
  const profile = applyTourProfileCopy(seed, draft);
  const supabase = getPublicSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');

  const { error: profileError } = await supabase.from('artist_tour_profiles').upsert({
    canonical_slug: profile.canonicalSlug,
    canonical_name: profile.canonicalName,
    profile_data: profile,
    hero_image_url: profile.heroImageUrl,
    seo_title: profile.seoTitle,
    seo_description: profile.seoDescription,
    source_urls: profile.sourceUrls,
    content_origin: profile.contentOrigin,
    ai_status: profile.aiStatus,
    ai_model: process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
    ai_generated_at: draft ? new Date().toISOString() : null,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'canonical_slug' });
  if (profileError) throw new Error(`Could not persist tour profile: ${profileError.message}`);

  const aliases = Array.from(new Set([profile.canonicalName, ...profile.aliases]));
  const { error: aliasError } = await supabase.from('artist_tour_aliases').upsert(
    aliases.map((alias) => ({
      alias_key: normalizeArtistIdentity(alias),
      alias_display: alias,
      canonical_slug: profile.canonicalSlug,
      source: 'seeded-profile',
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'alias_key' },
  );
  if (aliasError) throw new Error(`Could not persist tour aliases: ${aliasError.message}`);

  console.info(JSON.stringify({
    event: 'tour_profile_enriched',
    slug: profile.canonicalSlug,
    contentOrigin: profile.contentOrigin,
    aiStatus: profile.aiStatus,
    generated: Boolean(draft),
    aliases: aliases.length,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
