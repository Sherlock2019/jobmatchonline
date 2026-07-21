import { api } from '../api';
import { jobSamples } from '../content/jobSamples';
import type { JobDraft } from '../types';

/**
 * Import sources for job postings. Each source resolves to a JobDraft the
 * editor shows on a review screen before saving — a future real integration
 * (e.g. a LinkedIn partner API) implements this same interface.
 */
export interface JobSourceAdapter {
  id: string;
  label: string;
  /** Returns a draft plus which parser produced it (for the review banner). */
  importDraft(input?: { url?: string; text?: string }): Promise<{ draft: JobDraft; source: string }>;
}

/** Paste a job-board URL + full text; parsed server-side (Claude API if configured, heuristics otherwise). */
export const pasteAdapter: JobSourceAdapter = {
  id: 'paste',
  label: 'Paste from LinkedIn / job board',
  async importDraft(input) {
    if (!input?.text || input.text.trim().length < 40) throw new Error('Paste the full job text (at least a few lines)');
    const { parser, parsed } = await api.parseJob({ text: input.text, url: input.url });
    return { draft: parsed, source: parser === 'claude' ? 'Parsed with Claude' : 'Parsed with the built-in parser' };
  },
};

/** Instantly fills the form from bundled realistic sample postings. */
export const demoAdapter: JobSourceAdapter = {
  id: 'demo',
  label: 'Demo import',
  async importDraft() {
    const draft = jobSamples[Math.floor(Math.random() * jobSamples.length)];
    return { draft: structuredClone(draft), source: 'Demo sample posting' };
  },
};

export const jobSources = [pasteAdapter, demoAdapter];
