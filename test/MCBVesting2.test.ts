const { ethers } = require("hardhat");
import { TypedDataUtils } from 'ethers-eip712'
import {
    ecsign
} from 'ethereumjs-util'
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

        await vesting.connect(user1).claim()
        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("0.3"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0.5"))

        await mcb.mint(user0.address, toWei("1"))
        await mcb.approve(vesting.address, toWei("999999"))
        await vesting.donate(toWei("1"));

        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("0.3"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0.5"))

        await vesting.setClaimed(user3.address, toWei("1.0"))

        await mcb.mint(vesting.address, toWei("1"));

        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("0.2"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("0.6"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0"))

        await vesting.connect(user2).claim()

        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("0.2"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("0"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0"))

        await mcb.mint(vesting.address, toWei("1"));
        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("0.4"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("0.3"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("0.5"))

        await mcb.mint(vesting.address, toWei("1"));
        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("0.6"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("0.6"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("1.0"))

        await mcb.mint(vesting.address, toWei("999"));
        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("1.8"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("2.4"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("4"))
    })
})