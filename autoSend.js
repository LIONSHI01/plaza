import {
  sendFaucet,
  askQuestion,
  readWallets,
  readWalletsFromPath,
} from "./utils/script.js";
import banner from "./utils/banner.js";
import log from "./utils/logger.js";

const WALLET_FILE_PATH = "./wallets/batch-07.json";

async function faucet() {
  log.warn(banner);
  log.warn(`=== 本脚本用于Base主网自动发送 ===`);
  log.warn(`此脚本将从您的主钱包向wallets.json文件中的多个钱包分发资金(ETH)。`);
  log.warn(`请确保您的主钱包中有足够的ETH来支付交易费用和分发的总金额。`);

  const wallets = readWalletsFromPath(WALLET_FILE_PATH);
  if (wallets.length === 0) {
    log.error(`在wallets.json中未找到钱包。请添加钱包以继续。`);
    return;
  }
  log.info(`从文件中加载了${wallets.length}个钱包。`);

  // 输入水龙头金额
  const faucetMinAmount = await askQuestion(
    "请输入要发送到每个钱包的最小ETH金额（例如，0.0003）："
  );
  const faucetMaxAmount = await askQuestion(
    "请输入要发送到每个钱包的最大ETH金额（例如，0.0003）："
  );
  // 產生範圍內隨機金額
  const faucetAmount = (
    Math.random() *
      (parseFloat(faucetMaxAmount) - parseFloat(faucetMinAmount)) +
    parseFloat(faucetMinAmount)
  ).toFixed(6);
  const amount = parseFloat(faucetAmount);
  if (isNaN(amount) || amount <= 0) {
    log.error(`输入的金额无效。请提供一个有效的正数。`);
    return;
  }
  log.info(`您选择向每个钱包发送${faucetAmount} ETH。`);

  // 询问发送者钱包的私钥
  const pvKey = await askQuestion(
    "请输入在Base主网上拥有ETH的钱包的私钥:\n此钱包将用于初始转账: "
  );
  if (!pvKey) {
    log.error(`未提供私钥。请提供有效的私钥以继续。`);
    return;
  }
  log.info(`已提供私钥。继续进行设置。`);

  // 确认要发送的总ETH
  const totalAmount = amount * wallets.length;
  log.warn(`您即将向${wallets.length}个钱包发送总共${totalAmount} ETH。`);
  const isConfirmed = await askQuestion(`您确定要继续此操作吗？ (y/n): `);

  if (isConfirmed.toLowerCase() !== "y") {
    log.warn(`用户取消操作。`);
    return;
  }

  // 开始发送资金
  log.info(`=== 开始资金分发 ===`);
  try {
    // 使用主私钥向第一个钱包发送资金
    log.info(
      `从您的主要钱包向第一个钱包(${wallets[0].address})发送${totalAmount} ETH。`
    );
    const sendtoWallet = await sendFaucet(
      totalAmount.toFixed(6).toString(),
      wallets[0].address,
      pvKey
    );

    if (!sendtoWallet) {
      log.error(`发送资金到第一个钱包失败`);
      return;
    } else {
      log.info(`成功发送${totalAmount} ETH到${wallets[0].address}。`);
    }

    // 从钱包到钱包进行其他转账
    for (let i = 0; i < wallets.length - 1; i++) {
      const senderWallet = wallets[i];
      const receiptWallet = wallets[i + 1];
      const amountToSend = amount * (wallets.length - (i + 1));

      log.info(
        `===[${i + 1}]: 从钱包${senderWallet.address}向钱包${
          receiptWallet.address
        }转账${amountToSend} ETH ===`
      );
      const sendToWallets = await sendFaucet(
        amountToSend.toFixed(6).toString(),
        receiptWallet.address,
        senderWallet.privateKey
      );
      if (!sendToWallets) {
        log.error(`向${receiptWallet.address}发送资金失败`);
        return;
      } else {
        log.info(
          `成功从${senderWallet.address}向${receiptWallet.address}转账${amountToSend} ETH。`
        );
      }

      // Delay 2 second to avoid spam RPC
      await new Promise((resolve) => setTimeout(resolve, 2 * 1000));
    }

    log.info(`=== 资金分发完成 ===`);
    log.info(`所有钱包已成功充资！`);
  } catch (error) {
    log.error(`操作过程中发生错误: ${error.message}`);
  }
}

faucet();
