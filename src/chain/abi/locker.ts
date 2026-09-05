export const PONS_V2_LAUNCH_LOCKER_ADDRESS =
  "0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952" as const;

// Fetched live from Blockscout's verified-contract ABI.
export const ponsV2LaunchLockerAbi = [
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "isLocked",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "lockedPositions",
    outputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "lockedTokenSupply",
    outputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
