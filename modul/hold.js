// Gerekli modülleri içe aktar
const ethers = require("ethers");
const colors = require("colors");
const cfonts = require("cfonts");

const displayHeader = require("../src/banner.js");

require("dotenv").config();
displayHeader();

// Çoklu cüzdan desteği için private key'leri yükle
function loadPrivateKeys() {
    const privateKeys = [];
    
    // Tüm PRIVATE_KEY_ ile başlayan değişkenleri bul
    Object.keys(process.env).forEach(key => {
        if (key.startsWith('PRIVATE_KEY_')) {
            privateKeys.push({
                name: key,
                value: process.env[key]
            });
        }
    });
    
    // Eğer hiç private key bulunamazsa, PRIVATE_KEY'i kontrol et
    if (privateKeys.length === 0 && process.env.PRIVATE_KEY) {
        privateKeys.push({
            name: "PRIVATE_KEY",
            value: process.env.PRIVATE_KEY
        });
    }
    
    if (privateKeys.length === 0) {
        throw new Error("❌ No private keys found in .env file");
    }
    
    console.log(`✅ Loaded ${privateKeys.length} wallet(s) from .env file`.green);
    return privateKeys;
}

const privateKeys = loadPrivateKeys();

const RPC_URLS = [
    "https://testnet-rpc.monad.xyz",
    "https://monad-testnet.drpc.org"
];

const CHAIN_ID = 10143;
const UNISWAP_V2_ROUTER_ADDRESS = "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89";
const WETH_ADDRESS = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";

const TOKEN_ADDRESSES = {
    "DAK  ": "0x0f0bdebf0f83cd1ee3974779bcb7315f9808c714",
    "USDT ": "0x88b8e2161dedc77ef4ab7585569d2415a1c1055d",
    "WETH ": "0x836047a99e11f376522b447bffb6e3495dd0637c",
    "MUK  ": "0x989d38aeed8408452f0273c7d4a17fef20878e62",
    "USDC ": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    "YAKI ": "0xfe140e1dce99be9f4f15d657cd9b7bf622270c50",
    "CHOG ": "0xE0590015A873bF326bd645c3E1266d4db41C4E6B"
};

