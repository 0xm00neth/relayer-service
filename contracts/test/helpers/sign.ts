import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { RelayHub } from "../../typechain";

export const signForwardRequest = async (
  signer: SignerWithAddress,
  verifier: string,
  request: RelayHub.ForwardRequestStruct
): Promise<string> => {
  // const chainId = BigNumber.from(await signer.getChainId());
  const chainId = 31337;
  const domain = {
    name: "RelayHub",
    version: "1",
    chainId,
    verifyingContract: verifier,
  };
  const types = {
    ForwardRequest: [
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
    ],
  };
  return await signer._signTypedData(domain, types, request);
};

export const signPermit = async (
  signer: SignerWithAddress,
  name: string,
  verifier: string,
  spender: string,
  value: BigNumber,
  nonce: number,
  deadline: number
): Promise<string> => {
  // const chainId = BigNumber.from(await signer.getChainId());
  const chainId = 31337;
  const domain = {
    name,
    version: "1",
    chainId,
    verifyingContract: verifier,
  };
  const types = {
    Permit: [
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
    ],
  };
  return await signer._signTypedData(domain, types, {
    owner: signer.address,
    spender,
    value,
    nonce,
    deadline,
  });
};
