import { useEffect, useState } from "react";
import { utils, providers, Contract } from "ethers";
import { useMetaMask } from "metamask-react";
import "./App.css";
import tokenAbi from "./abi/erc20.json";
import relayHubAbi from "./abi/relayHub.json";
import { Permit, ForwardRequest } from "./types";

function App() {
  const [tokenAddress, setTokenAddress] = useState("");
  const [spender, setSpender] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { status, connect, addChain, account, chainId, ethereum } =
    useMetaMask();

  useEffect(() => {
    if (
      Number(chainId) > 0 &&
      Number(chainId) !== Number(process.env.REACT_APP_CHAIN_ID)
    ) {
      addChain({
        chainId: process.env.REACT_APP_CHAIN_ID,
        chainName: "Localhost",
        rpcUrls: [process.env.REACT_APP_RPC_URL],
        nativeCurrency: {
          name: "Ethereum",
          symbol: "ETH",
          decimals: 18,
        },
      });
    }
  }, [chainId]);

  const submit = async () => {
    setIsSubmitting(true);
    try {
      if (!utils.isAddress(tokenAddress)) {
        alert("Invalid Token Address!");
      } else if (!utils.isAddress(spender)) {
        alert("Invalid Spender Address!");
      } else if (!amount || isNaN(amount)) {
        alert("Invalid Amount!");
      } else {
        const approveAmount = utils.parseEther(amount);
        const provider = new providers.Web3Provider(ethereum);
        await provider.ready;

        const token = new Contract(tokenAddress, tokenAbi, provider);

        const name = await token.name();
        let domain = {
          name,
          version: "1",
          chainId: Number(chainId),
          verifyingContract: tokenAddress,
        };
        let types = {
          Permit,
        };
        const deadline = Math.floor(Date.now() / 1000) + 1000;
        let nonce = await token.nonces(account);
        const signer = provider.getSigner(account);
        const permitSig = utils.splitSignature(
          await signer._signTypedData(domain, types, {
            owner: account,
            spender,
            value: approveAmount,
            nonce,
            deadline,
          })
        );

        const hub = new Contract(
          process.env.REACT_APP_RELAY_HUB,
          relayHubAbi,
          provider
        );
        nonce = await hub.getNonce(account);
        const request = {
          from: account,
          to: tokenAddress,
          value: 0,
          gas: 1000000,
          nonce,
          data: token.interface.encodeFunctionData("permit", [
            account,
            spender,
            approveAmount,
            deadline,
            permitSig.v,
            permitSig.r,
            permitSig.s,
          ]),
        };
        domain = {
          name: "RelayHub",
          version: "1",
          chainId: Number(chainId),
          verifyingContract: process.env.REACT_APP_RELAY_HUB,
        };
        types = {
          ForwardRequest,
        };
        const signature = await signer._signTypedData(domain, types, request);

        await fetch(`${process.env.REACT_APP_API_URL}/submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tx: request,
            signature,
          }),
        });

        alert("Tx submitted successfully!");
      }
    } catch (err) {
      console.log("ERR:", err);
    }
    setIsSubmitting(false);
  };

  const checkAllowance = async () => {
    if (!utils.isAddress(tokenAddress)) {
      alert("Invalid Token Address!");
      return;
    }
    if (!utils.isAddress(spender)) {
      alert("Invalid Spender Address!");
      return;
    }

    const provider = new providers.Web3Provider(ethereum);
    await provider.ready;

    const token = new Contract(tokenAddress, tokenAbi, provider);
    const allowance = await token.allowance(account, spender);
    alert(`Current allowance is ${allowance.toString()}`);
  };

  const renderBody = () => {
    if (status === "initializing") return <div>Initializing...</div>;

    if (status === "unavailable") return <div>MetaMask not available :(</div>;

    if (status === "notConnected")
      return <button onClick={connect}>Connect to MetaMask</button>;

    if (status === "connecting") return <div>Connecting...</div>;

    if (status === "connected")
      return (
        <div>
          <div>Connected: {account}</div>
          <div className="input-wrapper">
            <span>Token: </span>
            <input
              type="text"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="input-wrapper">
            <span>Spender: </span>
            <input
              type="text"
              value={spender}
              onChange={(e) => setSpender(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="input-wrapper">
            <span>Amount: </span>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="input-wrapper">
            <button onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Tx"}
            </button>
            <button onClick={checkAllowance}>Check Allowance</button>
          </div>
        </div>
      );
  };

  return <div className="app">{renderBody()}</div>;
}

export default App;
