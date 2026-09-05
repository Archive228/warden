// Curves are deployed per-launch, so there's no fixed address to fetch a
// verified ABI from ahead of time. These signatures come from reading
// PonsV2BondingCurve.sol directly (777 lines, fetched in full), not from
// docs prose. `currentSnipeTaxBps` / `exemptFromSnipeTax` are deliberately
// NOT included here even though PonsV2LaunchFactory.sol calls them at
// launch time — a full read of the curve source turned up zero mentions of
// "snipe" anywhere in it, so that call would fail against the real
// contract. See README "Known gaps."
export const ponsV2CurveAbi = [
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
