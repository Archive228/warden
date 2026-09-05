export const PONS_V2_FACTORY_ADDRESS =
  "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as const;

// Fetched live from Blockscout's verified-contract ABI (is_verified: true), not
// transcribed from docs prose.
export const ponsV2FactoryAbi = [
  {
    inputs: [{ internalType: "address", name: "launcher", type: "address" }],
    name: "canLaunch",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "getLaunchedToken",
    outputs: [
      {
        components: [
          { internalType: "address", name: "token", type: "address" },
          { internalType: "address", name: "curve", type: "address" },
          { internalType: "address", name: "deployer", type: "address" },
          {
            internalType: "address",
            name: "creatorFeeRecipient",
            type: "address",
          },
          { internalType: "address", name: "pairToken", type: "address" },
          {
            internalType: "uint256",
            name: "graduationThreshold",
            type: "uint256",
          },
          { internalType: "uint24", name: "poolFee", type: "uint24" },
          { internalType: "int24", name: "tickSpacing", type: "int24" },
          { internalType: "uint16", name: "creatorTaxBps", type: "uint16" },
          { internalType: "bool", name: "buybackEnabled", type: "bool" },
          {
            internalType: "enum GraduationPhase",
            name: "phase",
            type: "uint8",
          },
          { internalType: "uint256", name: "sweptQuote", type: "uint256" },
          { internalType: "uint256", name: "sweptTokens", type: "uint256" },
          { internalType: "uint256", name: "sweptAt", type: "uint256" },
          { internalType: "bool", name: "exists", type: "bool" },
        ],
        internalType: "struct IPonsV2LaunchFactory.LaunchedToken",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "curve",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "deployer",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "pairToken",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "launchConfigId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "graduationThreshold",
        type: "uint256",
      },
    ],
    name: "TokenLaunched",
    type: "event",
  },
] as const;
