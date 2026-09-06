import { assertEquals } from "@std/assert";
import { vetRepo } from "./fingerprint.ts";

// Unauthenticated GitHub API requests hit a much lower rate limit and can
// 403 outright on some endpoints (reproduced live: /users/ponsdotdev 403'd
// with no token, worked fine with one) — skip rather than fail confusingly
// when no token is configured.
const hasToken = Boolean(Deno.env.get("GITHUB_TOKEN"));

Deno.test({
  name: "vetRepo does not flag a legitimate protocol repo as ticker-shilling",
  ignore: !hasToken,
  fn: async () => {
    // ponsdotdev/ponsfamily is the real, official Pons contracts repo — its
    // README legitimately documents several contract addresses, which is
    // exactly the case contractAddressMentions is too weak a signal to
    // flag alone. It has no $TICKER anywhere.
    const fp = await vetRepo("ponsdotdev", "ponsfamily");

    assertEquals(fp.tickerMentions.length, 0);
    assertEquals(fp.contractAddressMentions.length > 0, true);
  },
});
