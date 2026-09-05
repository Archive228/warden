// One line per decision, whether or not a trade was actually attempted -
// "we looked at this and chose not to buy" is exactly as important an
// audit record as "we bought this," and a log that only records
// executions can't be used to answer "why didn't it buy X."
export interface TradeDecision {
  token: string;
  timestamp: string;
  verdictCategory: string;
  verdictConfidence: number;
  liveMode: boolean;
  attempted: boolean;
  reason: string;
  txHash?: `0x${string}`;
  quoteInWei?: string;
  minTokensOut?: string;
}

export async function logTradeDecision(entry: TradeDecision): Promise<void> {
  await Deno.mkdir("verdicts", { recursive: true });
  await Deno.writeTextFile(
    "verdicts/trades.jsonl",
    JSON.stringify(entry) + "\n",
    { append: true },
  );
}
