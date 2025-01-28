import { readWalletsFromCsv, writeWalletFile } from "./utils/script.js";

const inputFile = "./wallets/privasea.csv";
const outputFile = "./wallets/privasea.json";

const wallets = readWalletsFromCsv(inputFile);
writeWalletFile(outputFile, wallets);
