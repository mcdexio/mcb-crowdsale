const { ethers } = require("hardhat");

export function toWei(n) { return ethers.utils.parseEther(n) };
export function fromWei(n) { return ethers.utils.formatEther(n); }
export function toBytes32(s) { return ethers.utils.formatBytes32String(s); }
export function fromBytes32(s) { return ethers.utils.parseBytes32String(s); }

export async function getAccounts(): Promise<any[]> {
    const accounts = await ethers.getSigners();
    const users = [];
    accounts.forEach(element => {
        users.push(element.address);
    });
    return accounts;
}

export async function createFactory(path, libraries = {}) {
    const parsed = {}
    for (var name in libraries) {
        parsed[name] = libraries[name].address;
    }
    return await ethers.getContractFactory(path, { libraries: parsed })
}

export async function createContract(path, args = [], libraries = {}) {
    const factory = await createFactory(path, libraries);
    return await factory.deploy(...args);
}