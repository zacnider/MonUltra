// Gerekli modülleri içe aktar
const ethers = require("ethers");
const colors = require("colors");
const cfonts = require("cfonts");
const fs = require('fs');

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
const UNISWAP_V2_ROUTER_ADDRESS = "0xc7E09B556E1a00cfc40b1039D6615f8423136Df7";
const WETH_ADDRESS = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";

const TOKEN_ADDRESSES = {
    "ATL ":  "0x1eA9099E3026e0b3F8Dd6FbacAa45f30fCe67431",
    "WBTC.a ": "0x617e6C7697CfF44F2545025a8Fc0199dFa6939d0",
    "WETH.a": "0xce111b02d20ad2250dcec6b71531d404fabef3e7",
    "USDT.a ": "0x7777B6562950c7AD54d0E707aaC1f4DCA8A8e95A",
    "USDC.a ": "0x3F23D172e0B0497b6aAb290B4207B58C1b4ad8E0"
    
};

const erc20Abi = [
    { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "type": "function" },
    { "constant": false, "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "approve", "outputs": [{ "name": "", "type": "bool" }], "type": "function" }
];

const MINT_TIMES_FILE = 'mint_times.json';

// Tokenlerin mint edilme zamanlarını dosyadan oku
function loadMintTimes() {
  try {
    return JSON.parse(fs.readFileSync(MINT_TIMES_FILE, 'utf8'));
  } catch (error) {
    return {};
  }
}

// Tokenlerin mint edilme zamanlarını dosyaya yaz
function saveMintTimes(mintTimes) {
  fs.writeFileSync(MINT_TIMES_FILE, JSON.stringify(mintTimes, null, 2));
}

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

async function getBalance(wallet) {
    const provider = wallet.provider;
    try {
        const monBalance = await provider.getBalance(wallet.address);
        console.log(`🧧 MON    : ${ethers.utils.formatEther(monBalance)} MON`.green);

        const wethContract = new ethers.Contract(WETH_ADDRESS, erc20Abi, wallet);
        const wethBalance = await wethContract.balanceOf(wallet.address);
        console.log(`🧧 WETH   : ${ethers.utils.formatEther(wethBalance)} WETH`.green);
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

        const initialMonBalance = await getBalance(wallet);
        
        // Mint işlemleri
        await mintTokens(wallet);

        // Swap işlemleri
        await performSwaps(wallet);

        // Son bakiye kontrolü
        console.log("\n📊 Final balances:".cyan);
        const finalMonBalance = await getBalance(wallet);
        
        const monBalanceDifference = finalMonBalance.sub(initialMonBalance);
        console.log(`MON balance change: ${ethers.utils.formatEther(monBalanceDifference)} MON`.yellow);
        
        console.log(`✅ All operations completed for this wallet!`.green.bold);
        
    } catch (error) {
        console.error(`❌ Error processing wallet: ${error.message}`.red);
    }
}

// Token mint etme fonksiyonu
async function mintTokens(wallet) {
    const mintContractAddress = "0xE87a971729D5C0696de97E37aaFe31c70F2DC814"; // Monorail contract
    const mintFunctionABI = [
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "token",
                    "type": "address"
                }
            ],
            "name": "mint",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ];

    const mintContract = new ethers.Contract(mintContractAddress, mintFunctionABI, wallet);

    const mintTimes = loadMintTimes();

    const tokensToMint = [
        { symbol: "WETH.a", address: "0xce111b02d20ad2250dcec6b71531d404fabef3e7" },
        { symbol: "WBTC.a", address: "0x617e6C7697CfF44F2545025a8Fc0199dFa6939d0" },
        { symbol: "USDT.a", address: "0x7777B6562950c7AD54d0E707aaC1f4DCA8A8e95A" },
        { symbol: "USDC.a", address: "0x3F23D172e0B0497b6aAb290B4207B58C1b4ad8E0" }
    ];

    console.log("🪙 Minting tokens...".cyan);
    for (const token of tokensToMint) {
        const currentTime = Math.floor(Date.now() / 1000);
        const tokenKey = `${wallet.address}_${token.address}`;

        if (mintTimes[tokenKey] && currentTime - mintTimes[tokenKey] < 24 * 60 * 60) {
            console.log(`Cannot mint ${token.symbol} for wallet ${wallet.address} yet. Last mint was ${Math.floor((currentTime - mintTimes[tokenKey]) / (60 * 60))} hours ago.`.yellow);
            continue;
        }

        try {
            const tx = await mintContract.mint(token.address, { gasLimit: 233585 });
            console.log(`Minting ${token.symbol} for wallet ${wallet.address}...`.green);
            console.log(`Transaction hash: ${tx.hash}`.yellow);
            console.log(`View on explorer: ${EXPLORER_URL}${tx.hash}`.blue);

            const receipt = await tx.wait();
            if (receipt.status === 1) {
                console.log(`Mint transaction for ${token.symbol} was successful for wallet ${wallet.address}. Block Number: ${receipt.blockNumber}`.green);
                mintTimes[tokenKey] = currentTime;
                saveMintTimes(mintTimes);
            } else {
                console.log(`Mint transaction for ${token.symbol} failed for wallet ${wallet.address}`.red);
            }
        } catch (error) {
            console.error(`Mint transaction failed for wallet ${wallet.address} and token ${token.symbol}: ${error.message}`.red);
        }
    }
}

