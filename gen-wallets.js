import { readWalletsFromCsv, writeWalletFile } from "./utils/script.js";

const inputFile = "./wallets/plaza-batch-07.csv";
const outputFile = "./wallets/plaza-batch-07.json";

const wallets = readWalletsFromCsv(inputFile);
writeWalletFile(outputFile, wallets);
