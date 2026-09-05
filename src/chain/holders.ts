import type { Address } from "viem";

const BLOCKSCOUT_API = "https://robinhoodchain.blockscout.com/api/v2";
// Plain curl with no User-Agent gets an unparseable response from this
// host's Cloudflare front door; any normal browser UA passes.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export interface HolderConcentration {
  sampledHolders: number;
  // Top holder's balance divided by the token's real totalSupply — not by
  // the sum of the fetched page. An earlier version used the page sum as
  // the denominator, which systematically overstated concentration (an
  // audit measured ~3 percentage points high on a real token) since it's
  // missing every balance outside the first page. Blockscout still only
  // gives us one page of *individual* balances, so `topHolderShare` itself
  // is exact, but `sampledHolders` under totalSupply's true holder count
  // whenever there's a next page.
  topHolderShare: number | null;
  hasMoreHolders: boolean;
}

export async function fetchHolderConcentration(
  token: Address,
  totalSupply: bigint,
): Promise<HolderConcentration | null> {
  let res: Response;
  try {
    res = await fetch(`${BLOCKSCOUT_API}/tokens/${token}/holders`, {
      headers: { "User-Agent": BROWSER_UA, "Accept": "application/json" },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let body: { items?: Array<{ value: string }>; next_page_params?: unknown };
  try {
    body = await res.json();
  } catch {
    return null;
  }

  const items = body.items ?? [];
  if (items.length === 0) {
    return { sampledHolders: 0, topHolderShare: null, hasMoreHolders: false };
  }

  const top = BigInt(items[0].value);
  const topHolderShare = totalSupply > 0n
    ? Number((top * 10000n) / totalSupply) / 10000
    : null;

  return {
    sampledHolders: items.length,
    topHolderShare,
    hasMoreHolders: body.next_page_params != null,
  };
}
