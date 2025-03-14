const { ethers } = require("ethers");
const colors = require("colors");
const cfonts = require("cfonts");
const fs = require("fs");

// Sabitler
const ROUTER_CONTRACT = "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89";
const WMON_CONTRACT = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
const USDC_CONTRACT = "0x62534E4bBD6D9ebAC0ac99aeaa0aa48E56372df0";
const BEAN_CONTRACT = "0x268E4E24E0051EC27b3D27A95977E71cE6875a05";
const JAI_CONTRACT = "0x70F893f65E3C1d7f82aad72f71615eb220b74D10";

// ABI (Router ABI'sini buraya ekleyin)
const ABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
];

const displayHeader = require("../src/banner.js");

require("dotenv").config();
displayHeader();

// Çoklu cüzdan için özel fonksiyon
function getPrivateKeys() {
    const privateKeys = [];
    let index = 1;
    
    while (true) {
        const key = process.env[`PRIVATE_KEY_${index}`];
        if (!key) break;
        
        if (key.trim() !== "") {
            privateKeys.push(key.trim());
        }
        index++;
    }

    if (privateKeys.length === 0) {
        throw new Error("No Private Keys found in .env file");
    }

    return privateKeys;
}

const RPC_URLS = [
    "https://testnet-rpc.monorail.xyz",
    "https://testnet-rpc.monad.xyz",
    "https://monad-testnet.drpc.org"
];

const CHAIN_ID = 10143;
const BEAN_SWAP_ROUTER_ADDRESS = ROUTER_CONTRACT; 
const WETH_ADDRESS = WMON_CONTRACT; 

const TOKEN_ADDRESSES = {
    "WMON": WMON_CONTRACT, 
    "USDC": USDC_CONTRACT, 
    "BEAN": BEAN_CONTRACT,  
    "JAI ": JAI_CONTRACT
};

const erc20Abi = [
    { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "type": "function" },
    { "constant": false, "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "approve", "outputs": [{ "name": "", "type": "bool" }], "type": "function" }
];

async function connectToRpc() {
    for (const url of RPC_URLS) {
        try {
            const provider = new ethers.providers.JsonRpcProvider(url);
            await provider.getNetwork();
            console.log(`🪫  Starting BeanSwap ⏩⏩⏩⏩`.blue);
            console.log(` `);
            return provider;
        } catch (error) {
            console.log(`Failed to connect to ${url}, trying another...`);
        }
    }
    throw new Error(`❌ Unable to connect`.red);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomEthAmount() {
    return ethers.utils.parseEther((Math.random() * (0.01 - 0.0001) + 0.0001).toFixed(6));
}

async function swapEthForTokens(wallet, tokenAddress, amountInWei, tokenSymbol) {
    const router = new ethers.Contract(BEAN_SWAP_ROUTER_ADDRESS, ABI, wallet); 

    try {
        console.log(`🔄 Swap ${ethers.utils.formatEther(amountInWei)} MON > ${tokenSymbol}`.green);

        const nonce = await wallet.getTransactionCount("pending");

        const tx = await router.swapExactETHForTokens(
            0, 
            [WETH_ADDRESS, tokenAddress], 
            wallet.address,
            Math.floor(Date.now() / 1000) + 60 * 10, 
            {
                value: amountInWei,
                gasLimit: 210000, 
                nonce: nonce 
            }
        );
        console.log(`➡️  Hash: ${tx.hash}`.yellow);
        
        // İşlem sonucunu bekle
        const receipt = await tx.wait(1);
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`.green);
    } catch (error) {
        console.error(`❌ Failed swap: ${error.message}`.red);
    }
}

async function swapTokensForEth(wallet, tokenAddress, tokenSymbol) {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
    const balance = await tokenContract.balanceOf(wallet.address);

    if (balance.eq(0)) {
        console.log(`❌ No balance ${tokenSymbol}, skip`.black);
        return;
    }

    const router = new ethers.Contract(BEAN_SWAP_ROUTER_ADDRESS, ABI, wallet);

    try {
        console.log(`🔄 Swap ${tokenSymbol} > MON`.green);

        const approveTx = await tokenContract.approve(BEAN_SWAP_ROUTER_ADDRESS, balance);
        await approveTx.wait(1);
        console.log(`✅ Approved ${tokenSymbol}`.green);

        const nonce = await wallet.getTransactionCount("pending");

        const tx = await router.swapExactTokensForETH(
            balance, 
            0, 
            [tokenAddress, WETH_ADDRESS], 
            wallet.address, 
            Math.floor(Date.now() / 1000) + 60 * 10, 
            {
                gasLimit: 210000, 
                nonce: nonce 
            }
        );
        console.log(`➡️  Hash ${tx.hash}`.yellow);

        // İşlem sonucunu bekle
        const receipt = await tx.wait(1);
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`.green);

        const delay = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
        console.log(`⏳ Wait ${delay / 1000} seconds`.grey);
        console.log(` `);

        await sleep(delay);
    } catch (error) {
        console.error(`❌ Failed: ${error.message}`.red);
    }
}

async function getBalance(wallet) {
    const provider = wallet.provider;

    const monBalance = await provider.getBalance(wallet.address);
    console.log(`🧧 MON    : ${ethers.utils.formatEther(monBalance)} MON`.green);

    const wethContract = new ethers.Contract(WETH_ADDRESS, erc20Abi, wallet);
    const wethBalance = await wethContract.balanceOf(wallet.address);
    console.log(`🧧 WETH   : ${ethers.utils.formatEther(wethBalance)} WETH`.green);
    console.log(" ");
}

// Shuffle fonksiyonu
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function processWallet(wallet) {
    console.log(`🧧 Account: ${wallet.address}`.green);

    await getBalance(wallet);

    for (const [tokenSymbol, tokenAddress] of Object.entries(TOKEN_ADDRESSES)) {
        const ethAmount = getRandomEthAmount();
        await swapEthForTokens(wallet, tokenAddress, ethAmount, tokenSymbol);
        const delay = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
        console.log(`⏳ Wait ${delay / 1000} seconds`.grey);
        console.log(` `);
        await sleep(delay);
    }

    console.log(" ");
    console.log(`🧿 All Token Reverse to MONAD`.white);
    console.log(" ");
    
    for (const [tokenSymbol, tokenAddress] of Object.entries(TOKEN_ADDRESSES)) {
        await swapTokensForEth(wallet, tokenAddress, tokenSymbol);
    }
}

async function main() {
    const provider = await connectToRpc();
    
    // Tüm private keyler alınıyor
    const privateKeys = getPrivateKeys();
    
    // Private keyler karıştırılıyor
    const shuffledPrivateKeys = shuffleArray(privateKeys);

    // Her bir cüzdan için işlem
    for (const privateKey of shuffledPrivateKeys) {
        try {
            const wallet = new ethers.Wallet(privateKey, provider);
            
            console.log("\n" + "=".repeat(50));
            console.log(`🚀 Processing Wallet: ${wallet.address}`.blue);
            console.log("=".repeat(50) + "\n");

            await processWallet(wallet);

            // Cüzdanlar arası rastgele bekleme
            const interWalletDelay = Math.floor(Math.random() * (60000 - 30000 + 1)) + 30000;
            console.log(`⏳ Waiting ${interWalletDelay / 1000} seconds before next wallet`.grey);
            await sleep(interWalletDelay);

        } catch (error) {
            console.error(`❌ Error processing wallet: ${error.message}`.red);
        }
    }
}

main().catch(console.error);
