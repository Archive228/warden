// four.meme on BNB Smart Chain. Addresses and signatures below were
// independently re-verified live in this project (eth_call/eth_getCode),
// not taken on trust from the community doc that first named them - no
// official four.meme contracts repo exists to cross-check against the way
// Pons's own GitHub repo could be. See claude-progress.txt for the full
// verification trail, including a wrong "textbook EIP-1967 slot" guess
// that live storage reads corrected.

export const FOUR_MEME_TOKEN_MANAGER_V2 =
  "0x5c952063c7fc8610FFDB798152D69F0B9550762b" as const;

export const FOUR_MEME_HELPER_V3 =
  "0xF251F83e40a78868FcfA3FA4599Dad6494E46034" as const;

export const PANCAKESWAP_V2_FACTORY =
  "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73" as const;

// Verified live (not assumed from memory, same discipline as everything
// else here): calling name()/symbol() on this address returns "Wrapped
// BNB"/"WBNB". Needed because a native-BNB-paired token's real PancakeSwap
// pair is against WBNB, not a literal zero address.
export const WBNB_ADDRESS =
  "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as const;

export const fourMemeHelperAbi = [
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "getTokenInfo",
    outputs: [
      { internalType: "uint256", name: "version", type: "uint256" },
      { internalType: "address", name: "tokenManager", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
      { internalType: "uint256", name: "lastPrice", type: "uint256" },
      { internalType: "uint256", name: "tradingFeeRate", type: "uint256" },
      { internalType: "uint256", name: "minTradingFee", type: "uint256" },
      { internalType: "uint256", name: "launchTime", type: "uint256" },
      { internalType: "uint256", name: "offers", type: "uint256" },
      { internalType: "uint256", name: "maxOffers", type: "uint256" },
      { internalType: "uint256", name: "funds", type: "uint256" },
      { internalType: "uint256", name: "maxFunds", type: "uint256" },
      { internalType: "bool", name: "liquidityAdded", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const fourMemeTokenManagerAbi = [
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "funds", type: "uint256" },
      { internalType: "uint256", name: "minAmount", type: "uint256" },
    ],
    name: "buyTokenAMAP",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

export const ownableAbi = [
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const pancakeV2FactoryAbi = [
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
    ],
    name: "getPair",
    outputs: [{ internalType: "address", name: "pair", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
