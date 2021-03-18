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

        await cs.connect(user1).purchase(toWei("100"));
        expect(await cs.quotaOf(user1.address)).to.equal(toWei("100"));
        expect(await usdc.balanceOf(user1.address)).to.equal(toUSDC("0"));
        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("1000"));
        expect(await mcb.balanceOf(user1.address)).to.equal(toWei("0"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("400"));

        await cs.connect(user2).purchase(toWei("1000"));
        expect(await cs.quotaOf(user2.address)).to.equal(toWei("1000"));
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

        expect(await cs.isPurchaseable()).to.be.true;

        await cs.connect(user1).purchase(toWei("60000"));
        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("600000"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("240000"));
        expect(await cs.quotaOf(user1.address)).to.equal(toWei("60000"));

        await cs.connect(user2).purchase(toWei("60000"));
        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("1200000"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("480000"));
        expect(await cs.quotaOf(user2.address)).to.equal(toWei("50000"));
        expect(await cs.quotaOf(user1.address)).to.equal(toWei("50000"));
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
        expect(await cs.isPurchaseable()).to.be.false;
        expect(await cs.isSettleable()).to.be.false;
        await expect(cs.connect(user1).purchase(toWei("60000"))).to.be.revertedWith("purchase is not active now")

        await cs.setTimestamp(1000);
        expect(await cs.isPurchaseable()).to.be.true;
        expect(await cs.isSettleable()).to.be.false;

        await cs.connect(user1).purchase(toWei("60000"));
        await cs.connect(user2).purchase(toWei("60000"));

        await cs.setTimestamp(2000);
        expect(await cs.isPurchaseable()).to.be.false;
        expect(await cs.isSettleable()).to.be.false;
        await expect(cs.connect(user1).purchase(toWei("60000"))).to.be.revertedWith("purchase is not active now")
        await expect(cs.settle(user1.address)).to.be.revertedWith("settle is not active now")

        await cs.setTimestamp(3000);
        expect(await cs.isPurchaseable()).to.be.false;
        expect(await cs.isSettleable()).to.be.true;
        await cs.settle(user1.address);
        await expect(cs.settle(user1.address)).to.be.revertedWith("account has alreay settled")
        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("1100000", 1));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("240000"));
        expect(await cs.quotaOf(user2.address)).to.equal(toWei("50000"));
        expect(await cs.quotaOf(user1.address)).to.equal(toWei("50000"));
        await cs.settle(user2.address);

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("1000000", 2));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("0"));
        expect(await cs.quotaOf(user2.address)).to.equal(toWei("50000"));
        expect(await cs.quotaOf(user1.address)).to.equal(toWei("50000"));

        expect(await cs.forwardFunds());
        await expect(cs.forwardFunds()).to.be.revertedWith("funds has alreay been forwarded")

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("0", 2));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("0"));
        expect(await cs.quotaOf(user2.address)).to.equal(toWei("50000"));
        expect(await cs.quotaOf(user1.address)).to.equal(toWei("50000"));
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
        await cs.connect(user1).purchase(toWei("40000"));
        await cs.connect(user2).purchase(toWei("20000"));

        await cs.setTimestamp(3000);
        await cs.settle(user1.address);
        await cs.settle(user2.address);
        expect(await cs.forwardFunds());

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("0"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("0"));
        expect(await cs.quotaOf(user1.address)).to.equal(toWei("40000"));
        expect(await cs.quotaOf(user2.address)).to.equal(toWei("20000"));
        expect(await usdc.balanceOf(user3.address)).to.equal(toUSDC("600000"));
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
        await cs.connect(user1).purchase(toWei("50000"));
        await cs.connect(user2).purchase(toWei("50000"));

        await cs.setTimestamp(3000);
        await cs.settle(user1.address);
        await cs.settle(user2.address);
        expect(await cs.forwardFunds());

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("0"));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("0"));
        expect(await cs.quotaOf(user1.address)).to.equal(toWei("50000"));
        expect(await cs.quotaOf(user2.address)).to.equal(toWei("50000"));
        expect(await usdc.balanceOf(user3.address)).to.equal(toUSDC("1000000"));
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
        await cs.connect(user1).purchase(toWei("120000"));
        await cs.connect(user2).purchase(toWei("40000"));

        await cs.setTimestamp(3000);
        await cs.settle(user1.address);
        await cs.settle(user2.address);
        expect(await cs.forwardFunds());

        expect(await usdc.balanceOf(cs.address)).to.equal(toUSDC("0", 2));
        expect(await mcb.balanceOf(cs.address)).to.equal(toWei("0"));
        expect(await cs.quotaOf(user1.address)).to.equal(toWei("75000"));
        expect(await cs.quotaOf(user2.address)).to.equal(toWei("25000"));
        expect(await usdc.balanceOf(user3.address)).to.equal(toUSDC("1000000"));
    })
})