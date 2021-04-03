const { ethers } = require("hardhat");
import { expect } from "chai";
import {
    toWei,
    getAccounts,
    createContract,
} from '../scripts/utils';

function toUSDC(n, tail = 0) {
    const t = String(tail)
    return ethers.BigNumber.from(n + t.padStart(6, "0"))
};

describe('MCBCrowdsale', () => {
    let accounts;
    let user0;
    let user1;
    let user2;
    let user3;

    before(async () => {
        accounts = await getAccounts();
        user0 = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        user3 = accounts[3];

        console.log("user0", user0.address)
        console.log("user1", user1.address)
        console.log("user2", user2.address)
        console.log("user3", user3.address)
    })

    it("buy", async () => {
        const usdc = await createContract("CustomERC20", ["MCB", "MCB", 6])
        const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])
        const cs = await createContract("TestMCBCrowdsale", [mcb.address, usdc.address, user3.address, 0, 1000, 1000]);

        await usdc.mint(user1.address, toUSDC("1000"))
        await usdc.connect(user1).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user1.address, toWei("400"))
        await mcb.connect(user1).approve(cs.address, toWei("100000000000"))

        await usdc.mint(user2.address, toUSDC("10000"))
        await usdc.connect(user2).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user2.address, toWei("4000"))
        await mcb.connect(user2).approve(cs.address, toWei("100000000000"))

        await cs.setTimestamp(10);
        await expect(cs.connect(user1).commit(toWei("0"))).to.be.revertedWith("amount to buy cannot be zero")
        await cs.connect(user1).commit(toWei("100"));
        expect(await cs.shareOf(user1.address)).to.equal(toWei("100"));
        expect(await usdc.balanceOf(user1.address)).to.equal(toUSDC("0"));
        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("1000"));
        expect(await mcb.balanceOf(user1.address)).to.equal(toWei("0"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("400"));

        await cs.connect(user2).commit(toWei("1000"));
        expect(await cs.shareOf(user2.address)).to.equal(toWei("1000"));
        expect(await usdc.balanceOf(user2.address)).to.equal(toUSDC("0"));
        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("11000"));
        expect(await mcb.balanceOf(user2.address)).to.equal(toWei("0"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("4400"));
    })


    it("buy - 2", async () => {
        const usdc = await createContract("CustomERC20", ["MCB", "MCB", 6])
        const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])
        const now = Math.floor(Date.now() / 1000);
        const cs = await createContract("TestMCBCrowdsale", [mcb.address, usdc.address, user3.address, 0, 1000, 1000]);

        await usdc.mint(user1.address, toUSDC("1000000"))
        await usdc.connect(user1).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user1.address, toWei("400000"))
        await mcb.connect(user1).approve(cs.address, toWei("100000000000"))

        await usdc.mint(user2.address, toUSDC("1000000"))
        await usdc.connect(user2).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user2.address, toWei("400000"))
        await mcb.connect(user2).approve(cs.address, toWei("100000000000"))

        await cs.setTimestamp(10);
        expect(await cs.isCommitable()).to.be.true;

        await cs.connect(user1).commit(toWei("60000"));
        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("600000"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("240000"));
        expect(await cs.shareOf(user1.address)).to.equal(toWei("60000"));

        await cs.connect(user2).commit(toWei("60000"));
        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("1200000"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("480000"));
        expect(await cs.shareOf(user2.address)).to.equal(toWei("50000"));
        expect(await cs.shareOf(user1.address)).to.equal(toWei("50000"));
    })


    it("state", async () => {
        const usdc = await createContract("CustomERC20", ["MCB", "MCB", 6])
        const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])
        const cs = await createContract("TestMCBCrowdsale", [mcb.address, usdc.address, user3.address, 1000, 2000, 1000]);

        await usdc.mint(user1.address, toUSDC("1000000"))
        await usdc.connect(user1).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user1.address, toWei("400000"))
        await mcb.connect(user1).approve(cs.address, toWei("100000000000"))

        await usdc.mint(user2.address, toUSDC("1000000"))
        await usdc.connect(user2).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user2.address, toWei("400000"))
        await mcb.connect(user2).approve(cs.address, toWei("100000000000"))


        await cs.setTimestamp(100);
        expect(await cs.isCommitable()).to.be.false;
        expect(await cs.isSettleable()).to.be.false;
        await expect(cs.connect(user1).commit(toWei("60000"))).to.be.revertedWith("commit is not active now")

        await cs.setTimestamp(1000);
        expect(await cs.isCommitable()).to.be.true;
        expect(await cs.isSettleable()).to.be.false;

        await cs.connect(user1).commit(toWei("60000"));
        await cs.connect(user2).commit(toWei("60000"));
        await expect(cs.forwardFunds()).to.be.revertedWith("forward is not active now")

        await cs.setTimestamp(2000);
        expect(await cs.isCommitable()).to.be.false;
        expect(await cs.isSettleable()).to.be.false;
        await expect(cs.connect(user1).commit(toWei("60000"))).to.be.revertedWith("commit is not active now")
        await expect(cs.settle(user1.address)).to.be.revertedWith("settle is not active now")

        await cs.setTimestamp(3000);
        expect(await cs.isCommitable()).to.be.false;
        expect(await cs.isSettleable()).to.be.true;

        await expect(cs.emergencySettle(user1.address)).to.be.revertedWith("emergency settle is only available in emergency state")
        await cs.settle(user1.address);
        await expect(cs.settle(user1.address)).to.be.revertedWith("account has alreay settled")
        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("1100000", 1));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("240000"));
        expect(await cs.shareOf(user2.address)).to.equal(toWei("50000"));
        expect(await cs.shareOf(user1.address)).to.equal(toWei("50000"));
        await cs.settle(user2.address);

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("1000000", 2));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("0"));
        expect(await cs.shareOf(user2.address)).to.equal(toWei("50000"));
        expect(await cs.shareOf(user1.address)).to.equal(toWei("50000"));

        expect(await cs.forwardFunds());
        await expect(cs.forwardFunds()).to.be.revertedWith("funds has alreay been forwarded")

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("0", 2));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("0"));
        expect(await cs.shareOf(user2.address)).to.equal(toWei("50000"));
        expect(await cs.shareOf(user1.address)).to.equal(toWei("50000"));
        expect(await usdc.balanceOf(user3.address)).to.equal(toUSDC("1000000"));
    })

    it("not all sold out", async () => {
        const usdc = await createContract("CustomERC20", ["MCB", "MCB", 6])
        const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])
        const cs = await createContract("TestMCBCrowdsale", [mcb.address, usdc.address, user3.address, 1000, 2000, 1000]);

        await usdc.mint(user1.address, toUSDC("1000000"))
        await usdc.connect(user1).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user1.address, toWei("400000"))
        await mcb.connect(user1).approve(cs.address, toWei("100000000000"))

        await usdc.mint(user2.address, toUSDC("1000000"))
        await usdc.connect(user2).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user2.address, toWei("400000"))
        await mcb.connect(user2).approve(cs.address, toWei("100000000000"))

        await cs.setTimestamp(1000);
        await cs.connect(user1).commit(toWei("40000"));
        await cs.connect(user2).commit(toWei("20000"));
        expect(await cs.totalCommitment()).to.equal(toWei("60000"))
        expect(await cs.totalCommitedSupply()).to.equal(toWei("60000"))
        expect(await cs.commitmentRate()).to.equal(toWei("1"))

        await cs.setTimestamp(3000);
        await cs.settle(user1.address);
        await cs.settle(user2.address);
        expect(await cs.forwardFunds());

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("0"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("0"));
        expect(await cs.shareOf(user1.address)).to.equal(toWei("40000"));
        expect(await cs.shareOf(user2.address)).to.equal(toWei("20000"));
        expect(await usdc.balanceOf(user3.address)).to.equal(toUSDC("600000"));
        expect(await cs.totalCommitment()).to.equal(toWei("60000"))
        expect(await cs.totalCommitedSupply()).to.equal(toWei("60000"))
        expect(await cs.commitmentRate()).to.equal(toWei("1"))
    })

    it("exactly all sold", async () => {
        const usdc = await createContract("CustomERC20", ["MCB", "MCB", 6])
        const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])
        const cs = await createContract("TestMCBCrowdsale", [mcb.address, usdc.address, user3.address, 1000, 2000, 1000]);

        await usdc.mint(user1.address, toUSDC("1000000"))
        await usdc.connect(user1).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user1.address, toWei("400000"))
        await mcb.connect(user1).approve(cs.address, toWei("100000000000"))

        await usdc.mint(user2.address, toUSDC("1000000"))
        await usdc.connect(user2).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user2.address, toWei("400000"))
        await mcb.connect(user2).approve(cs.address, toWei("100000000000"))

        await cs.setTimestamp(1000);
        await cs.connect(user1).commit(toWei("50000"));
        await cs.connect(user2).commit(toWei("50000"));
        expect(await cs.totalCommitment()).to.equal(toWei("100000"))
        expect(await cs.totalCommitedSupply()).to.equal(toWei("100000"))
        expect(await cs.commitmentRate()).to.equal(toWei("1"))

        await cs.setTimestamp(3000);
        await cs.settle(user1.address);
        await cs.settle(user2.address);
        expect(await cs.forwardFunds());

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("0"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("0"));
        expect(await cs.shareOf(user1.address)).to.equal(toWei("50000"));
        expect(await cs.shareOf(user2.address)).to.equal(toWei("50000"));
        expect(await usdc.balanceOf(user3.address)).to.equal(toUSDC("1000000"));
        expect(await cs.totalCommitment()).to.equal(toWei("100000"))
        expect(await cs.totalCommitedSupply()).to.equal(toWei("100000"))
        expect(await cs.commitmentRate()).to.equal(toWei("1"))
    })

    it("over sold", async () => {
        const usdc = await createContract("CustomERC20", ["MCB", "MCB", 6])
        const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])
        const cs = await createContract("TestMCBCrowdsale", [mcb.address, usdc.address, user3.address, 1000, 2000, 1000]);

        await usdc.mint(user1.address, toUSDC("10000000"))
        await usdc.connect(user1).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user1.address, toWei("4000000"))
        await mcb.connect(user1).approve(cs.address, toWei("100000000000"))

        await usdc.mint(user2.address, toUSDC("10000000"))
        await usdc.connect(user2).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user2.address, toWei("4000000"))
        await mcb.connect(user2).approve(cs.address, toWei("100000000000"))

        await cs.setTimestamp(1000);
        await cs.connect(user1).commit(toWei("120000"));
        await cs.connect(user2).commit(toWei("40000"));
        expect(await cs.totalCommitment()).to.equal(toWei("160000"))
        expect(await cs.totalCommitedSupply()).to.equal(toWei("100000"))
        expect(await cs.commitmentRate()).to.equal(toWei("1.6"))

        await cs.setTimestamp(3000);
        await cs.settle(user1.address);
        await cs.settle(user2.address);
        expect(await cs.forwardFunds());

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("0", 2));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("0"));
        expect(await cs.shareOf(user1.address)).to.equal(toWei("75000"));
        expect(await cs.shareOf(user2.address)).to.equal(toWei("25000"));
        expect(await usdc.balanceOf(user3.address)).to.equal(toUSDC("1000000"));
        expect(await cs.totalCommitment()).to.equal(toWei("160000"))
        expect(await cs.totalCommitedSupply()).to.equal(toWei("100000"))
        expect(await cs.commitmentRate()).to.equal(toWei("1.6"))
    })

    it("emergency when commit", async () => {
        const usdc = await createContract("CustomERC20", ["MCB", "MCB", 6])
        const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])
        const cs = await createContract("TestMCBCrowdsale", [mcb.address, usdc.address, user3.address, 1000, 2000, 1000]);

        await usdc.mint(user1.address, toUSDC("10000000"))
        await usdc.connect(user1).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user1.address, toWei("4000000"))
        await mcb.connect(user1).approve(cs.address, toWei("100000000000"))

        await usdc.mint(user2.address, toUSDC("10000000"))
        await usdc.connect(user2).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user2.address, toWei("4000000"))
        await mcb.connect(user2).approve(cs.address, toWei("100000000000"))

        await cs.setTimestamp(1000);
        await cs.connect(user1).commit(toWei("120000"));
        await cs.connect(user2).commit(toWei("40000"));

        await cs.setEmergency();

        await expect(cs.connect(user2).commit(toWei("40000"))).to.be.revertedWith("commit is not available in emergency state")
        await expect(cs.setEmergency()).to.be.revertedWith("already in emergency state")

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("1600000"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("640000"));

        await cs.emergencySettle(user1.address);
        await cs.emergencySettle(user2.address);

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("0"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("0"));
    })

    it("emergency when locked", async () => {
        const usdc = await createContract("CustomERC20", ["MCB", "MCB", 6])
        const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])
        const cs = await createContract("TestMCBCrowdsale", [mcb.address, usdc.address, user3.address, 1000, 2000, 1000]);

        await usdc.mint(user1.address, toUSDC("10000000"))
        await usdc.connect(user1).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user1.address, toWei("4000000"))
        await mcb.connect(user1).approve(cs.address, toWei("100000000000"))

        await usdc.mint(user2.address, toUSDC("10000000"))
        await usdc.connect(user2).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user2.address, toWei("4000000"))
        await mcb.connect(user2).approve(cs.address, toWei("100000000000"))

        await cs.setTimestamp(1000);
        await cs.connect(user1).commit(toWei("120000"));
        await cs.connect(user2).commit(toWei("40000"));

        await cs.setTimestamp(2000);
        await cs.setEmergency();
        await expect(cs.setEmergency()).to.be.revertedWith("already in emergency state")

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("1600000"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("640000"));

        await cs.emergencySettle(user1.address);
        await cs.emergencySettle(user2.address);

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("0"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("0"));

        await expect(cs.forwardFunds()).to.be.revertedWith("forward is not available in emergency state")

        await cs.setTimestamp(3000 + 86400 * 2);
        await expect(cs.forwardFunds()).to.be.revertedWith("forward is not available in emergency state")

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("0"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("0"));
    })

    it("emergency when locked - 2", async () => {
        const usdc = await createContract("CustomERC20", ["MCB", "MCB", 6])
        const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])
        const cs = await createContract("TestMCBCrowdsale", [mcb.address, usdc.address, user3.address, 1000, 2000, 1000]);

        await usdc.mint(user1.address, toUSDC("10000000"))
        await usdc.connect(user1).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user1.address, toWei("4000000"))
        await mcb.connect(user1).approve(cs.address, toWei("100000000000"))

        await usdc.mint(user2.address, toUSDC("10000000"))
        await usdc.connect(user2).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user2.address, toWei("4000000"))
        await mcb.connect(user2).approve(cs.address, toWei("100000000000"))

        await cs.setTimestamp(1000);
        await cs.connect(user1).commit(toWei("120000"));
        await cs.connect(user2).commit(toWei("40000"));

        await cs.setTimestamp(2000);
        await cs.setEmergency();
        await expect(cs.setEmergency()).to.be.revertedWith("already in emergency state")

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("1600000"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("640000"));

        await expect(cs.settle(user1.address)).to.be.revertedWith("settle is not available in emergency state")
        await cs.emergencySettle(user1.address);

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("400000"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("160000"));

        await expect(cs.forwardFunds()).to.be.revertedWith("forward is not available in emergency state")

        await cs.setTimestamp(3000);
        await expect(cs.forwardFunds()).to.be.revertedWith("forward is not available in emergency state")

        await cs.emergencySettle(user2.address);

        await cs.setTimestamp(3000 + 86400 * 2);

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("0"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("0"));
    })
})