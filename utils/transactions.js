import { ethers } from 'ethers';
import log from "./logger.js";

// 配置
const provider = new ethers.JsonRpcProvider('https://base-sepolia-rpc.publicnode.com');
const contractAddress = '0xF39635F2adF40608255779ff742Afe13dE31f577';
const contractSwap = "0x809daBC75201F92AC40973f22db37995676BaA04"
const explorer = 'https://sepolia.basescan.org/tx/'
const ApproveAmount = ethers.parseUnits('10000', 'ether');
const depositAmount = ethers.parseUnits('0.01', 'ether');
const minAmount = ethers.parseUnits('0.00001', 'ether');
const tokens = [
    { address: '0x13e5fb0b6534bb22cbc59fae339dbbe0dc906871', name: 'wstETH' },
    { address: '0x5Bd36745f6199CF32d2465Ef1F8D6c51dCA9BdEE', name: 'bondETH' },
    { address: '0x98f665D98a046fB81147879eCBE9A6fF68BC276C', name: 'levETH' },
];

// ERC20 ABI
const erc20ABI = [
    {
        "constant": false,
        "inputs": [
            { "name": "spender", "type": "address" },
            { "name": "value", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "name": "", "type": "bool" }],
        "type": "function",
        "stateMutability": "nonpayable"
    },
    {
        "constant": true,
        "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }],
        "name": "allowance",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function",
        "stateMutability": "view"
    }
];
// 赎回和存款 ABI
const redeemABI = [
    {
        inputs: [
            { internalType: 'uint8', name: 'tokenType', type: 'uint8' },
            { internalType: 'uint256', name: 'depositAmount', type: 'uint256' },
            { internalType: 'uint256', name: 'minAmount', type: 'uint256' },
        ],
        name: 'redeem',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
];

const createABI = [
    {
        inputs: [
            { internalType: 'uint8', name: 'tokenType', type: 'uint8' },
            { internalType: 'uint256', name: 'depositAmount', type: 'uint256' },
            { internalType: 'uint256', name: 'minAmount', type: 'uint256' },
        ],
        name: 'create',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
];

// 检查和授权代币的函数
const approveTokenIfNeeded = async (wallet, tokenAddress, tokenName) => {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, wallet);
        const allowance = await tokenContract.allowance(wallet.address, contractSwap);

        if (allowance > depositAmount) {
            return;
        }

        const feeData = await provider.getFeeData();
        const price = feeData.gasPrice;
        const increasedGasPrice = (price * BigInt(125)) / BigInt(100);

        const tx = await tokenContract.approve(contractSwap, ApproveAmount, {
            gasPrice: increasedGasPrice
        });

        log.info(`授权交易已发送至 ${tokenName}: ${tx.hash}`);

        const timeout = 60 * 1000;
        const txPromise = tx.wait();

        await Promise.race([
            txPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('交易超时')), timeout))
        ]);

        log.info(`${tokenName} 的授权交易已确认: ${explorer}${tx.hash}`);
    } catch (error) {
        log.error(`在授权 ${tokenName} 时发生错误:`, error);
    }
};

// 更新过的 approveAllTokens 函数
const approveAllTokens = async (wallet) => {
    for (const token of tokens) {
        await approveTokenIfNeeded(wallet, token.address, token.name);
    }
};

// 存款和赎回函数
const deposit = async (contract, tokenType) => {
    try {
        const price = (await provider.getFeeData()).gasPrice
        const increasedGasPrice = (price * BigInt(125)) / BigInt(100);
        const tx = await contract.create(tokenType, depositAmount, minAmount, {
            gasPrice: increasedGasPrice
        });

        const timeout = 60 * 1000;
        const txPromise = tx.wait();

        await Promise.race([
            txPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('交易超时')), timeout))
        ]);

        log.info(`存款交易已确认: ${explorer}${tx.hash}`);
    } catch (error) {
        log.error('存款时发生错误:', error);
    }
};

const redeem = async (contract, tokenType) => {
    try {
        const price = (await provider.getFeeData()).gasPrice
        const increasedGasPrice = (price * BigInt(125)) / BigInt(100);
        const tx = await contract.redeem(tokenType, depositAmount, minAmount, {
            gasPrice: increasedGasPrice
        });

        const timeout = 60 * 1000;
        const txPromise = tx.wait();

        await Promise.race([
            txPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('交易超时')), timeout))
        ]);

        log.info(`赎回交易已确认: ${explorer}${tx.hash}`);
    } catch (error) {
        log.error('赎回时发生错误:', error);
    }
};

// 运行交易
const runTransactions = async (privateKey, tokenType) => {
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, [...redeemABI, ...createABI], wallet);

    await approveAllTokens(wallet);

    log.info(`地址 ${wallet.address} 正在执行存款...`);
    await deposit(contract, tokenType);

    log.info(`地址 ${wallet.address} 正在执行赎回...`);
    await redeem(contract, tokenType);
};

export default runTransactions;
