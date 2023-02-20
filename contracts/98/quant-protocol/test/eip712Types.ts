export const domainType = [
  {
    name: "name",
    type: "string",
  },
  {
    name: "version",
    type: "string",
  },
  {
    name: "chainId",
    type: "uint256",
  },
  {
    name: "verifyingContract",
    type: "address",
  },
];

export const metaActionType = [
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" },
  { name: "from", type: "address" },
  { name: "actions", type: "ActionArgs[]" },
];

export const actionType = [
  { name: "actionType", type: "uint8" },
  { name: "qToken", type: "address" },
  { name: "secondaryAddress", type: "address" },
  { name: "receiver", type: "address" },
  { name: "amount", type: "uint256" },
  { name: "collateralTokenId", type: "uint256" },
  { name: "data", type: "bytes" },
];

export const metaApprovalType = [
  { name: "owner", type: "address" },
  { name: "operator", type: "address" },
  { name: "approved", type: "bool" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" },
];

export const metaReferralActionType = [
  { name: "user", type: "address" },
  { name: "action", type: "uint256" },
  { name: "actionData", type: "bytes" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" },
];
