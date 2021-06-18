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

        await mcb.mint(vesting.address, toWei("4"));

        expect(await vesting.claimableToken(user1.address)).to.equal(toWei("1"))
        expect(await vesting.claimableToken(user2.address)).to.equal(toWei("1.5"))
        expect(await vesting.claimableToken(user3.address)).to.equal(toWei("2.5"))

        await vesting.connect(user1).claim();
        await expect(vesting.connect(user1).claim()).to.be.revertedWith("no token to claim");
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

        var tx = await vesting.connect(user1).claim();
        await expect(vesting.connect(user1).claim()).to.be.revertedWith("no token to claim");
        // console.log((await tx.wait()).gasUsed.toString())
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

        await expect(vesting.connect(user3).claim()).to.be.revertedWith("no token to claim")
        // await vesting.claim(user3.address);
        await vesting.connect(user4).claim();
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

    it("vesting - limit", async () => {
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

        var tx = await vesting.connect(user1).claim();
        await expect(vesting.connect(user1).claim()).to.be.revertedWith("no token to claim");
        // console.log((await tx.wait()).gasUsed.toString())
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

        await expect(vesting.connect(user3).claim()).to.be.revertedWith("no token to claim")
        // await vesting.claim(user3.address);
        await vesting.connect(user4).claim();
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

    it("vesting - update by sig", async () => {
        const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])
        const vesting = await createContract("TestMCBVesting", [
            mcb.address,
            0,
            [user1.address, user2.address, user3.address],
            [toWei("2"), toWei("3"), toWei("5")]
        ])

        expect(await vesting.shareOf(user1.address)).to.equal(toWei("0.2"))
        expect(await vesting.shareOf(user2.address)).to.equal(toWei("0.3"))
        expect(await vesting.shareOf(user3.address)).to.equal(toWei("0.5"))

        const wallet = ethers.Wallet.createRandom()
        await vesting.updateBeneficiary(user1.address, wallet.address)

        expect(await vesting.shareOf(user1.address)).to.equal(toWei("0"))
        expect(await vesting.shareOf(user2.address)).to.equal(toWei("0.3"))
        expect(await vesting.shareOf(user3.address)).to.equal(toWei("0.5"))
        expect(await vesting.shareOf(wallet.address)).to.equal(toWei("0.2"))

        const typedData = {
            types: {
                EIP712Domain: [
                    { name: "name", type: "string" },
                    { name: "chainId", type: "uint256" },
                    { name: "verifyingContract", type: "address" },
                ],
                UpdateBeneficiary: [
                    { name: "oldBeneficiary", type: "address" },
                    { name: "newBeneficiary", type: "address" },
                    { name: "nonce", type: "uint256" },
                    { name: "expiration", type: "uint256" },
                ]
            },
            primaryType: 'UpdateBeneficiary' as const,
            domain: {
                name: 'MCBVesting',
                chainId: 31337,
                verifyingContract: vesting.address
            },
            message: {
                'oldBeneficiary': wallet.address,
                'newBeneficiary': user1.address,
                'nonce': 0,
                'expiration': 1724011900,
            }
        }
        const digest = TypedDataUtils.encodeDigest(typedData)
        var sigRaw = ecsign(Buffer.from(ethers.utils.hexlify(digest).slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))
        await vesting.updateBeneficiaryBySignature(
            wallet.address,
            user1.address,
            0,
            1724011900,
            sigRaw.v,
            sigRaw.r,
            sigRaw.s
        )
        expect(await vesting.shareOf(user1.address)).to.equal(toWei("0.2"))
        expect(await vesting.shareOf(user2.address)).to.equal(toWei("0.3"))
        expect(await vesting.shareOf(user3.address)).to.equal(toWei("0.5"))
        expect(await vesting.shareOf(wallet.address)).to.equal(toWei("0"))
    })


    it("vesting - sig error", async () => {
        const mcb = await createContract("CustomERC20", ["MCB", "MCB", 18])
        const vesting = await createContract("TestMCBVesting", [
            mcb.address,
            0,
            [user1.address, user2.address, user3.address],
            [toWei("2"), toWei("3"), toWei("5")]
        ])

        expect(await vesting.shareOf(user1.address)).to.equal(toWei("0.2"))
        expect(await vesting.shareOf(user2.address)).to.equal(toWei("0.3"))
        expect(await vesting.shareOf(user3.address)).to.equal(toWei("0.5"))

        const wallet = ethers.Wallet.createRandom()
        await vesting.updateBeneficiary(user1.address, wallet.address)

        expect(await vesting.shareOf(user1.address)).to.equal(toWei("0"))
        expect(await vesting.shareOf(user2.address)).to.equal(toWei("0.3"))
        expect(await vesting.shareOf(user3.address)).to.equal(toWei("0.5"))
        expect(await vesting.shareOf(wallet.address)).to.equal(toWei("0.2"))

        let now = Math.floor(Date.now() / 1000) - 1;
        let typedData = {
            types: {
                EIP712Domain: [
                    { name: "name", type: "string" },
                    { name: "chainId", type: "uint256" },
                    { name: "verifyingContract", type: "address" },
                ],
                UpdateBeneficiary: [
                    { name: "oldBeneficiary", type: "address" },
                    { name: "newBeneficiary", type: "address" },
                    { name: "nonce", type: "uint256" },
                    { name: "expiration", type: "uint256" },
                ]
            },
            primaryType: 'UpdateBeneficiary' as const,
            domain: {
                name: 'MCBVesting',
                chainId: 31337,
                verifyingContract: vesting.address
            },
            message: {
                'oldBeneficiary': wallet.address,
                'newBeneficiary': user1.address,
                'nonce': 0,
                'expiration': now,
            }
        }
        let digest = TypedDataUtils.encodeDigest(typedData)
        let sigRaw = ecsign(Buffer.from(ethers.utils.hexlify(digest).slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))
        await expect(vesting.updateBeneficiaryBySignature(
            wallet.address,
            user1.address,
            0,
            now,
            sigRaw.v,
            sigRaw.r,
            sigRaw.s
        )).to.be.revertedWith("signature expired")

        now = Math.floor(Date.now() / 1000) + 1000;
        typedData = {
            types: {
                EIP712Domain: [
                    { name: "name", type: "string" },
                    { name: "chainId", type: "uint256" },
                    { name: "verifyingContract", type: "address" },
                ],
                UpdateBeneficiary: [
                    { name: "oldBeneficiary", type: "address" },
                    { name: "newBeneficiary", type: "address" },
                    { name: "nonce", type: "uint256" },
                    { name: "expiration", type: "uint256" },
                ]
            },
            primaryType: 'UpdateBeneficiary' as const,
            domain: {
                name: 'MCBVesting',
                chainId: 31337,
                verifyingContract: vesting.address
            },
            message: {
                'oldBeneficiary': user2.address,
                'newBeneficiary': wallet.address,
                'nonce': 0,
                'expiration': now,
            }
        }
        digest = TypedDataUtils.encodeDigest(typedData)
        sigRaw = ecsign(Buffer.from(ethers.utils.hexlify(digest).slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))
        await expect(vesting.updateBeneficiaryBySignature(
            user2.address,
            wallet.address,
            0,
            now,
            sigRaw.v,
            sigRaw.r,
            sigRaw.s
        )).to.be.revertedWith("signer is not the old beneficiary")

        now = Math.floor(Date.now() / 1000) + 1000;
        typedData = {
            types: {
                EIP712Domain: [
                    { name: "name", type: "string" },
                    { name: "chainId", type: "uint256" },
                    { name: "verifyingContract", type: "address" },
                ],
                UpdateBeneficiary: [
                    { name: "oldBeneficiary", type: "address" },
                    { name: "newBeneficiary", type: "address" },
                    { name: "nonce", type: "uint256" },
                    { name: "expiration", type: "uint256" },
                ]
            },
            primaryType: 'UpdateBeneficiary' as const,
            domain: {
                name: 'MCBVesting',
                chainId: 31337,
                verifyingContract: vesting.address
            },
            message: {
                'oldBeneficiary': wallet.address,
                'newBeneficiary': user1.address,
                'nonce': 1,
                'expiration': now,
            }
        }
        digest = TypedDataUtils.encodeDigest(typedData)
        sigRaw = ecsign(Buffer.from(ethers.utils.hexlify(digest).slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))
        await expect(vesting.updateBeneficiaryBySignature(
            wallet.address,
            user1.address,
            1,
            now,
            sigRaw.v,
            sigRaw.r,
            sigRaw.s
        )).to.be.revertedWith("invalid nonce")

        now = Math.floor(Date.now() / 1000) + 1000;
        typedData = {
            types: {
                EIP712Domain: [
                    { name: "name", type: "string" },
                    { name: "chainId", type: "uint256" },
                    { name: "verifyingContract", type: "address" },
                ],
                UpdateBeneficiary: [
                    { name: "oldBeneficiary", type: "address" },
                    { name: "newBeneficiary", type: "address" },
                    { name: "nonce", type: "uint256" },
                    { name: "expiration", type: "uint256" },
                ]
            },
            primaryType: 'UpdateBeneficiary' as const,
            domain: {
                name: 'MCBVesting',
                chainId: 31337,
                verifyingContract: vesting.address
            },
            message: {
                'oldBeneficiary': wallet.address,
                'newBeneficiary': user1.address,
                'nonce': 0,
                'expiration': now,
            }
        }
        digest = TypedDataUtils.encodeDigest(typedData)
        sigRaw = ecsign(Buffer.from(ethers.utils.hexlify(digest).slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))
        await expect(vesting.updateBeneficiaryBySignature(
            wallet.address,
            user2.address,
            0,
            now,
            sigRaw.v,
            sigRaw.r,
            sigRaw.s
        )).to.be.revertedWith("signer is not the old beneficiary")
    })
})