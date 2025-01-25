import { readWalletsFromCsv, writeWalletFile } from "./utils/script.js";

const inputFile = "./wallets/batch-06.csv";
const outputFile = "./wallets/batch-06.json";

const wallets = readWalletsFromCsv(inputFile);
writeWalletFile(outputFile, wallets);
