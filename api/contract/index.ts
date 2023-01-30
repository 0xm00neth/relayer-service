import { BigNumber, utils, providers, Contract, Wallet } from "ethers";
import dotenv from "dotenv";
import { MetaTxRequest, ForwardRequest, ExecuteResponse } from "../types/index";
import abi from "./abi.json";

dotenv.config();

const getProvider = (): providers.Provider => {
  return new providers.JsonRpcProvider(
    process.env.RPC_URL || "http://127.0.0.1:8545/",
    +(process.env.CHAIN_ID || 1)
  );
};

export const verifyRequest = async (
  req: ForwardRequest,
  signature: string
): Promise<boolean> => {
  const provider = getProvider();
  const hub = new Contract(process.env.RELAY_HUB_ADDRESS || "", abi, provider);
  return await hub.verify(req, signature);
};

export const execute = async (
  requests: MetaTxRequest[]
): Promise<ExecuteResponse | undefined> => {
  const provider = getProvider();
  const signer = new Wallet(process.env.RELAYER_PRIV_KEY || "", provider);
  const hub = new Contract(process.env.RELAY_HUB_ADDRESS || "", abi, signer);
  try {
    const reqs = requests.map((req) => req.request);
    const signatures = requests.map((req) => req.signature);
    const res = await hub.callStatic.execute(reqs, signatures);
    await hub.execute(reqs, signatures);
    return {
      successes: res.successes,
      results: res.results,
    };
  } catch (err) {
    console.log("Execute Failed!", err);
    return;
  }
};
