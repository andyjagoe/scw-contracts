import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Denim EntryPoint", function () {
  async function deployWalletFixture() {
    const [owner, other] = await ethers.getSigners();

    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPoint.deploy();

    const entryPoint2 = await EntryPoint.deploy();

    expect(entryPoint.address).to.not.equal(entryPoint2.address);

    const DenimAccountFactory = await ethers.getContractFactory(
      "DenimAccountFactory"
    );
    const denimAccountFactory = await DenimAccountFactory.deploy(
      entryPoint.address
    );

    const receipt = await denimAccountFactory
      .createAccount(owner.address, "0xa")
      .then((tx: any) => tx.wait());

    const denimAccountAddress = receipt.events.find(
      ({ event }: { event: string }) => event === "DenimAccountCreated"
    ).args[0];

    const denimAccountContract = await ethers.getContractAt(
      "DenimAccount",
      denimAccountAddress
    );

    return {
      denimAccountFactory,
      owner,
      other,
      entryPoint,
      entryPoint2,
      denimAccountContract,
    };
  }

  describe("changeEntryPoint", function () {
    it("should change the entry point if called by owner", async function () {
      const { entryPoint2, denimAccountContract } = await loadFixture(
        deployWalletFixture
      );

      await denimAccountContract.changeEntryPoint(entryPoint2.address);

      expect(await denimAccountContract.entryPoint()).to.equal(
        entryPoint2.address
      );
    });
    it("should not change the entry point if not called by owner", async function () {
      const { entryPoint2, denimAccountContract, other } = await loadFixture(
        deployWalletFixture
      );

      expect(
        denimAccountContract.connect(other).changeEntryPoint(entryPoint2.address)
      ).to.be.revertedWith("account: not Owner or EntryPoint");
    });
  });
});