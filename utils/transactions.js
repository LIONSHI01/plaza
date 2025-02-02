import { ethers } from "ethers";
import { NETWORKS } from "./networks.js";
import log from "./logger.js";
import "dotenv/config";

// 配置
const provider = new ethers.JsonRpcProvider(NETWORKS["base_sepolia"]);
const contractAddress = process.env.TRANSACTION_MESSAGE_CONTRACT;
const explorer = "https://sepolia.basescan.org/tx/";
const ApproveAmount = ethers.parseUnits("10000", "ether");
const depositAmount = ethers.parseUnits("0.0001", "ether");
const minAmount = ethers.parseUnits("0.00001", "ether");
const tokens = [
  { address: "0x13e5fb0b6534bb22cbc59fae339dbbe0dc906871", name: "wstETH" },
  { address: "0x1aC493C87a483518642f320Ba5b342c7b78154ED", name: "bondETH" },
  { address: "0x975f67319f9DA83B403309108d4a8f84031538A6", name: "levETH" },
];

// ERC20 ABI
const erc20ABI = [
  {
    constant: false,
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
    stateMutability: "nonpayable",
  },
  {
    constant: true,
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
    stateMutability: "view",
  },
];
// 赎回和存款 ABI
const redeemABI = [
  {
    inputs: [
      { internalType: "uint8", name: "tokenType", type: "uint8" },
      { internalType: "uint256", name: "depositAmount", type: "uint256" },
      { internalType: "uint256", name: "minAmount", type: "uint256" },
    ],
    name: "redeem",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const createABI = [
  {
    inputs: [
      { internalType: "uint8", name: "tokenType", type: "uint8" },
      { internalType: "uint256", name: "depositAmount", type: "uint256" },
      { internalType: "uint256", name: "minAmount", type: "uint256" },
    ],
    name: "create",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// 函数检查并批准代币
const approveTokenIfNeeded = async (wallet, tokenAddress, tokenName) => {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, wallet);
    const allowance = await tokenContract.allowance(
      wallet.address,
      contractAddress
    );

    if (allowance > depositAmount) {
      return;
    }

    const tx = await tokenContract.approve(contractAddress, ApproveAmount);
    await tx.wait();
    log.info(`${tokenName} 的批准交易已确认 ${explorer}${tx.hash}`);
  } catch (error) {
    log.error(`批准 ${tokenName} 时出错:`, error);
  }
};

// 更新的 approveAllTokens 函数
const approveAllTokens = async (wallet) => {
  for (const token of tokens) {
    await approveTokenIfNeeded(wallet, token.address, token.name);
  }
};

// 存款和赎回函数
const deposit = async (contract, tokenType) => {
  try {
    const tx = await contract.create(tokenType, depositAmount, minAmount);
    await tx.wait();
    log.info(`存款交易已确认 ${explorer}${tx.hash}`);

    // 增加随机间隔
    const randomDelay = Math.floor(Math.random() * (200 - 15 + 1)) + 15;
    log.info(`等待 ${randomDelay} 秒后执行赎回...`);
    await new Promise((resolve) => setTimeout(resolve, randomDelay * 1000));
  } catch (error) {
    log.error("存款过程中出错:", error);
  }
};

const redeem = async (contract, tokenType) => {
  try {
    const tx = await contract.redeem(tokenType, depositAmount, minAmount, {
      gasLimit: "0x493e0",
    });
    await tx.wait();
    log.info(`赎回交易已确认. ${explorer}${tx.hash}`);
  } catch (error) {
    log.error("赎回过程中出错:", error);
  }
};

// 运行交易
const runTransactions = async (privateKey, tokenType) => {
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(
    contractAddress,
    [...redeemABI, ...createABI],
    wallet
  );

  await approveAllTokens(wallet);

  log.info(`地址 ${wallet.address} 正在执行存款...`);
  await deposit(contract, tokenType);

  log.info(`地址 ${wallet.address} 正在执行赎回...`);
  await redeem(contract, tokenType);
};

export default runTransactions;
