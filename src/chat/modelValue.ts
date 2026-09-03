/**
 * Provider and model packed into one `<select>` value.
 *
 * With a handful of providers, one grouped dropdown is far less friction than
 * two dependent ones — but a `<select>` carries a single string, so the pair is
 * encoded as `providerId::modelId`. Model ids routinely contain `/` and `:`
 * (`anthropic/claude-sonnet-4.5`, `openai/gpt-5:online`), so the separator is
 * `::` and decoding splits on the *first* occurrence only.
 */
export const encode = (providerId: string, model: string) => `${providerId}::${model}`;

export function decode(value: string): { providerId: string; model: string } | null {
  const index = value.indexOf("::");
  if (index < 0) return null;
  return { providerId: value.slice(0, index), model: value.slice(index + 2) };
}