async function performSwaps(wallet) {
    // Rastgele 2-3 token seç
    const tokenEntries = Object.entries(TOKEN_ADDRESSES);
    const tokenCount = Math.floor(Math.random() * 2) + 2; // 2-3 arası token
    const selectedTokens = [];
    
    // Rastgele token seçimi
    while (selectedTokens.length < tokenCount && tokenEntries.length > 0) {
        const randomIndex = Math.floor(Math.random() * tokenEntries.length);
        selectedTokens.push(tokenEntries[randomIndex]);
        tokenEntries.splice(randomIndex, 1);
    }
    
    // Güvenli bir şekilde token isimlerini göster
    const selectedTokenNames = selectedTokens.map(t => {
        if (t && t && typeof t === 'string') {
            return t.trim();
        }
        return 'Unknown';
    }).join(', ');
    
    console.log(`📊 Selected ${tokenCount} tokens for swapping: ${selectedTokenNames}`.cyan);
    console.log(" ");

    // Seçilen tokenlerle swap işlemleri
    for (const [tokenSymbol, tokenAddress] of selectedTokens) {
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
    
    console.log(" ");
    console.log(`🧿 Converting All Tokens Back to MONAD`.white.bold);
    console.log(" ");
    
    // Tokenlerden MON'a dönüş - Tüm token çiftlerini kontrol et
    for (const [tokenSymbol, tokenAddress] of Object.entries(TOKEN_ADDRESSES)) {
        if (!tokenSymbol || !tokenAddress) {
            continue; // Geçersiz token verilerini atla
        }
        await swapTokensForEth(wallet, tokenAddress, tokenSymbol);
        await sleep(2000); // Her token swap'i arasında 2 saniye bekle
    }
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

async function swapTokensForEth(wallet, tokenAddress, tokenSymbol) {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
    let balance;
    
    try {
        balance = await tokenContract.balanceOf(wallet.address);
    } catch (error) {
        console.error(`❌ Error checking balance for ${tokenSymbol}: ${error.message}`.red);
        return;
    }

    if (balance.eq(0)) {
        console.log(`⚠️ No balance for ${tokenSymbol}, skipping`.gray);
        return;
    }

    const router = new ethers.Contract(UNISWAP_V2_ROUTER_ADDRESS, [
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
            ]
        }
    ], wallet);

    try {
        console.log(`🔄 Swap ${tokenSymbol} > MON`.green);

        // Approve işlemi
        console.log(`🔄 Approving token...`.grey);
        const approveTx = await tokenContract.approve(UNISWAP_V2_ROUTER_ADDRESS, balance);
        console.log(`➡️  Approve hash: ${approveTx.hash}`.yellow);
        console.log(`🔍 Explorer: ${EXPLORER_URL}${approveTx.hash}`.cyan);
        
        // Approve onayını bekle
        await approveTx.wait();
        console.log(`✅ Approval confirmed!`.green);

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
        console.log(`➡️  Swap hash: ${tx.hash}`.yellow);
        console.log(`🔍 Explorer: ${EXPLORER_URL}${tx.hash}`.cyan);
        
        // İşlem onayını bekle
        console.log(`⏳ Waiting for confirmation...`.grey);
        await tx.wait();
        console.log(`✅ Transaction confirmed!`.green);

    } catch (error) {
        console.error(`❌ Failed: ${error.message}`.red);
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
