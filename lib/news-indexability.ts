export const MIN_INDEXABLE_ARTICLE_WORDS = 200;

export type NewsIndexabilityFields = {
  ai_content: string | null;
  ai_generated: boolean | null;
  ai_status: string | null;
};

export function countWords(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

export function hasValidatedAiContent(article: NewsIndexabilityFields): boolean {
  return article.ai_generated === true
    && article.ai_status === 'generated'
    && countWords(article.ai_content?.trim() || '') >= MIN_INDEXABLE_ARTICLE_WORDS;
}