const erc20Abi = [
    { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "type": "function" },
    { "constant": false, "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "approve", "outputs": [{ "name": "", "type": "bool" }], "type": "function" }
];

async function connectToRpc() {
    for (const url of RPC_URLS) {
        try {
            console.log(`🔄 Trying to connect to RPC: ${url}`.yellow);
            const provider = new ethers.providers.JsonRpcProvider(url);
            
            // Timeout ekleyin (10 saniye)
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
            );
            
            const networkPromise = provider.getNetwork();
            
            // İlk tamamlanan promise'i bekle
            await Promise.race([networkPromise, timeoutPromise]);
            
            console.log(`✅ Connected to RPC: ${url}`.green);
            console.log(`🪫  Starting Uniswap ⏩⏩⏩⏩`.blue);
            console.log(` `);
            return provider;
        } catch (error) {
            console.log(`❌ Failed to connect to ${url}: ${error.message}`.red);
        }
    }
    throw new Error(`❌ Unable to connect to any RPC URL. Please check your internet connection or RPC endpoints.`.red);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomEthAmount() {
    return ethers.utils.parseEther((Math.random() * (0.01 - 0.0001) + 0.0001).toFixed(6));
}

async function swapEthForTokens(wallet, tokenAddress, amountInWei, tokenSymbol) {
    const router = new ethers.Contract(UNISWAP_V2_ROUTER_ADDRESS, [
        {
            "name": "swapExactETHForTokens",
            "type": "function",
            "stateMutability": "payable",
            "inputs": [
                { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" },
                { "internalType": "address[]", "name": "path", "type": "address[]" },
                { "internalType": "address", "name": "to", "type": "address" },
                { "internalType": "uint256", "name": "deadline", "type": "uint256" }
            ]
        }
    ], wallet);

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
        console.log(`🔍 Explorer: ${EXPLORER_URL}${tx.hash}`.cyan);
        
        // İşlem onayını bekle
        console.log(`⏳ Waiting for confirmation...`.grey);
        await tx.wait();
        console.log(`✅ Transaction confirmed!`.green);
        
    } catch (error) {
        console.error(`❌ Failed swap: ${error.message}`.red);
    }
}

async function getBalance(wallet) {
    const provider = wallet.provider;
    try {
        const monBalance = await provider.getBalance(wallet.address);
        console.log(`🧧 MON    : ${ethers.utils.formatEther(monBalance)} MON`.green);

        const wethContract = new ethers.Contract(WETH_ADDRESS, erc20Abi, wallet);
        const wethBalance = await wethContract.balanceOf(wallet.address);
        console.log(`🧧 WETH   : ${ethers.utils.formatEther(wethBalance)} WETH`.green);
        
        // Diğer token bakiyelerini kontrol et
        for (const [tokenSymbol, tokenAddress] of Object.entries(TOKEN_ADDRESSES)) {
            try {
                const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
                const tokenBalance = await tokenContract.balanceOf(wallet.address);
                console.log(`🧧 ${tokenSymbol}: ${ethers.utils.formatEther(tokenBalance)} ${tokenSymbol.trim()}`.green);
            } catch (error) {
                console.log(`❌ Error checking ${tokenSymbol} balance: ${error.message}`.red);
            }
        }
        
        console.log(" ");
        return monBalance;
    } catch (error) {
        console.error(`❌ Error checking balances: ${error.message}`.red);
        return ethers.BigNumber.from(0);
    }
}

async function processWallet(provider, keyObj) {
    try {
        console.log(`\n${"=".repeat(50)}`);
        console.log(`👤 Processing wallet: ${keyObj.name}`.cyan.bold);
        
        const wallet = new ethers.Wallet(keyObj.value, provider);
        console.log(`🧧 Account: ${wallet.address}`.green);

        const monBalance = await getBalance(wallet);
        
        // Tüm tokenleri kullan (rastgele seçim yerine)
        const allTokens = Object.entries(TOKEN_ADDRESSES);
        
        console.log(`📊 Processing all ${allTokens.length} tokens for swapping`.cyan);
        console.log(" ");

        // Tüm tokenlerle swap işlemleri
        for (const [tokenSymbol, tokenAddress] of allTokens) {
            // Token sembolü ve adresinin doğru olduğundan emin ol
            if (!tokenSymbol || !tokenAddress) {
                console.log(`⚠️ Invalid token data, skipping this token`.yellow);
                continue;
            }
            
            const ethAmount = getRandomEthAmount();
            await swapEthForTokens(wallet, tokenAddress, ethAmount, tokenSymbol);
            const delay = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
            console.log(`⏳ Wait ${delay / 1000} seconds`.grey);
            console.log(` `);
            await sleep(delay);
        }
        
        // Son bakiye kontrolü
        console.log("\n📊 Final balances:".cyan);
        await getBalance(wallet);
        
        console.log(`✅ All operations completed for this wallet!`.green.bold);
        
    } catch (error) {
        console.error(`❌ Error processing wallet: ${error.message}`.red);
    }
}

async function main() {
    try {
        const provider = await connectToRpc();
        
        console.log(`🚀 Starting operations with ${privateKeys.length} wallets`.cyan.bold);
        
        // Her bir cüzdan için işlemleri sırayla gerçekleştir
        for (let i = 0; i < privateKeys.length; i++) {
            await processWallet(provider, privateKeys[i]);
            
            // Son cüzdan değilse, cüzdanlar arası bekleme süresi ekle
            if (i < privateKeys.length - 1) {
                const delay = Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;
                console.log(`\n⏳ Waiting ${delay/1000} seconds before processing next wallet...`.yellow);
                await sleep(delay);
            }
        }
        
        console.log(`\n${"=".repeat(50)}`);
        console.log(`🎉 All wallets processed successfully!`.green.bold);
        
    } catch (error) {
        console.error(`❌ Error in main function: ${error.message}`.red);
    }
}

main().catch(error => {
    console.error(`❌ Unhandled error: ${error.message}`.red);
    console.error(error);
});
