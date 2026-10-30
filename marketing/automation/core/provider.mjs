import { AppError } from './errors.mjs';

export class TextProvider {
  constructor({ config, store, fetchImpl = globalThis.fetch }) { Object.assign(this, { config, store, fetchImpl }); this.pendingCost = 0; }

  async status() {
    const state = await this.store.read();
    const usage = state.providerUsage?.period === this.config.providerPeriod ? state.providerUsage.spentUsd : 0;
    return { provider: this.config.provider, model: this.config.provider === 'template' ? 'local-template' : this.config.model || null, enabled: this.config.providerEnabled, budgetUsd: this.config.providerBudgetUsd, spentUsd: usage };
  }

  async regenerate(draft, prompt) {
    if (!this.config.providerEnabled) throw new AppError('provider_disabled', 'Choose an explicit text provider, model, API key, and positive budget first.', 503);
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 1200) throw new AppError('invalid_request', 'Prompt must be 1–1200 characters.');
    const state = await this.store.read();
    const spent = state.providerUsage?.period === this.config.providerPeriod ? state.providerUsage.spentUsd : 0;
    if (this.config.provider !== 'template' && spent >= this.config.providerBudgetUsd) throw new AppError('provider_budget_exhausted', 'The configured monthly text-generation budget is exhausted.', 429);
    if (this.config.provider === 'template') return this.#local(draft, prompt);
    return this.#openai(draft, prompt, spent);
  }

  #local(draft, prompt) {
    const instruction = prompt.trim();
    const copy = `Draft direction: ${instruction}\n\n${draft.caption}`.trim().slice(0, 5000);
    return { caption: copy, generatedBy: 'local-template', estimatedCostUsd: 0 };
  }

  async #openai(draft, prompt, spent) {
    const payload = {
      model: this.config.model,
      max_output_tokens: this.config.providerMaxOutputTokens,
      input: [
        { role: 'system', content: 'Revise social copy for Yard, a prelaunch Charlotte community app. Do not invent events, availability, testimonials, or product features. Return only JSON with a caption string.' },
        { role: 'user', content: JSON.stringify({ request: prompt, title: draft.title, currentCaption: draft.caption, hashtags: draft.hashtags, cta: draft.cta }) },
      ],
      text: { format: { type: 'json_object' } },
    };
    const maxCost = (Buffer.byteLength(JSON.stringify(payload), 'utf8') * this.config.providerInputUsdPerMillion + this.config.providerMaxOutputTokens * this.config.providerOutputUsdPerMillion) / 1_000_000;
    if (spent + this.pendingCost + maxCost > this.config.providerBudgetUsd) throw new AppError('provider_budget_exhausted', 'The configured remaining budget cannot cover the maximum request size.', 429);
    this.pendingCost += maxCost;
    try {
      const response = await this.fetchImpl('https://api.openai.com/v1/responses', {
        method: 'POST', headers: { Authorization: `Bearer ${this.config.providerApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), redirect: 'error', signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new AppError('provider_error', 'The configured text provider could not complete the request.', 502);
      const data = await response.json();
      const outputText = data.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
      let result;
      try { result = JSON.parse(outputText || ''); } catch { throw new AppError('provider_invalid_output', 'The text provider returned an invalid draft.', 502); }
      if (typeof result.caption !== 'string' || result.caption.length > 5000) throw new AppError('provider_invalid_output', 'The text provider returned an invalid caption.', 502);
      const inputTokens = Number(data.usage?.input_tokens || 0);
      const outputTokens = Number(data.usage?.output_tokens || 0);
      const estimate = (inputTokens * this.config.providerInputUsdPerMillion + outputTokens * this.config.providerOutputUsdPerMillion) / 1_000_000;
      if (!Number.isFinite(estimate) || spent + estimate > this.config.providerBudgetUsd) throw new AppError('provider_budget_exhausted', 'This response would exceed the configured monthly text-generation budget.', 429);
      await this.store.transaction((state) => {
        if (state.providerUsage.period !== this.config.providerPeriod) state.providerUsage = { period: this.config.providerPeriod, spentUsd: 0 };
        state.providerUsage.spentUsd += estimate;
      });
      return { caption: result.caption, generatedBy: this.config.model, estimatedCostUsd: estimate };
    } finally {
      this.pendingCost -= maxCost;
    }
  }
}
