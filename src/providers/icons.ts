// Brand artwork lives in src/assets as SVGs; Vite bundles each as a URL.
// Dropping a new `<brand>.svg` into either folder and adding a rule below is
// all it takes to give another provider or model its logo.
const providerModules = import.meta.glob("../assets/providers/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const modelModules = import.meta.glob("../assets/models/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function byBasename(modules: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(modules)) {
    const base = path
      .split("/")
      .pop()
      ?.replace(/\.svg$/, "");
    if (base) out[base.toLowerCase()] = url;
  }
  return out;
}

const PROVIDER_ICONS = byBasename(providerModules);
const MODEL_ICONS = byBasename(modelModules);

// Match a provider or model name against known brand keywords, in priority
// order — `gpt` has to win before `openai` when a string contains both, and
// `gemma` before `gemini` since neither is a prefix of the other but the model
// lists mix them.
const BRAND_RULES: { keys: string[]; icon: string }[] = [
  { keys: ["deepseek"], icon: "deepseek" },
  { keys: ["openrouter"], icon: "openrouter" },
  { keys: ["moonshot", "kimi"], icon: "kimi" },
  { keys: ["ollama"], icon: "ollama-color" },
  { keys: ["lmstudio", "lm studio"], icon: "lmstudio" },
  { keys: ["gemma"], icon: "gemma" },
  { keys: ["gemini"], icon: "gemini" },
  { keys: ["google"], icon: "gemini" },
  { keys: ["claude", "anthropic"], icon: "claude" },
  { keys: ["gpt", "openai", "o1-", "o3-", "o4-", "chatgpt"], icon: "openai" },
  { keys: ["qwen", "通义", "千问", "dashscope", "qwq"], icon: "qwen" },
  { keys: ["alibaba", "aliyun", "阿里"], icon: "alibaba" },
  { keys: ["mimo", "xiaomi", "小米"], icon: "xiaomimimo" },
  { keys: ["grok"], icon: "grok" },
  { keys: ["xai"], icon: "xai" },
  { keys: ["minimax"], icon: "minimax" },
  { keys: ["inclusionai", "ling-", "ring-"], icon: "inclusionai" },
  { keys: ["z-ai", "z.ai"], icon: "z-ai" },
  { keys: ["glm", "zhipu", "智谱", "chatglm"], icon: "zhipu" },
  { keys: ["ernie", "baidu", "文心", "百度"], icon: "baidu" },
  { keys: ["meituan", "longcat", "美团"], icon: "meituan" },
  { keys: ["nvidia", "nemotron"], icon: "nvidia" },
  { keys: ["doubao", "bytedance", "豆包", "字节", "seed"], icon: "bytedance" },
  { keys: ["hunyuan", "tencent", "混元", "腾讯"], icon: "tencent" },
  { keys: ["phi-", "microsoft", "wizardlm"], icon: "microsoft" },
  { keys: ["huggingface", "hugging face"], icon: "huggingface" },
  { keys: ["siliconflow", "硅基"], icon: "siliconflow" },
  { keys: ["kling", "可灵"], icon: "kling" },
  { keys: ["dots"], icon: "dots" },
  { keys: ["moleapi", "mole"], icon: "MoleAPI" },
];

// The two folders spell a few brands differently, and neither set is complete —
// providers/ has openrouter and siliconflow that models/ lacks, models/ has
// inclusionai and z-ai that providers/ lacks. Falling back through the alias
// (and then to the other folder) means a rule written once works in both places.
const ALIASES: Record<string, string> = { qwen: "qwenai", qwenai: "qwen" };

function pick(primary: Record<string, string>, icon: string): string | null {
  const key = icon.toLowerCase();
  const alias = ALIASES[key];
  const secondary = primary === PROVIDER_ICONS ? MODEL_ICONS : PROVIDER_ICONS;
  return (
    primary[key] ??
    (alias ? primary[alias] : undefined) ??
    secondary[key] ??
    (alias ? secondary[alias] : undefined) ??
    null
  );
}

function matchIcon(text: string): string | null {
  const lower = text.toLowerCase();
  return BRAND_RULES.find((rule) => rule.keys.some((key) => lower.includes(key)))?.icon ?? null;
}

export function providerIconUrl(name: string, kind: string): string | null {
  const icon = matchIcon(`${name} ${kind}`);
  return icon ? pick(PROVIDER_ICONS, icon) : null;
}

/**
 * A model's brand logo, matched on its id first.
 *
 * The id is where the brand actually lives — `anthropic/claude-sonnet-4.5`
 * names its maker, while the display name may be anything the provider chose.
 */
export function modelIconUrl(id: string, name: string): string | null {
  const icon = matchIcon(`${id} ${name}`);
  return icon ? pick(MODEL_ICONS, icon) : null;
}

/** First meaningful character, for the fallback tile when no logo matches. */
export function providerInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : "?";
}
