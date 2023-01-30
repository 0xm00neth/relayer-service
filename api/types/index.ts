import { BigNumberish, BytesLike } from "ethers";

export type ForwardRequest = {
  from: string;
  to: string;
  value: BigNumberish;
  gas: BigNumberish;
  nonce: BigNumberish;
  data: BytesLike;
};

export type MetaTxRequest = {
  request: ForwardRequest;
  signature: string;
}

export type ExecuteResponse = {
  successes: boolean[];
  results: string[];
}
