import { expect } from "chai";
import { ethers } from "hardhat";
import { utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { takeSnapshot, revertToSnapshot } from "./helpers/snapshot";
import { signForwardRequest } from "./helpers/sign";
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
    token1 = await new Token__factory(admin).deploy(hub.address);
    token2 = await new Token__factory(admin).deploy(hub.address);

    // distribute tokens to users
    const amount = utils.parseEther("100000");
    await token1.connect(admin).transfer(alice.address, amount);
    await token1.connect(admin).transfer(bob.address, amount);
    await token2.connect(admin).transfer(alice.address, amount);
    await token2.connect(admin).transfer(bob.address, amount);
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
    const transferAmount = utils.parseEther("100");

    before(async function () {
      req1 = {
        from: alice.address,
        to: token1.address,
        value: 0,
        gas: 1000000,
        nonce: 0,
        data: token1.interface.encodeFunctionData("transfer", [
          bob.address,
          transferAmount,
        ]),
      };
      req2 = {
        from: bob.address,
        to: token2.address,
        value: 0,
        gas: 1000000,
        nonce: 0,
        data: token2.interface.encodeFunctionData("transfer", [
          alice.address,
          transferAmount,
        ]),
      };
      signature1 = await signForwardRequest(alice, hub.address, req1);
      signature2 = await signForwardRequest(bob, hub.address, req2);
    });

    it("should fail when length is different", async function () {
      await expect(
        hub.execute([req1, req2], [signature1])
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
      const balance = await token1.balanceOf(alice.address);
      const req: RelayHub.ForwardRequestStruct = {
        ...req1,
        data: token1.interface.encodeFunctionData("transfer", [
          bob.address,
          balance.add(1),
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

      const aliceBeforeBalance1 = await token1.balanceOf(alice.address);
      const aliceBeforeBalance2 = await token2.balanceOf(alice.address);
      const bobBeforeBalance1 = await token1.balanceOf(bob.address);
      const bobBeforeBalance2 = await token2.balanceOf(bob.address);

      const res = await hub
        .connect(admin)
        .callStatic.execute([req1, req2], [signature1, signature2]);
      await hub.connect(admin).execute([req1, req2], [signature1, signature2]);

      expect(res.successes.length).to.be.eq(2);
      expect(res.results.length).to.be.eq(2);

      expect(res.successes[0]).to.be.true;
      expect(res.successes[1]).to.be.true;

      const result1 = utils.defaultAbiCoder.decode(["bool"], res.results[0]);
      expect(result1[0]).to.be.true;
      const result2 = utils.defaultAbiCoder.decode(["bool"], res.results[1]);
      expect(result2[0]).to.be.true;

      expect(await token1.balanceOf(alice.address)).to.be.eq(
        aliceBeforeBalance1.sub(transferAmount)
      );
      expect(await token1.balanceOf(bob.address)).to.be.eq(
        bobBeforeBalance1.add(transferAmount)
      );
      expect(await token2.balanceOf(alice.address)).to.be.eq(
        aliceBeforeBalance2.add(transferAmount)
      );
      expect(await token2.balanceOf(bob.address)).to.be.eq(
        bobBeforeBalance2.sub(transferAmount)
      );

      expect(await hub.getNonce(alice.address)).to.be.eq(1);
      expect(await hub.getNonce(bob.address)).to.be.eq(1);
    });
  });
});
