import { ethers } from "hardhat";

async function main() {
  const RelayHub = await ethers.getContractFactory("RelayHub");
  const hub = await RelayHub.deploy();
  await hub.deployed();

  console.log(`RelayHub deployed to ${hub.address}`);

  const Token = await ethers.getContractFactory("Token");
  const token1 = await Token.deploy("TestToken1", "TT1");
  await token1.deployed();

  console.log(`Token #1 deployed to ${token1.address}`);

  const token2 = await Token.deploy("TestToken2", "TT2");
  await token2.deployed();

  console.log(`Token #2 deployed to ${token2.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
