import { ethers } from 'ethers';
import { askQuestion, readWallets } from "./utils/script.js";
import banner from "./utils/banner.js";
import log from "./utils/logger.js";

async function sendFaucet(faucetAmount, addressRecipient, pvkey) {
    log.info(`向地址 ${addressRecipient} 发送水龙头 ${faucetAmount}`);
    try {
        const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
        const wallet = new ethers.Wallet(pvkey, provider);
        const feeData = await provider.getFeeData();

        const tx = {
            to: addressRecipient,
            value: ethers.parseEther(faucetAmount),
            gasLimit: 21000,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || feeData.gasPrice,
            maxFeePerGas: feeData.maxFeePerGas || feeData.gasPrice
        };

        const txResponse = await wallet.sendTransaction(tx);
        log.info(`交易已发送到 ${addressRecipient}: https://sepolia.basescan.org/tx/${txResponse.hash}`);

        await txResponse.wait();
        return txResponse.hash;
    } catch (error) {
        log.error("发送水龙头时发生错误:", error);
        return null;
    }
}

async function faucet() {
    log.warn(banner);
    log.warn(`=== 此脚本适用于 Base Sepolia 测试网络 ===`);
    log.warn(`此脚本将向 wallets.json 文件中的钱包分配 (ETH) 测试网络代币。`);

    const wallets = readWallets();
    if (wallets.length === 0) {
        log.error(`在 wallets.json 中未找到钱包。请添加钱包以继续。`);
        return;
    }
    log.info(`从文件中加载了 ${wallets.length} 个钱包。`);

    // 输入水龙头金额
    const faucetAmount = await askQuestion('请输入要发送给每个钱包的 ETH 数量 (例如，0.001): ');
    const amount = parseFloat(faucetAmount);
    if (isNaN(amount) || amount <= 0) {
        log.error(`输入的金额无效。请提供一个有效的正数。`);
        return;
    }
    log.info(`您选择向每个钱包发送 ${faucetAmount} ETH。`);

    // 询问发送者钱包的私钥
    const pvKey = await askQuestion('输入在 Base Sepolia 测试网络上拥有 ETH 的钱包的私钥:\n这个钱包将用于初始转账: ');
    if (!pvKey) {
        log.error(`未提供私钥。请提供有效的私钥以继续。`);
        return;
    }
    log.info(`已提供私钥。继续设置。`);

    // 确认发送的总 ETH 数量
    const totalAmount = amount * wallets.length;
    log.warn(`您即将向 ${wallets.length} 个钱包发送总共 ${totalAmount} ETH。`);
    const isConfirmed = await askQuestion(`您确定要执行此操作吗？ (y/n): `);

    if (isConfirmed.toLowerCase() !== 'y') {
        log.warn(`操作已被用户取消。`);
        return;
    }

    // 开始发送资金
    log.info(`=== 开始分配资金 ===`);
    try {
        // 使用主私钥向第一个钱包发送资金
        log.info(`从您的主要钱包向第一个钱包 (${wallets[0].address}) 发送 ${totalAmount} ETH。`);
        const sendtoWallet = await sendFaucet(totalAmount.toFixed(6).toString(), wallets[0].address, pvKey);

        if (!sendtoWallet) {
            log.error(`向第一个钱包发送资金失败`);
            return;
        } else {
            log.info(`成功向 ${wallets[0].address} 发送了 ${totalAmount} ETH。`);
        }

        // 进行其他钱包间的转账
        for (let i = 0; i < wallets.length - 1; i++) {
            const senderWallet = wallets[i];
            const receiptWallet = wallets[i + 1];
            const amountToSend = amount * (wallets.length - (i + 1));

            log.info(`=== 从钱包 ${senderWallet.address} 向钱包 ${receiptWallet.address} 转账 ${amountToSend} ETH ===`);
            const sendToWallets = await sendFaucet(amountToSend.toFixed(6).toString(), receiptWallet.address, senderWallet.privateKey);
            if (!sendToWallets) {
                log.error(`向 ${receiptWallet.address} 发送资金失败`);
                return;
            } else {
                log.info(`成功从 ${senderWallet.address} 向 ${receiptWallet.address} 转账了 ${amountToSend} ETH。`);
            }
        }

        log.info(`=== 资金分配完成 ===`);
        log.info(`所有钱包已成功充值！`);
    } catch (error) {
        log.error(`操作过程中发生错误: ${error.message}`);
    }
}

faucet();
