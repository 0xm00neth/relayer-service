import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import {
  RelayHub,
} from "../../typechain";

const ForwardRequest = [
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

export const signForwardRequest = async (
  signer: SignerWithAddress,
  verifier: string,
  request: RelayHub.ForwardRequestStruct
) => {
  const chainId = BigNumber.from(await signer.getChainId());
  const domain = {
    name: "RelayHub",
    version: "1",
    chainId,
    verifyingContract: verifier,
  };
  return await signer._signTypedData(domain, { ForwardRequest }, request);
};
