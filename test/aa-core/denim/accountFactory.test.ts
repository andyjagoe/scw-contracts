import { expect } from "chai";
import { ethers } from "hardhat";
import { id } from "ethers/lib/utils";


describe("DenimAccountFactory", function () {
  async function deployDenimAccountFactoryFixture() {
    const [owner] = await ethers.getSigners();

    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPoint.deploy();

    const DenimAccountFactory = await ethers.getContractFactory(
      "DenimAccountFactory"
    );
    const denimAccountFactory = await DenimAccountFactory.deploy(
      entryPoint.address
    );

    return {
      owner,
      entryPoint,
      denimAccountFactory,
    };
  }

  describe("createAccount", function () {
    it("Should deploy Denim Wallet instance with the correct owner and entrypoint", async function () {
      const { owner, denimAccountFactory, entryPoint } =
        await deployDenimAccountFactoryFixture();
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

      expect(await denimAccountContract.owner()).to.eq(owner.address);

      expect(await denimAccountContract.entryPoint()).to.eq(entryPoint.address);

      expect(
        await denimAccountFactory.callStatic.createAccount(owner.address, "0xa")
      ).to.eq(denimAccountAddress);
    });
    it("getAddress() should predict correct address", async function () {
      const { owner, denimAccountFactory } =
        await await deployDenimAccountFactoryFixture();

      const accountType = "google"
      const userId = "first.last@gmail.com"

      const predictedAddress = await denimAccountFactory.getAddress(
        owner.address,
        ethers.BigNumber.from(id(`${accountType}:${userId}`))
      );

      const receipt = await denimAccountFactory
        .createAccount(
          owner.address, 
          ethers.BigNumber.from(id(`${accountType}:${userId}`))
          )
        .then((tx: any) => tx.wait());

      const denimAccountAddress = receipt.events.find(
        ({ event }: { event: string }) => event === "DenimAccountCreated"
      ).args[0];

      expect(predictedAddress).to.eq(denimAccountAddress);
    });
  });
});