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

describe('MCBVesting', () => {
    let accounts;
    let user0;
    let user1;
    let user2;
    let user3;
    let user4;
    let user5;

    before(async () => {
        accounts = await getAccounts();
        user0 = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        user3 = accounts[3];
        user4 = accounts[4];
        user5 = accounts[5];
    })

    it("vesting", async () => {
        const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])

        const vesting = await createContract("TestMCBVesting", [
            mcb.address,
            0,
            [user1.address, user2.address, user3.address],
            [toWei("2"), toWei("3"), toWei("5")]
        ])

        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0"))

        await mcb.mint(vesting.address, toWei("1"));

        expect(await vesting.shareOf(user1.address)).to.equal(toWei("0.2"))
        expect(await vesting.shareOf(user2.address)).to.equal(toWei("0.3"))
        expect(await vesting.shareOf(user3.address)).to.equal(toWei("0.5"))

        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("0.2"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("0.3"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0.5"))

        await mcb.mint(vesting.address, toWei("4"));

        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("1"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("1.5"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("2.5"))

        await vesting.claim(user1.address);
        await expect(vesting.claim(user1.address)).to.be.revertedWith("no token to claim");
        expect(await mcb.balanceOf(user1.address)).to.equal(toWei("1"))
        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("1.5"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("2.5"))

        await mcb.mint(vesting.address, toWei("5"));
        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("1"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("3"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("5"))
    })

    it("vesting - updateBeneficiary.1", async () => {
        const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])

        const vesting = await createContract("TestMCBVesting", [
            mcb.address,
            0,
            [user1.address, user2.address, user3.address],
            [toWei("2"), toWei("3"), toWei("5")]
        ])

        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user4.address)).to.equal(toWei("0"))

        await mcb.mint(vesting.address, toWei("1"));

        expect(await vesting.shareOf(user1.address)).to.equal(toWei("0.2"))
        expect(await vesting.shareOf(user2.address)).to.equal(toWei("0.3"))
        expect(await vesting.shareOf(user3.address)).to.equal(toWei("0.5"))

        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("0.2"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("0.3"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0.5"))
        expect(await vesting.claimableToken(user4.address)).to.equal(toWei("0"))

        await vesting.updateBeneficiary(user3.address, user4.address);
        await mcb.mint(vesting.address, toWei("4"));

        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("1"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("1.5"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user4.address)).to.equal(toWei("2.5"))

        var tx = await vesting.claim(user1.address);
        await expect(vesting.claim(user1.address)).to.be.revertedWith("no token to claim");
        console.log((await tx.wait()).gasUsed.toString())
        expect(await mcb.balanceOf(user1.address)).to.equal(toWei("1"))
        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("1.5"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user4.address)).to.equal(toWei("2.5"))

        await mcb.mint(vesting.address, toWei("5"));
        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("1"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("3"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user4.address)).to.equal(toWei("5"))

        await expect(vesting.claim(user3.address)).to.be.revertedWith("no token to claim")
        // await vesting.claim(user3.address);
        await vesting.claim(user4.address);
        expect(await mcb.balanceOf(user3.address)).to.equal(toWei("0"))
        expect(await mcb.balanceOf(user4.address)).to.equal(toWei("5"))
        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("1"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("3"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user4.address)).to.equal(toWei("0"))

        await mcb.mint(vesting.address, toWei("1"));

        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("1"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("3"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user4.address)).to.equal(toWei("0"))

        await expect(vesting.updateBeneficiary(user4.address, user5.address)).to.be.revertedWith("old beneficiary has no more token to claim");

        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("1"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("3"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user4.address)).to.equal(toWei("0"))
    })
})