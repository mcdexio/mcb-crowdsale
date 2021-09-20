const { ethers } = require("hardhat");
import { expect } from "chai";
import {
    toWei,
    fromWei,
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


    it("not all sold out", async () => {
        const usdc = await createContract("CustomERC20", ["MCB", "MCB", 6])
        const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])
        const cs = await createContract("TestMCBCrowdsale", [mcb.address, usdc.address, user3.address, 1000, 2000, 1000]);

        await usdc.mint(user1.address, toUSDC("1000000000"))
        await usdc.connect(user1).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user1.address, toWei("400000000"))
        await mcb.connect(user1).approve(cs.address, toWei("100000000000"))

        await usdc.mint(user2.address, toUSDC("1000000000"))
        await usdc.connect(user2).approve(cs.address, toUSDC("100000000000"))
        await mcb.mint(user2.address, toWei("400000000"))
        await mcb.connect(user2).approve(cs.address, toWei("100000000000"))

        await cs.setTimestamp(1000);
        var tx = await cs.connect(user1).commit(toWei("100229.3"));
        console.log((await tx.wait()).gasUsed.toString())

        await cs.setTimestamp(3000);
        var tx = await cs.settle(user1.address);
        console.log((await tx.wait()).gasUsed.toString())
        expect(await cs.forwardFunds());

        console.log("usdc-cs", (await usdc.balanceOf(cs.address)).toString())
        console.log("mcb-cs", (await mcb.balanceOf(cs.address)).toString())
        console.log("usdc-cs", (await usdc.balanceOf(user1.address)).toString())
        console.log("mcb-cs", (await mcb.balanceOf(user1.address)).toString())
        console.log("usdc-user3", (await usdc.balanceOf(user3.address)).toString())
    })
})