import { BigNumber, utils } from "ethers";
import express, { Express, Request, Response } from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import { ForwardRequest, MetaTxRequest } from "./types";
import { verifyRequest, execute } from "./contract";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 8000;
const timeout = +(process.env.TIMEOUT || 60 * 1000);

// store meta transaction requests
let pendingRequests: MetaTxRequest[] = [];

const processRequests = async () => {
  const count = pendingRequests.length;
  if (count === 0) {
    return;
  }

  console.log(`Processing ${count} pending requests`);

  const requests = [...pendingRequests];
  pendingRequests = [];

  const res = await execute(requests);
  if (res) {
    for (let i = 0; i < requests.length; ++i) {
      console.log(`Request #${i + 1}`);
      console.log(`Status: ${res.successes[i] ? "Success" : "Fail"}`);
      console.log(`Return Data: ${res.results[i]}`);
    }
  }
};

app.use(bodyParser.json());

app.use(cors());

app.post("/submit", async (req: Request, res: Response) => {
  let { tx, signature } = req.body;

  if (!tx || !signature || !utils.isHexString(signature)) {
    return res.status(400).send({ success: false, message: "Invalid Request" });
  }

  if (!tx.from || !utils.isAddress(tx.from)) {
    return res.status(400).send({ success: false, message: "Invalid Request" });
  }
  if (!tx.to || !utils.isAddress(tx.to)) {
    return res.status(400).send({ success: false, message: "Invalid Request" });
  }
  let value: BigNumber;
  let gas: BigNumber;
  let nonce: BigNumber;
  try {
    value = BigNumber.from(tx.value);
    gas = BigNumber.from(tx.gas);
    nonce = BigNumber.from(tx.nonce);
  } catch (err) {
    return res.status(400).send({ success: false, message: "Invalid Request" });
  }
  if (!tx.data || !utils.isHexString(tx.data)) {
    return res.status(400).send({ success: false, message: "Invalid Request" });
  }

  const request: ForwardRequest = {
    from: tx.from,
    to: tx.to,
    value,
    gas,
    nonce,
    data: tx.data,
  };

  const valid = await verifyRequest(request, signature);
  if (!valid) {
    return res
      .status(400)
      .send({ success: false, message: "Invalid Signature" });
  }

  pendingRequests.push({ request, signature });

  res.status(200).send();
});

// start backend
app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);

  setInterval(processRequests, timeout);
});
