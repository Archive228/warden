// Curves are deployed per-launch, so there's no fixed address to fetch a
// verified ABI from ahead of time. Most of these signatures come from
// reading PonsV2BondingCurve.sol directly (777 lines, fetched in full).
//
// `currentSnipeTaxBps` is the one entry NOT in that source file — an
// earlier version of this project trusted that absence and skipped it
// entirely. An independent audit didn't trust the source repo either way
// and instead did raw eth_call probes with real selectors against 3 live
// curves: `currentSnipeTaxBps(address)` resolves cleanly (returns 0 on all
// 3, cause unconfirmed — could be fully decayed by the time they were
// checked), and `exemptFromSnipeTax(address)` reverts with a real
// `NotFactory()` custom error rather than an unknown-selector revert,
// meaning both functions exist in the deployed bytecode even though
// they're absent from ponsdotdev/ponsfamily's current HEAD (deployed code
// newer than the public repo, most likely). Included here on that basis,
// called defensively (see fetchSnipeTaxBps in pons.ts) since the
// discrepancy itself is unexplained.
export const ponsV2CurveAbi = [
  {
    inputs: [{ internalType: "address", name: "recipient", type: "address" }],
    name: "currentSnipeTaxBps",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getReserves",
    outputs: [
      { internalType: "uint256", name: "quoteReserve", type: "uint256" },
      { internalType: "uint256", name: "tokenReserve", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "realQuoteReserve",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "graduationThreshold",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "sellableTokens",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "reservedTokens",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "readyToGraduate",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "graduated",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "creatorTaxBps",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "feeBps",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "buyer",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteIn",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "tokensOut",
        type: "uint256",
      },
      { indexed: false, internalType: "uint256", name: "fee", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "tax", type: "uint256" },
    ],
    name: "CurveBuy",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "seller",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "tokensIn",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "quoteOut",
        type: "uint256",
      },
      { indexed: false, internalType: "uint256", name: "fee", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "tax", type: "uint256" },
    ],
    name: "CurveSell",
    type: "event",
  },
] as const;
