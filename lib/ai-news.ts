import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';

const MAX_SOURCE_CHARACTERS = 14_000;
const MIN_PROFESSIONAL_WORDS = 450;
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash-lite';

export interface AiNewsArticle {
  seoTitle: string;
  seoDescription: string;
  articleContent: string;
  isAiGenerated: boolean;
}

interface GenerateAiNewsArticleInput {
  title: string;
  excerpt?: string | null;
  existingContent?: string | null;
  sourceUrl?: string | null;
  sourceArticleText?: string | null;
  sourceName: string;
}

interface NewsApiArticle {
  title?: string | null;
  description?: string | null;
  content?: string | null;
  url?: string | null;
  source?: { name?: string | null } | null;
}

export interface ResolvedNewsSource {
  sourceUrl: string | null;
  sourceName: string;
  sourceArticleText: string;
  excerpt: string;
}

function cleanSourceText(value: string | null | undefined): string {
  return (value || '')
    .replace(/\[\+\d+ chars\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function formatArticleContent(value: string): string {
  const normalized = value.replace(/\r/g, '').trim();
  const existingParagraphs = normalized.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (existingParagraphs.length >= 3) return existingParagraphs.join('\n\n');

  const sentences = normalized.match(/[^.!?]+[.!?]+(?:["'”’])?/g)?.map((sentence) => sentence.trim()).filter(Boolean);
  if (!sentences || sentences.length < 4) return normalized;

  const paragraphCount = Math.min(8, Math.max(4, Math.ceil(sentences.length / 3)));
  const sentencesPerParagraph = Math.ceil(sentences.length / paragraphCount);
  const paragraphs: string[] = [];

  for (let index = 0; index < sentences.length; index += sentencesPerParagraph) {
    paragraphs.push(sentences.slice(index, index + sentencesPerParagraph).join(' '));
  }

  return paragraphs.join('\n\n');
}

function trimToSourceLimit(value: string): string {
  if (value.length <= MAX_SOURCE_CHARACTERS) return value;

  const shortened = value.slice(0, MAX_SOURCE_CHARACTERS);
  const lastParagraphBreak = shortened.lastIndexOf('\n\n');
  return shortened.slice(0, lastParagraphBreak > 500 ? lastParagraphBreak : MAX_SOURCE_CHARACTERS).trim();
}

const SOURCE_NOISE_PATTERNS = [
  /^(read|continue)\s+(more|reading)/i,
  /^(leave|post)\s+a\s+comment/i,
  /^(comments?|replies?)\s+(are|is)\s+closed/i,
  /^(subscribe|sign\s+up|follow\s+us|join\s+our)/i,
  /^(share|tweet|pin|bookmark)\s+(this|it)/i,
  /^(related|recommended|more\s+from|you\s+might\s+also)/i,
  /^(advertisement|sponsored|promoted\s+content)/i,
];

function isSourceNoiseParagraph(paragraph: string): boolean {
  return SOURCE_NOISE_PATTERNS.some((pattern) => pattern.test(paragraph.trim()));
}

function uniqueParagraphs(paragraphs: string[]): string[] {
  const seen = new Set<string>();

  return paragraphs.filter((paragraph) => {
    const normalized = paragraph.toLowerCase().replace(/\s+/g, ' ').trim();
    if (
      normalized.length < 40 ||
      seen.has(normalized) ||
      isSourceNoiseParagraph(normalized)
    ) return false;
    seen.add(normalized);
    return true;
  });
}

function extractParagraphs($: cheerio.CheerioAPI, selector: string): string[] {
  return uniqueParagraphs(
    $(selector)
      .find('p')
      .toArray()
      .map((element) => cleanSourceText($(element).text())),
  );
}

/**
 * NewsAPI frequently exposes only a truncated `content` field. When an
 * original URL is available, retrieve the readable article body before asking
 * Gemini to write the editorial version.
 */
export async function fetchNewsSourceText(sourceUrl: string | null | undefined): Promise<string> {
  if (!sourceUrl) return '';

  try {
    const parsedUrl = new URL(sourceUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return '';

    const response = await fetch(sourceUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; MusicTopNewsBot/1.0)',
      },
    });

    if (!response.ok) return '';

    const html = await response.text();
    const $ = cheerio.load(html);
    $(
      'script, style, noscript, nav, footer, header, aside, form, iframe, ' +
      '[class*="comment"], [id*="comment"], [class*="newsletter"], [id*="newsletter"], ' +
      '[class*="social"], [id*="social"], [class*="share"], [id*="share"], ' +
      '[class*="related"], [id*="related"], [class*="recommended"], [id*="recommended"], ' +
      '[class*="subscribe"], [id*="subscribe"]',
    ).remove();

    const selectors = [
      'article',
      '[itemprop="articleBody"]',
      '[class*="article-body"]',
      '[class*="article-content"]',
      '[class*="story-body"]',
      '[class*="entry-content"]',
      'main',
    ];

    const candidates = selectors
      .map((selector) => extractParagraphs($, selector).join('\n\n'))
      .filter(Boolean);

    const bestCandidate = candidates.sort((a, b) => b.length - a.length)[0] || extractParagraphs($, 'body').join('\n\n');
    return trimToSourceLimit(bestCandidate);
  } catch (error) {
    console.warn('Could not retrieve the original news article:', error);
    return '';
  }
}

/** Resolve a NewsAPI article URL and, when needed, recover the source URL by headline. */
export async function resolveNewsSource(input: {
  title: string;
  excerpt?: string | null;
  existingContent?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
}): Promise<ResolvedNewsSource> {
  let sourceUrl = input.sourceUrl || null;
  let sourceName = getNewsSourceName(sourceUrl, input.sourceName);
  let sourceArticleText = await fetchNewsSourceText(sourceUrl);

  if (!sourceUrl && process.env.NEWS_API_KEY) {
    try {
      const query = encodeURIComponent(`"${input.title}"`);
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=${query}&language=en&pageSize=5&sortBy=relevancy&apiKey=${process.env.NEWS_API_KEY}`,
        { cache: 'no-store', signal: AbortSignal.timeout(8_000) },
      );
      const data = (await response.json()) as { articles?: NewsApiArticle[] };
      const match = data.articles?.find((article) => article.title?.trim().toLowerCase() === input.title.trim().toLowerCase());

      if (match) {
        sourceUrl = match.url || null;
        sourceName = getNewsSourceName(sourceUrl, match.source?.name || input.sourceName);
        sourceArticleText = await fetchNewsSourceText(sourceUrl);

        if (!sourceArticleText && match.content) {
          sourceArticleText = cleanSourceText(match.content);
        }
      }
    } catch (error) {
      console.warn('Could not resolve the original article through NewsAPI:', error);
    }
  }

  return {
    sourceUrl,
    sourceName,
    sourceArticleText,
    excerpt: cleanSourceText(input.excerpt),
  };
}

function combineSourceMaterial(input: GenerateAiNewsArticleInput): string {
  const sourceArticleText = trimToSourceLimit(cleanSourceText(input.sourceArticleText));
  const existingContent = cleanSourceText(input.existingContent);
  const excerpt = cleanSourceText(input.excerpt);

  // Once the full publisher article is available, do not append NewsAPI's
  // shorter duplicate snippets to the model context.
  const sections = wordCount(sourceArticleText) >= 200
    ? [sourceArticleText]
    : [sourceArticleText, existingContent, excerpt].filter(Boolean);

  return sections.filter((section, index) => sections.indexOf(section) === index).join('\n\n');
}

function fallbackArticle(input: GenerateAiNewsArticleInput, sourceMaterial: string): AiNewsArticle {
  const fallbackText = sourceMaterial || cleanSourceText(input.excerpt) || cleanSourceText(input.existingContent);

  return {
    seoTitle: input.title,
    seoDescription: cleanSourceText(input.excerpt || sourceMaterial).slice(0, 180),
    articleContent: formatArticleContent(
      fallbackText ||
        `The original report from ${input.sourceName} did not include enough publishable text to create a complete editorial article.`,
    ),
    isAiGenerated: false,
  };
}

export function getNewsSourceName(
  sourceUrl: string | null | undefined,
  sourceName?: string | null,
): string {
  if (sourceName?.trim()) return sourceName.trim();
  if (!sourceUrl?.trim()) return 'NewsAPI (original source unavailable)';

  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    return sourceUrl;
  }
}

function parseJsonResponse(responseText: string): Partial<AiNewsArticle> {
  const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
  const objectStart = cleaned.indexOf('{');
  const objectEnd = cleaned.lastIndexOf('}');
  if (objectStart === -1 || objectEnd <= objectStart) throw new Error('AI response did not contain JSON.');
  return JSON.parse(cleaned.slice(objectStart, objectEnd + 1)) as Partial<AiNewsArticle>;
}

export async function generateAiNewsArticle(
  input: GenerateAiNewsArticleInput,
): Promise<AiNewsArticle> {
  const resolvedSource = input.sourceArticleText === undefined
    ? await resolveNewsSource(input)
    : {
        sourceUrl: input.sourceUrl || null,
        sourceName: input.sourceName,
        sourceArticleText: input.sourceArticleText || '',
        excerpt: cleanSourceText(input.excerpt),
      };
  const resolvedInput: GenerateAiNewsArticleInput = {
    ...input,
    sourceUrl: resolvedSource.sourceUrl,
    sourceName: resolvedSource.sourceName,
    sourceArticleText: resolvedSource.sourceArticleText,
    excerpt: resolvedSource.excerpt,
  };
  const sourceMaterial = combineSourceMaterial(resolvedInput);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return fallbackArticle(resolvedInput, sourceMaterial);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const configuredModel = (process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL).replace(/^models\//, '');
    const modelNames = Array.from(new Set([
      configuredModel,
      DEFAULT_GEMINI_MODEL,
      FALLBACK_GEMINI_MODEL,
    ]));
    const prompt = `
You are the senior editor of MusicTop, a professional international music-news publication. Rewrite the supplied NewsAPI source into a complete, publication-ready news article.

SOURCE NAME: ${resolvedInput.sourceName}
HEADLINE: ${resolvedInput.title}
NEWSAPI SUMMARY: ${resolvedInput.excerpt || 'Not provided'}
ORIGINAL SOURCE MATERIAL:
${sourceMaterial || 'Not available'}

Editorial requirements:
- Write 700 to 1,000 words in 8 to 12 substantial paragraphs.
- Produce a genuinely original editorial rewrite, not a transcript, summary, or lightly edited copy of the source.
- Use a different sentence structure and vocabulary from the source. Never copy any complete source sentence, quoted comment, interview answer, social-media comment, or distinctive phrase longer than five consecutive words.
- Preserve confirmed facts, but paraphrase them and clearly attribute reported claims to ${resolvedInput.sourceName} where appropriate.
- Exclude comments, reader reactions, comment-section discussion, promotional copy, newsletter prompts, navigation text, calls to subscribe, and “read more” or related-story snippets.
- Use a professional, neutral music-journalism tone with clear chronology, context, and industry relevance.
- Explain why the announcement matters to the artist, release, audience, or wider music scene only when that conclusion is supported by the source.
- Do not invent quotes, names, dates, numbers, collaborations, history, reactions, or background facts. Do not reproduce source quotes unless they are essential to a confirmed fact; paraphrase them instead.
- Do not pad the article, repeat the same sentence, or mention that you are an AI.
- If the source is incomplete, use careful language such as “the report states” or “details remain limited” instead of guessing.
- Return only valid JSON with this exact structure and no markdown:
{
  "seoTitle": "Accurate editorial headline, maximum 70 characters",
  "seoDescription": "Factual article lead, maximum 180 characters",
  "articleContent": "The complete article with paragraphs separated by blank lines"
}
`;

    let responseText = '';
    let lastModelError: unknown;

    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        break;
      } catch (error) {
        lastModelError = error;
        const message = error instanceof Error ? error.message : String(error);
        const isModelAvailabilityError = /404|not found|not supported/i.test(message);

        if (!isModelAvailabilityError) throw error;
        console.warn(`Gemini model "${modelName}" is unavailable; trying the next configured model.`);
      }
    }

    if (!responseText) {
      throw lastModelError || new Error('No configured Gemini model returned a response.');
    }

    const parsed = parseJsonResponse(responseText);
    const articleContent = formatArticleContent(parsed.articleContent?.trim() || '');

    if (!articleContent) throw new Error('AI response did not include article content.');

    const sourceWords = wordCount(sourceMaterial);
    if (sourceWords >= MIN_PROFESSIONAL_WORDS && wordCount(articleContent) < MIN_PROFESSIONAL_WORDS) {
      throw new Error('AI response was shorter than the professional article minimum.');
    }

    return {
      seoTitle: parsed.seoTitle?.trim() || resolvedInput.title,
      seoDescription: parsed.seoDescription?.trim() || cleanSourceText(resolvedInput.excerpt).slice(0, 180),
      articleContent,
      isAiGenerated: true,
    };
  } catch (error) {
    console.warn('AI news article generation failed; using source-based fallback:', error);
    return fallbackArticle(resolvedInput, sourceMaterial);
  }
}
