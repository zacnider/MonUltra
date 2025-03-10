const { ethers } = require("ethers");
const colors = require("colors");
const cfonts = require("cfonts");

const displayHeader = require("../src/banner.js");

require("dotenv").config();
displayHeader();

// Çoklu cüzdan için private key'leri .env dosyasından oku
const privateKeys = [];
let i = 1;
while (true) {
    const key = process.env[`PRIVATE_KEY_${i}`];
    if (!key) break;
    privateKeys.push(key);
    i++;
}

// Eğer PRIVATE_KEY_1, PRIVATE_KEY_2 vs bulunamazsa, PRIVATE_KEY'i kontrol et
if (privateKeys.length === 0) {
    const singleKey = process.env.PRIVATE_KEY;
    if (singleKey) {
        privateKeys.push(singleKey);
    } else {
        throw new Error("No private keys found in .env file. Please add PRIVATE_KEY_1, PRIVATE_KEY_2, etc. or at least PRIVATE_KEY");
    }
}

console.log(`🔐 Loaded ${privateKeys.length} wallet(s) from .env file`.cyan);

// Monad testağı RPC URL'leri
const RPC_URLS = [
    "https://testnet-rpc.monad.xyz",
    "https://monad-testnet.drpc.org"
];

const CHAIN_ID = 10143; // Monad Testnet Chain ID
const TAYA_ROUTER_ADDRESS = "0x4ba4bE2FB69E2aa059A551Ce5d609Ef5818Dd72F"; // Taya.fi router adresi - doğru adresle değiştirin
const WMON_ADDRESS = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701"; // Wrapped MON adresi

const TOKEN_ADDRESSES = {
    "USDT ": "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D", //  USDT adresi 
    "WETH  ": "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37", //  WETH adresi

};

const erc20Abi = [
    { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "type": "function" },
    { "constant": false, "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "approve", "outputs": [{ "name": "", "type": "bool" }], "type": "function" },
    { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "name": "", "type": "uint8" }], "type": "function" }
];

// Taya.fi Router ABI - Uniswap V2 benzeri olduğunu varsayıyoruz
const tayaRouterAbi = [
    {
        "name": "swapExactETHForTokens",
        "type": "function",
        "stateMutability": "payable",
        "inputs": [
            { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" },
            { "internalType": "address[]", "name": "path", "type": "address[]" },
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "uint256", "name": "deadline", "type": "uint256" }
        ],
        "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }]
    },
    {
        "name": "swapExactTokensForETH",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
            { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" },
            { "internalType": "address[]", "name": "path", "type": "address[]" },
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "uint256", "name": "deadline", "type": "uint256" }
        ],
        "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }]
    }
];

