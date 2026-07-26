## Verification

### 1. Simulated OpenAI quota exhaustion
- **Target:** `generateAiNewsArticle` in `lib/ai-news.ts`
- **Method:** Ran a temporary direct invocation with synthetic source material exceeding the minimum AI-generation word threshold and the configured OpenAI credentials.
- **Temporary file:** `.tmp-fallback-check.ts` was created for the test and deleted immediately after verification.
- **Expected provider behavior:** OpenAI returns HTTP 429 with `insufficient_quota`.

### 2. Observed safe fallback
The runtime emitted:

```json
{"event":"news_rewrite_fallback","provider":"openai","reason":"provider_quota_exhausted","retryCount":0}
```

The returned result was verified as:

- `isAiGenerated: false`
- `similarityCheckPassed: false`
- `retryCount: 0`
- `similarityScore: 0`
- Source phrase was not present in fallback content
- Publisher attribution was present

Fallback content:

> MusicTop could not complete an independent editorial rewrite of this report from Synthetic Publisher.
>
> The publisher's article remains available through the source link below. It is intentionally not reproduced here while the editorial rewrite is unavailable.

## Result

The OpenAI quota-error path works as intended. It does not expose scraped publisher prose, marks the result as non-AI-generated, preserves source attribution, and allows the article page to direct readers to the original source.

No production code was changed during this verification.
