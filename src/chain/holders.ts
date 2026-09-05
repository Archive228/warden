import type { Address } from "viem";

const BLOCKSCOUT_API = "https://robinhoodchain.blockscout.com/api/v2";
// Plain curl with no User-Agent gets an unparseable response from this
// host's Cloudflare front door; any normal browser UA passes.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export interface HolderConcentration {
  sampledHolders: number;
  topHolderShare: number | null;
}

export async function fetchHolderConcentration(
  token: Address,
): Promise<HolderConcentration | null> {
  const res = await fetch(`${BLOCKSCOUT_API}/tokens/${token}/holders`, {
    headers: { "User-Agent": BROWSER_UA, "Accept": "application/json" },
  });
  if (!res.ok) return null;

  const body = await res.json();
  const items: Array<{ value: string }> = body.items ?? [];
  if (items.length === 0) return { sampledHolders: 0, topHolderShare: null };

  const balances = items.map((i) => BigInt(i.value));
  const total = balances.reduce((a, b) => a + b, 0n);
  const top = balances[0];
  const topHolderShare = total > 0n
    ? Number((top * 10000n) / total) / 10000
    : null;

  // Blockscout paginates holders; this is a share of the *fetched page*,
  // not necessarily the true top holder across all holders. Good enough as
  // a first-pass signal, not a verified exact figure — see README.
  return { sampledHolders: items.length, topHolderShare };
}
