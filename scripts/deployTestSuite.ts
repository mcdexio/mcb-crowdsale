const { ethers } = require("hardhat");
import {
    toWei,
    fromWei,
    toBytes32,
    getAccounts,
    createContract,
    createFactory,
} from './utils';

async function short(accounts: any[]) {
    const usdc = await createContract("CustomERC20", ["MCB", "MCB", 6])
    const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])

    const now = Math.floor(Date.now() / 1000);
    const cs = await createContract("TestMCBCrowdsale", [
        mcb.address,
        usdc.address,
        accounts[0].address,
        now,
        now + 3600,
        3600
    ]);

    await usdc.mint("0x55817BEAafD3316c6CF5c1fa2ee68d2045b5069B", toWei("10000000"))
    await mcb.mint("0x55817BEAafD3316c6CF5c1fa2ee68d2045b5069B", toWei("10000000"))

    console.log("3600s")
    console.table([
        ["mcb", mcb.address],
        ["usdc", usdc.address],
        ["crowdsale", cs.address],
    ])
}

async function long(accounts: any[]) {
    const usdc = await createContract("CustomERC20", ["MCB", "MCB", 6])
    const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])

    const now = Math.floor(Date.now() / 1000);
    const cs = await createContract("TestMCBCrowdsale", [
        mcb.address,
        usdc.address,
        accounts[0].address,
        now,
        now + 259200,
        259200
    ]);

    await usdc.mint("0x55817BEAafD3316c6CF5c1fa2ee68d2045b5069B", toWei("10000000"))
    await mcb.mint("0x55817BEAafD3316c6CF5c1fa2ee68d2045b5069B", toWei("10000000"))

    console.log("259200")
    console.table([
        ["mcb", mcb.address],
        ["usdc", usdc.address],
        ["crowdsale", cs.address],
    ])
}

async function main(accounts: any[]) {
    await short(accounts);
    await long(accounts);
}
ethers.getSigners()
    .then(accounts => main(accounts))
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });