import { expect } from "chai";
import { ethers } from "hardhat";
import { utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { takeSnapshot, revertToSnapshot } from "./helpers/snapshot";
import { signForwardRequest, signPermit } from "./helpers/sign";
import {
  RelayHub,
  RelayHub__factory,
  Token,
  Token__factory,
} from "../typechain";

const INVALID_SIGNATURE1 = "0x0000";
const INVALID_SIGNATURE2 =
  "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

describe("RelayHub", function () {
  let hub: RelayHub;
  let token1: Token;
  let token2: Token;
  let admin: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress;
  let snapshotId: number;

  before(async function () {
    [admin, alice, bob] = await ethers.getSigners();

    // deploy RelayHub
    hub = await new RelayHub__factory(admin).deploy();

    // deploy test tokens
    token1 = await new Token__factory(admin).deploy("TestToken1", "TT1");
    token2 = await new Token__factory(admin).deploy("TestToken2", "TT2");
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Veify", function () {
    let req: RelayHub.ForwardRequestStruct;

    before(function () {
      req = {
        from: alice.address,
        to: bob.address,
        value: utils.parseEther("1"),
        gas: 1000000,
        nonce: 0,
        data: "0x",
      };
    });

    it("should return false when siganture is invalid #1", async function () {
      const valid = await hub.verify(req, INVALID_SIGNATURE1);
      expect(valid).to.be.false;
    });

    it("should return false when siganture is invalid #2", async function () {
      const valid = await hub.verify(req, INVALID_SIGNATURE2);
      expect(valid).to.be.false;
    });

    it("should return false when siganture is invalid #3", async function () {
      const signature = await signForwardRequest(bob, hub.address, req);
      const valid = await hub.verify(req, signature);
      expect(valid).to.be.false;
    });

    it("should return true when siganture is valid", async function () {
      const signature = await signForwardRequest(alice, hub.address, req);
      const valid = await hub.verify(req, signature);
      expect(valid).to.be.true;
    });
  });

  describe("Execute", function () {
    let req1: RelayHub.ForwardRequestStruct;
    let req2: RelayHub.ForwardRequestStruct;
    let signature1: string;
    let signature2: string;
    const approveAmount = utils.parseEther("100");

    before(async function () {
      const deadline = Math.floor(Date.now() / 1000) + 1000;
      const approveSign1 = utils.splitSignature(
        await signPermit(
          alice,
          "TestToken1",
          token1.address,
          bob.address,
          approveAmount,
          0,
          deadline
        )
      );
      const approveSign2 = utils.splitSignature(
        await signPermit(
          bob,
          "TestToken2",
          token2.address,
          alice.address,
          approveAmount,
          0,
          deadline
        )
      );
      req1 = {
        from: alice.address,
        to: token1.address,
        value: 0,
        gas: 1000000,
        nonce: 0,
        data: token1.interface.encodeFunctionData("permit", [
          alice.address,
          bob.address,
          approveAmount,
          deadline,
          approveSign1.v,
          approveSign1.r,
          approveSign1.s,
        ]),
      };
      req2 = {
        from: bob.address,
        to: token2.address,
        value: 0,
        gas: 1000000,
        nonce: 0,
        data: token2.interface.encodeFunctionData("permit", [
          bob.address,
          alice.address,
          approveAmount,
          deadline,
          approveSign2.v,
          approveSign2.r,
          approveSign2.s,
        ]),
      };
      signature1 = await signForwardRequest(alice, hub.address, req1);
      signature2 = await signForwardRequest(bob, hub.address, req2);
    });

    it("only owner can call execute", async function () {
      await expect(
        hub.connect(alice).execute([req1, req2], [signature1])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should fail when length is different", async function () {
      await expect(
        hub.connect(admin).execute([req1, req2], [signature1])
      ).to.be.revertedWithoutReason();
    });

    it("when signatures is invalid #1", async function () {
      const res = await hub
        .connect(admin)
        .callStatic.execute([req1], [INVALID_SIGNATURE1]);

      expect(res.successes.length).to.be.eq(1);
      expect(res.results.length).to.be.eq(1);

      expect(res.successes[0]).to.be.false;
      expect(res.results[0]).to.be.eq("0x");
    });

    it("when signatures is invalid #2", async function () {
      const res = await hub
        .connect(admin)
        .callStatic.execute([req1], [INVALID_SIGNATURE2]);

      expect(res.successes.length).to.be.eq(1);
      expect(res.results.length).to.be.eq(1);

      expect(res.successes[0]).to.be.false;
      expect(res.results[0]).to.be.eq("0x");
    });

    it("when signatures is invalid #3", async function () {
      const res = await hub
        .connect(admin)
        .callStatic.execute([req1], [signature2]);

      expect(res.successes.length).to.be.eq(1);
      expect(res.results.length).to.be.eq(1);

      expect(res.successes[0]).to.be.false;
      expect(res.results[0]).to.be.eq("0x");
    });

    it("when request fails", async function () {
      const req: RelayHub.ForwardRequestStruct = {
        ...req1,
        data: token1.interface.encodeFunctionData("transfer", [
          bob.address,
          1000,
        ]),
      };
      const signature = await signForwardRequest(alice, hub.address, req);

      const res = await hub
        .connect(admin)
        .callStatic.execute([req], [signature]);

      expect(res.successes.length).to.be.eq(1);
      expect(res.results.length).to.be.eq(1);

      expect(res.successes[0]).to.be.false;
      expect(res.results[0]).not.to.be.eq("0x");
    });

    it("when request success", async function () {
      expect(await hub.getNonce(alice.address)).to.be.eq(0);
      expect(await hub.getNonce(bob.address)).to.be.eq(0);

      expect(await token1.allowance(alice.address, bob.address)).to.be.eq(0);
      expect(await token2.allowance(bob.address, alice.address)).to.be.eq(0);

      const res = await hub
        .connect(admin)
        .callStatic.execute([req1, req2], [signature1, signature2]);
      await hub.connect(admin).execute([req1, req2], [signature1, signature2]);

      expect(res.successes.length).to.be.eq(2);
      expect(res.results.length).to.be.eq(2);

      expect(res.successes[0]).to.be.true;
      expect(res.successes[1]).to.be.true;

      expect(res.results[0]).to.be.eq("0x");
      expect(res.results[1]).to.be.eq("0x");

      expect(await hub.getNonce(alice.address)).to.be.eq(1);
      expect(await hub.getNonce(bob.address)).to.be.eq(1);

      expect(await token1.allowance(alice.address, bob.address)).to.be.eq(
        approveAmount
      );
      expect(await token2.allowance(bob.address, alice.address)).to.be.eq(
        approveAmount
      );
      expect(await token1.nonces(alice.address)).to.be.eq(1);
      expect(await token2.nonces(bob.address)).to.be.eq(1);
    });
  });
});
