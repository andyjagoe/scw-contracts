import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { _HASHED_NAME } from "../../../src/utils/1271";

describe("Denim 1271", function () {
  async function deployWalletFixture() {
    const [owner] = await ethers.getSigners();

    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPoint.deploy();

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

    const receipt2 = await denimAccountFactory
      .createAccount(owner.address, "0xaB")
      .then((tx: any) => tx.wait());

    const denimAccountAddress2 = receipt2.events.find(
      ({ event }: { event: string }) => event === "DenimAccountCreated"
    ).args[0];

    const denimAccountContract2 = await ethers.getContractAt(
      "DenimAccount",
      denimAccountAddress2
    );

    return {
      denimAccountFactory,
      owner,
      entryPoint,
      denimAccountContract,
      denimAccountContract2,
    };
  }

  describe("isValidSignature", function () {
    it("should validate for correct nonces and denim account addresses", async () => {
      const { owner, denimAccountContract } = await loadFixture(
        deployWalletFixture
      );

      const data = ethers.utils.randomBytes(32);
      const nonce = await denimAccountContract.getNonce();
      const domainSeparator = await denimAccountContract.DOMAIN_SEPARATOR();

      const context = ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["bytes32", "uint256", "bytes32"],
          [domainSeparator, nonce, data]
        )
      );

      const signature = await owner.signMessage(context);
      const isValid = await denimAccountContract.isValidSignature(
        data,
        signature
      );

      expect(isValid).to.equal("0x1626ba7e");
    });
    it("should not validate for incorrect nonces", async () => {
      const { owner, denimAccountContract } = await loadFixture(
        deployWalletFixture
      );

      const data = ethers.utils.randomBytes(32);
      const nonce = (await denimAccountContract.getNonce()).add(1);

      // Sign the data with the owner's private key
      const message = ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["bytes32", "uint256", "bytes32"],
          [await denimAccountContract.DOMAIN_SEPARATOR(), nonce, data]
        )
      );
      const signature = await owner.signMessage(message);

      // Call isValidSignature on the DenimAccount contract
      const result = await denimAccountContract.isValidSignature(
        data,
        signature
      );

      // Check if the result is INVALID_SIG (0x00000000)
      expect(result).to.equal("0x00000000");
    });

    it("should not validate for incorrect denim account addresses", async function () {
      const { owner, denimAccountContract, denimAccountContract2 } =
        await loadFixture(deployWalletFixture);

      const data = ethers.utils.randomBytes(32);
      const nonce = (await denimAccountContract.getNonce()).add(1);

      // Sign the data with the owner's private key
      const message = ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["bytes32", "uint256", "bytes32"],
          [await denimAccountContract.DOMAIN_SEPARATOR(), nonce, data]
        )
      );
      const signature = await owner.signMessage(message);

      // Call isValidSignature on the DenimAccount contract
      const result = await denimAccountContract2.isValidSignature(
        data,
        signature
      );

      // Check if the result is INVALID_SIG (0x00000000)
      expect(result).to.equal("0x00000000");
    });
  });
});