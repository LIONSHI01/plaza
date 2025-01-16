import { readWalletsFromCsv, writeWalletFile } from "./utils/script.js";

const inputFile = "./wallets/batch-02.csv";
const outputFile = "./wallets/batch-02.json";

const wallets = readWalletsFromCsv(inputFile);
writeWalletFile(outputFile, wallets);
