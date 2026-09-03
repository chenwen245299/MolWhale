import { useTokens } from "../theme";
import { modelIconUrl, providerIconUrl, providerInitial } from "./icons";

/**
 * Brand artwork with a lettered fallback.
 *
 * The fallback matters as much as the logo: it keeps the list visually regular,
 * so a provider or model we have no SVG for still occupies the same square in
 * the same place rather than leaving a ragged gap in the column.
 */
function Tile({ url, fallback, size }: { url: string | null; fallback: string; size: number }) {
  const tokens = useTokens();
  const corner = Math.round(size * 0.28);

  if (url) {
    return (
      <div
        style={{
          width: size,
          height: size,
          flex: "0 0 auto",
          borderRadius: corner,
          background: tokens.cardSurface,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <img alt="" src={url} width={size} height={size} style={{ objectFit: "contain" }} />
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: corner,
        background: tokens.accentMuted,
        color: tokens.accent,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.46),
        fontWeight: 700,
      }}
    >
      {fallback}
    </div>
  );
}

export function BrandIcon({
  name,
  kind,
  size = 26,
}: {
  name: string;
  kind: string;
  size?: number;
}) {
  return <Tile url={providerIconUrl(name, kind)} fallback={providerInitial(name)} size={size} />;
}

export function ModelIcon({ id, name, size = 24 }: { id: string; name?: string; size?: number }) {
  return (
    <Tile
      url={modelIconUrl(id, name ?? "")}
      // Model ids are often `vendor/model`, where the leading segment is the
      // brand — a better letter than the slug's first character.
      fallback={providerInitial(id.includes("/") ? id.split("/")[0] : id)}
      size={size}
    />
  );
}
