export const Permit = [
  {
    name: "owner",
    type: "address",
  },
  {
    name: "spender",
    type: "address",
  },
  {
    name: "value",
    type: "uint256",
  },
  {
    name: "nonce",
    type: "uint256",
  },
  {
    name: "deadline",
    type: "uint256",
  },
];

export const ForwardRequest = [
  {
    name: "from",
    type: "address",
  },
  {
    name: "to",
    type: "address",
  },
  {
    name: "value",
    type: "uint256",
  },
  {
    name: "gas",
    type: "uint256",
  },
  {
    name: "nonce",
    type: "uint256",
  },
  {
    name: "data",
    type: "bytes",
  },
];