async function connectToRpc() {
    for (const url of RPC_URLS) {
        try {
            const provider = new ethers.providers.JsonRpcProvider(url);
            await provider.getNetwork();
            console.log(`🪫  Starting Taya.fi ⏩⏩⏩⏩`.blue);
            console.log(` `);
            return provider;
        } catch (error) {
            console.log(`Failed to connect to ${url}, trying another...`);
        }
    }
    throw new Error(`❌ Unable to connect to Monad testnet`.red);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomMonAmount() {
    return ethers.utils.parseEther((Math.random() * (0.01 - 0.0001) + 0.0001).toFixed(6));
}

// Nonce yönetimi için yardımcı fonksiyon
async function getNonce(wallet, increment = 0) {
    try {
        const nonce = await wallet.provider.getTransactionCount(wallet.address, "latest");
        return nonce + increment;
    } catch (error) {
        console.error(`Error getting nonce: ${error.message}`);
        throw error;
    }
}

// İşlemin tamamlanmasını bekleyen fonksiyon
async function waitForTransaction(tx) {
    try {
        console.log(`⏳ Waiting for transaction: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
        return receipt;
    } catch (error) {
        console.error(`❌ Transaction failed: ${error.message}`);
        throw error;
    }
}

async function swapMonForTokens(wallet, tokenAddress, amountInWei, tokenSymbol) {
    const router = new ethers.Contract(TAYA_ROUTER_ADDRESS, tayaRouterAbi, wallet);

    try {
        console.log(`🔄 Swap ${ethers.utils.formatEther(amountInWei)} MON > ${tokenSymbol}`.green);

        // En güncel nonce'u al
        const nonce = await getNonce(wallet);
        console.log(`Using nonce: ${nonce}`);

        const tx = await router.swapExactETHForTokens(
            0, // minimum çıkış miktarı (slippage koruması kapalı)
            [WMON_ADDRESS, tokenAddress], 
            wallet.address,
            Math.floor(Date.now() / 1000) + 60 * 10, // 10 dakika geçerli
            {
                value: amountInWei,
                gasLimit: 210000,
                nonce: nonce 
            }
        );
        console.log(`➡️  Hash: ${tx.hash}`.yellow);
        
        // İşlemin tamamlanmasını bekle
        await waitForTransaction(tx);
        return true;
    } catch (error) {
        console.error(`❌ Failed swap: ${error.message}`.red);
        return false;
    }
}

async function swapTokensForMon(wallet, tokenAddress, tokenSymbol) {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
    let balance;
    
    try {
        balance = await tokenContract.balanceOf(wallet.address);
        
        if (balance.eq(0)) {
            console.log(`❌ No balance ${tokenSymbol}, skip`.gray);
            return false;
        }
    } catch (error) {
        console.error(`❌ Error checking ${tokenSymbol} balance: ${error.message}`.red);
        return false;
    }

    const router = new ethers.Contract(TAYA_ROUTER_ADDRESS, tayaRouterAbi, wallet);

    try {
        console.log(`🔄 Swap ${tokenSymbol} > MON`.green);

        // Approve token spending
        const approveNonce = await getNonce(wallet);
        console.log(`Using nonce for approval: ${approveNonce}`);
        
        const approveTx = await tokenContract.approve(TAYA_ROUTER_ADDRESS, balance, {
            gasLimit: 100000,
            nonce: approveNonce
        });
        console.log(`➡️  Approval hash: ${approveTx.hash}`.yellow);
        
        // Approve işleminin tamamlanmasını bekle
        await waitForTransaction(approveTx);

        // Güncel nonce'u al
        const swapNonce = await getNonce(wallet);
        console.log(`Using nonce for swap: ${swapNonce}`);

        const tx = await router.swapExactTokensForETH(
            balance, 
            0, // minimum çıkış miktarı (slippage koruması kapalı)
            [tokenAddress, WMON_ADDRESS], 
            wallet.address, 
            Math.floor(Date.now() / 1000) + 60 * 10, // 10 dakika geçerli
            {
                gasLimit: 210000, 
                nonce: swapNonce 
            }
        );
        console.log(`➡️  Swap hash: ${tx.hash}`.yellow);
        
        // Swap işleminin tamamlanmasını bekle
        await waitForTransaction(tx);
        return true;
    } catch (error) {
        console.error(`❌ Failed: ${error.message}`.red);
        return false;
    }
}

async function getBalance(wallet) {
    const provider = wallet.provider;

    const monBalance = await provider.getBalance(wallet.address);
    console.log(`🧧 MON    : ${ethers.utils.formatEther(monBalance)} MON`.green);

    const wmonContract = new ethers.Contract(WMON_ADDRESS, erc20Abi, wallet);
    const wmonBalance = await wmonContract.balanceOf(wallet.address);
    console.log(`🧧 WMON   : ${ethers.utils.formatEther(wmonBalance)} WMON`.green);
    console.log(" ");
}

async function processWallet(provider, privateKey, index) {
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(`\n👛 Wallet ${index + 1}: ${wallet.address}`.cyan);
    await getBalance(wallet);

    // MON'dan tokenlere swap yap
    for (const [tokenSymbol, tokenAddress] of Object.entries(TOKEN_ADDRESSES)) {
        const monAmount = getRandomMonAmount();
        const success = await swapMonForTokens(wallet, tokenAddress, monAmount, tokenSymbol);
        
        if (success) {
            const delay = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
            console.log(`⏳ Wait ${delay / 1000} seconds`.grey);
            await sleep(delay);
        } else {
            // Başarısız işlemden sonra biraz daha uzun bekle
            const delay = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
            console.log(`⏳ Waiting longer after failed transaction: ${delay / 1000} seconds`.grey);
            await sleep(delay);
        }
    }

    console.log(" ");
    console.log(`🧿 All Token Reverse to MONAD`.white);
    console.log(" ");
    
    // Tokenleri MON'a çevir
    for (const [tokenSymbol, tokenAddress] of Object.entries(TOKEN_ADDRESSES)) {
        const success = await swapTokensForMon(wallet, tokenAddress, tokenSymbol);
        
        if (success) {
            const delay = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
            console.log(`⏳ Wait ${delay / 1000} seconds`.grey);
            await sleep(delay);
        } else {
            // Başarısız işlemden sonra biraz daha uzun bekle
            const delay = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;
            console.log(`⏳ Skipping to next token...`.grey);
            await sleep(delay);
        }
    }
    
    // Cüzdanlar arası bekleme süresi
    const walletDelay = Math.floor(Math.random() * (15000 - 10000 + 1)) + 10000;
    console.log(`\n⏳ Waiting ${walletDelay / 1000} seconds before next wallet...`.cyan);
    await sleep(walletDelay);
}

async function main() {
    try {
        const provider = await connectToRpc();
        
        console.log(`🔐 Total wallets: ${privateKeys.length}`.cyan);
        console.log(`🌐 Network: Monad Testnet (Chain ID: ${CHAIN_ID})`.cyan);
        console.log(`🏦 DEX: Taya.fi`.cyan);
        console.log(` `);
        
        for (let i = 0; i < privateKeys.length; i++) {
            await processWallet(provider, privateKeys[i], i);
        }
        
        console.log(`\n✅ All wallet operations completed successfully!`.brightGreen);
        
    } catch (error) {
        console.error(`\n❌ FATAL ERROR:`.red, error);
        process.exit(1);
    }
}

main().catch(console.error);
