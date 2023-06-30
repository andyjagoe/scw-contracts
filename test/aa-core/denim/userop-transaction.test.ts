import {
    EntryPoint,
    DenimAccount,
    DenimAccountFactory,
  } from "../../../typechain";
  import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
  import { expect } from "chai";
  import { ethers } from "hardhat";
  import { parseEther, hexConcat, arrayify } from "ethers/lib/utils";
  import { fillAndSign } from "../UserOp";
  
  let entryPoint: EntryPoint;
  let wallet: DenimAccount;
  let walletFactory: DenimAccountFactory;
  
  describe("Denim Wallet", function () {
    async function deployWalletFixture() {
      const [owner, beneficiary, random] = await ethers.getSigners();
  
      const EntryPoint = await ethers.getContractFactory("EntryPoint");
      const entryPoint = await EntryPoint.deploy();
  
      const DenimVerifyingPaymaster = await ethers.getContractFactory(
        "DenimVerifyingPaymaster"
      );
      const denimVerifyingPaymaster = await DenimVerifyingPaymaster.deploy(
        entryPoint.address,
        owner.address
      );
  
      await entryPoint.depositTo(denimVerifyingPaymaster.address, {
        value: parseEther("2"),
      });
  
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
  
      const TestToken = await ethers.getContractFactory("DenimTestToken");
      const testToken = await TestToken.deploy(
        denimAccountContract.address,
        parseEther("2.0")
      );
  
      const TestToken2 = await ethers.getContractFactory("DenimTestToken");
      const testToken2 = await TestToken2.deploy(
        denimAccountContract.address,
        parseEther("3.0")
      );
  
      expect(await testToken.balanceOf(denimAccountContract.address)).to.eq(
        parseEther("2.0")
      );
  
      expect(await testToken2.balanceOf(denimAccountContract.address)).to.eq(
        parseEther("3.0")
      );
  
      return {
        owner,
        beneficiary,
        random,
        testToken,
        testToken2,
        entryPoint,
        denimVerifyingPaymaster,
        denimAccountContract,
      };
    }
  
    describe("Send tx", function () {
      it("Should correctly execute UserOp from Entrypoint", async function () {
        const {
          owner,
          beneficiary,
          denimVerifyingPaymaster,
          testToken,
          entryPoint,
          denimAccountContract,
        } = await loadFixture(deployWalletFixture);
  
        const { data } = await testToken.populateTransaction.transfer(
          owner.address,
          parseEther("2.0")
        );
  
        const txExec = await denimAccountContract.populateTransaction.execute(
          testToken.address,
          0,
          data!
        );
  
        let op = await fillAndSign(
          {
            sender: denimAccountContract.address,
            nonce: await denimAccountContract.getNonce(),
            callData: txExec.data,
          },
          owner,
          entryPoint
        );
  
        const hash = await denimVerifyingPaymaster.getHash(op);
        const sig = await owner.signMessage(arrayify(hash));
  
        op.paymasterAndData = hexConcat([denimVerifyingPaymaster.address, sig]);
  
        op = await fillAndSign(op, owner, entryPoint);
  
        const denimAccountBalanceBefore = await ethers.provider.getBalance(
          denimAccountContract.address
        );
  
        expect(
          await ethers.provider.getBalance(denimVerifyingPaymaster.address)
        ).to.eq(0);
  
        // this statement is failing
        const tx = await entryPoint.handleOps([op], beneficiary.address);
  
        const denimAccountBalanceAfter = await ethers.provider.getBalance(
          denimAccountContract.address
        );
  
        expect(denimAccountBalanceBefore).to.eq(denimAccountBalanceAfter);
  
        expect(await testToken.balanceOf(denimAccountContract.address)).to.eq(0);
      });
    });

    describe("Send tx multiple ERC20", function () {
      it("Should correctly executeBatch UserOp from Entrypoint", async function () {
        const {
          owner,
          beneficiary,
          denimVerifyingPaymaster,
          testToken,
          testToken2,
          entryPoint,
          denimAccountContract,
        } = await loadFixture(deployWalletFixture);
  
        const { data } = await testToken.populateTransaction.transfer(
          owner.address,
          parseEther("2.0")
        );
  
        const { data: data2 } = await testToken2.populateTransaction.transfer(
          owner.address,
          parseEther("3.0")
        );
  
        const txExec = await denimAccountContract.populateTransaction.executeBatch(
          [testToken.address, testToken2.address],
          [data, data2]
        );
  
        let op = await fillAndSign(
          {
            sender: denimAccountContract.address,
            nonce: await denimAccountContract.getNonce(),
            callData: txExec.data,
          },
          owner,
          entryPoint
        );
  
        const hash = await denimVerifyingPaymaster.getHash(op);
        const sig = await owner.signMessage(arrayify(hash));
  
        op.paymasterAndData = hexConcat([denimVerifyingPaymaster.address, sig]);
  
        op = await fillAndSign(op, owner, entryPoint);
  
        const denimAccountBalanceBefore = await ethers.provider.getBalance(
          denimAccountContract.address
        );
  
        expect(
          await ethers.provider.getBalance(denimVerifyingPaymaster.address)
        ).to.eq(0);
  
        const tx = await entryPoint.handleOps([op], beneficiary.address);
  
        const denimAccountBalanceAfter = await ethers.provider.getBalance(
          denimAccountContract.address
        );
  
        expect(denimAccountBalanceBefore).to.eq(denimAccountBalanceAfter);
  
        expect(await testToken.balanceOf(denimAccountContract.address)).to.eq(0);
        expect(await testToken2.balanceOf(denimAccountContract.address)).to.eq(0);
      });
    });
    describe("Send tx multiple ERC20 and ether", function () {
      it("Should correctly executeBatch UserOp from Entrypoint", async function () {
        const {
          owner,
          beneficiary,
          random,
          denimVerifyingPaymaster,
          testToken,
          testToken2,
          entryPoint,
          denimAccountContract,
        } = await loadFixture(deployWalletFixture);
  
        const { data } = await testToken.populateTransaction.transfer(
          owner.address,
          parseEther("2.0")
        );
  
        const { data: data2 } = await testToken2.populateTransaction.transfer(
          owner.address,
          parseEther("3.0")
        );
  
        //base account now has 3 ether
        await random.sendTransaction({
          to: denimAccountContract.address,
          value: parseEther("3.0"),
        });
  
        expect(
          await ethers.provider.getBalance(denimAccountContract.address)
        ).to.eq(parseEther("3.0"));
  
        const txExec =
          await denimAccountContract.populateTransaction.executeBatchValue(
            [testToken.address, testToken2.address, owner.address],
            [0, 0, parseEther("3.0")],
            [data, data2, "0x"]
          );
  
        let op = await fillAndSign(
          {
            sender: denimAccountContract.address,
            nonce: await denimAccountContract.getNonce(),
            callData: txExec.data,
          },
          owner,
          entryPoint
        );
  
        const hash = await denimVerifyingPaymaster.getHash(op);
        const sig = await owner.signMessage(arrayify(hash));
  
        op.paymasterAndData = hexConcat([denimVerifyingPaymaster.address, sig]);
  
        op = await fillAndSign(op, owner, entryPoint);
  
        expect(
          await ethers.provider.getBalance(denimVerifyingPaymaster.address)
        ).to.eq(0);
  
        const tx = await entryPoint.handleOps([op], beneficiary.address);
  
        expect(await testToken.balanceOf(denimAccountContract.address)).to.eq(0);
        expect(await testToken2.balanceOf(denimAccountContract.address)).to.eq(0);
        expect(
          await ethers.provider.getBalance(denimAccountContract.address)
        ).to.eq(0);
      });
    });
    describe("Send tx multiple ERC20 and ether without paymaster", function () {
      it("Should correctly executeBatch UserOp from Entrypoint without paymaster with 0 maxFeePerGas", async function () {
        const {
          owner,
          beneficiary,
          random,
          testToken,
          testToken2,
          entryPoint,
          denimAccountContract,
        } = await loadFixture(deployWalletFixture);
  
        const { data } = await testToken.populateTransaction.transfer(
          owner.address,
          parseEther("2.0")
        );
  
        const { data: data2 } = await testToken2.populateTransaction.transfer(
          owner.address,
          parseEther("3.0")
        );
  
        //base account now has 3 ether
        await random.sendTransaction({
          to: denimAccountContract.address,
          value: parseEther("3.0"),
        });
  
        expect(
          await ethers.provider.getBalance(denimAccountContract.address)
        ).to.eq(parseEther("3.0"));
  
        const txExec =
          await denimAccountContract.populateTransaction.executeBatchValue(
            [testToken.address, testToken2.address, owner.address],
            [0, 0, parseEther("3.0")],
            [data, data2, "0x"]
          );
  
        let op = await fillAndSign(
          {
            sender: denimAccountContract.address,
            nonce: await denimAccountContract.getNonce(),
            callData: txExec.data,
            maxFeePerGas: 0,
          },
          owner,
          entryPoint
        );
  
        op = await fillAndSign(op, owner, entryPoint);
  
        const entryPointBalance = await ethers.provider.getBalance(
          entryPoint.address
        );
  
        const tx = await entryPoint.handleOps([op], beneficiary.address);
  
        //no change in entryPoint balance
        expect(await ethers.provider.getBalance(entryPoint.address)).to.eq(
          entryPointBalance
        );
        expect(await testToken.balanceOf(denimAccountContract.address)).to.eq(0);
        expect(await testToken2.balanceOf(denimAccountContract.address)).to.eq(0);
        expect(
          await ethers.provider.getBalance(denimAccountContract.address)
        ).to.eq(0);
      });
    });
  });