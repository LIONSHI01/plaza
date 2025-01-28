import axios from "axios";
import { readWallets, readProxyFile } from "./utils/script.js";
import banner from "./utils/banner.js";
import log from "./utils/logger.js";
import performTransactions from "./utils/transactions.js";
import { mintNft, signMessage } from "./contract.js";
import "dotenv/config";

const reffCode = `bfc7b70e-66ad-4524-9bb6-733716c4da94`;
const proxyPath = "proxy.txt";
const decimal = 1000000000000000000;
const coolDownPeriod = Number(process.env.COOL_DOWN_PERIOD);

const headers = {
  "Content-Type": "application/json",
  Referer: "https://testnet.plaza.finance/",
  "sec-ch-ua":
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "x-plaza-api-key": reffCode,
  "x-plaza-vercel-server": "undefined",
};

const createAxiosInstance = (proxyUrl) => {
  if (proxyUrl) {
    const proxyParts = proxyUrl.match(
      /^http:\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/
    );

    if (proxyParts) {
      const [, user, password, host, port] = proxyParts;

      return axios.create({
        baseURL: "https://api.plaza.finance/",
        headers,
        proxy: {
          protocol: "http",
          host: host,
          port: parseInt(port, 10),
          auth: {
            username: user,
            password: password,
          },
        },
      });
    } else {
      throw new Error("代理URL格式无效");
    }
  } else {
    return axios.create({
      baseURL: "https://api.plaza.finance/",
      headers,
    });
  }
};

const getFaucet = async (address, proxyUrl) => {
  const axiosInstance = createAxiosInstance(proxyUrl);
  try {
    const response = await axiosInstance.post("/faucet/queue", { address });
    log.info(`水龙头响应：成功`);
    return "success";
  } catch (error) {
    log.error(
      `获取水龙头时出错: ${error.response?.data?.message || error.message}`
    );
    return null;
  }
};

const fetchUser = async (address, proxyUrl) => {
  const axiosInstance = createAxiosInstance(proxyUrl);
  try {
    const response = await axiosInstance.get(`/user?user=${address}`);
    return response.data;
  } catch (error) {
    log.error(
      `获取用户信息时出错: ${error.response?.data?.message || error.message}`
    );
    return null;
  }
};

const claimRequest = async (address, proxyUrl) => {
  const axiosInstance = createAxiosInstance(proxyUrl);
  try {
    const response = await axiosInstance.post(`/referrals/claim`, {
      address,
      code: "JL4590xVLSix",
    });
    return response.data;
  } catch (error) {
    return null;
  }
};

const fetchUserBalance = async (address, proxyUrl) => {
  const axiosInstance = createAxiosInstance(proxyUrl);
  try {
    const response = await axiosInstance.get(`/user/balances`, {
      params: { networkId: 84532, user: address },
    });
    return response.data;
  } catch (error) {
    log.error(
      `获取余额时出错: ${error.response?.data?.message || error.message}`
    );
    return null;
  }
};

const getSign = async (level, user, signature, proxyUrl) => {
  const axiosInstance = createAxiosInstance(proxyUrl);
  try {
    const response = await axiosInstance.post(
      "/gamification/claim-level-rewards",
      { level, user, signature }
    );
    return response.data.signature;
  } catch (error) {
    log.error(
      `获取签名时出错: ${error.response?.data?.message || error.message}`
    );
    if (error.response?.data?.message === "用户已领取奖励") {
      return "claimed";
    }
    return null;
  }
};

const claimNftReward = async ({
  points,
  nftType,
  requiredPoints,
  wallet,
  proxy,
  claimedState,
}) => {
  const walletKey = wallet.address.toLowerCase();
  if (claimedState[walletKey][`nft${nftType}`]) {
    return;
  }

  if (points < requiredPoints) {
    return;
  }

  log.info(`=== 领取 NFT ${nftType} 奖励 地址: ${wallet.address} ===`);
  const signWallet = await signMessage(wallet.privateKey);
  const signature = await getSign(nftType, wallet.address, signWallet, proxy);

  if (signature && signature !== "claimed") {
    const mintResult = await mintNft(wallet.privateKey, signature);
    if (mintResult) {
      log.info(`=== NFT ${nftType} 成功领取 ===`);
      claimedState[walletKey][`nft${nftType}`] = true;
    } else {
      log.error(`=== 领取 NFT ${nftType} 失败 ===`);
    }
  } else if (signature === "claimed") {
    claimedState[walletKey][`nft${nftType}`] = true;
  }
};

const main = async () => {
  log.warn(banner);
  const wallets = readWallets();
  const proxyList = readProxyFile(proxyPath);
  let index = 0;
  const claimedState = {};

  while (true) {
    for (const wallet of wallets) {
      const walletKey = wallet.address.toLowerCase();
      claimedState[walletKey] = claimedState[walletKey] || {
        nft1: false,
        nft3: false,
      };
      const proxy =
        proxyList.length > 0 ? proxyList[index % proxyList.length] : null;
      log.warn(`使用代理运行: ${proxy || "无代理"}`);
      try {
        await claimRequest(wallet.address, proxy);

        const profile = await fetchUser(wallet.address, proxy);
        const level = profile?.level || 0;
        const points = profile?.points || 0;
        log.info(
          `=== 地址: ${wallet.address} | 等级: ${level} | 积分: ${points} ===`
        );

        log.info(`=== 检查 NFT 奖励 ===`);
        await claimNftReward({
          points,
          nftType: 1,
          requiredPoints: 50,
          wallet,
          proxy,
          claimedState,
        });

        await claimNftReward({
          points,
          nftType: 3,
          requiredPoints: 200,
          wallet,
          proxy,
          claimedState,
        });

        if (!claimedState[walletKey].nft1 && !claimedState[walletKey].nft3) {
          log.info(`=== 此地址没有可领取的 NFT 奖励 ===`);
        } else {
          log.info(`=== 此地址的 NFT 奖励已领取 ===`);
        }

        const balances = await fetchUserBalance(wallet.address, proxy);
        const balance = parseInt(balances[0]?.balanceRaw, 10) / decimal || 0;
        log.info(`=== 地址: ${wallet.address} | wstETH 余额: ${balance} ===\n`);

        if (balance > 0.02) {
          log.info(`开始进行交易，地址: ${wallet.address}`);
          await performTransactions(wallet.privateKey, 0);
          await performTransactions(wallet.privateKey, 1);

          log.info("冷却10秒后继续...\n");
          await new Promise((resolve) => setTimeout(resolve, 10000));
        } else {
          log.info(`=== wstETH 余额不足，尝试领取水龙头 ===`);
          const faucet = await getFaucet(wallet.address, proxy);
          await new Promise((resolve) => setTimeout(resolve, 15000));

          if (faucet === "success") {
            log.info(`开始进行交易，地址: ${wallet.address}`);
            await performTransactions(wallet.privateKey, 0);
            await performTransactions(wallet.privateKey, 1);
            log.info("冷却10秒后继续...\n");
            await new Promise((resolve) => setTimeout(resolve, 10000));
          }
        }
        index++;
      } catch (err) {
        console.error(err);
      }
    }
    log.info("睡眠24小时...");
    await new Promise((resolve) =>
      setTimeout(resolve, coolDownPeriod * 60 * 60 * 1000)
    );
  }
};
// 让我们开始吧
main();
