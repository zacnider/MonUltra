const ethers = require("ethers");
const colors = require("colors");
const cfonts = require("cfonts");
const fs = require("fs");

const { ROUTER_CONTRACT, WMON_CONTRACT, USDC_CONTRACT, BEAN_CONTRACT, JAI_CONTRACT, ABI } = require("../abi/BEAN.js");

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

const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";
const CHAIN_ID = 10143;
const BEAN_SWAP_ROUTER_ADDRESS = ROUTER_CONTRACT; 
const WETH_ADDRESS = WMON_CONTRACT; 

// WMON adresini kaldıralım, çünkü WMON-WMON swap'i mantıksız ve hata veriyor
const TOKEN_ADDRESSES = {
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
            console.log(`🪫  Starting BeanSwap ⏩⏩⏩⏩`.blue);
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
    // Daha küçük miktarlarla deneyelim
    return ethers.utils.parseEther((Math.random() * (0.005 - 0.001) + 0.001).toFixed(6));
}

async function swapEthForTokens(wallet, tokenAddress, amountInWei, tokenSymbol) {
    const router = new ethers.Contract(BEAN_SWAP_ROUTER_ADDRESS, ABI, wallet); 

    try {
        console.log(`🔄 Swap ${ethers.utils.formatEther(amountInWei)} MON > ${tokenSymbol}`.green);

        const nonce = await wallet.getTransactionCount("pending");

        // Gas limitini artıralım
        const gasLimit = 150000;

        const tx = await router.swapExactETHForTokens(
            0, // amountOutMin değerini 0 yaparak slippage toleransını en düşük seviyeye çekelim
            [WETH_ADDRESS, tokenAddress], 
            wallet.address,
            Math.floor(Date.now() / 1000) + 60 * 20, // Deadline'ı uzatalım
            {
                value: amountInWei,
                gasLimit: gasLimit, 
                nonce: nonce 
            }
        );
        console.log(`➡️  Hash: ${tx.hash}`.yellow);
        console.log(`🔍 Explorer: ${EXPLORER_URL}${tx.hash}`.cyan);
        
        // İşlem onayını bekle
        console.log(`⏳ Waiting for confirmation...`.grey);
        
        try {
            const receipt = await tx.wait();
            if (receipt.status === 1) {
                console.log(`✅ Transaction confirmed!`.green);
            } else {
                console.log(`❌ Transaction failed!`.red);
            }
            return tx;
        } catch (error) {
            console.error(`❌ Transaction failed: ${error.message}`.red);
            return null;
        }
    } catch (error) {
        console.error(`❌ Failed swap: ${error.message}`.red);
        // İşlem başarısız olsa bile devam edelim
        return null;
    }
}

async function swapTokensForEth(wallet, tokenAddress, tokenSymbol) {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
    
    try {
        const balance = await tokenContract.balanceOf(wallet.address);

        if (balance.eq(0)) {
            console.log(`⚠️ No balance for ${tokenSymbol}, skipping`.gray);
            return null;
        }

        const router = new ethers.Contract(BEAN_SWAP_ROUTER_ADDRESS, ABI, wallet);

        console.log(`🔄 Swap ${tokenSymbol} > MON`.green);

        // Approve işlemi
        console.log(`🔄 Approving token...`.grey);
        try {
            const approveTx = await tokenContract.approve(BEAN_SWAP_ROUTER_ADDRESS, balance);
            console.log(`➡️  Approve hash: ${approveTx.hash}`.yellow);
            console.log(`🔍 Explorer: ${EXPLORER_URL}${approveTx.hash}`.cyan);
            
            // Approve onayını bekle
            await approveTx.wait();
            console.log(`✅ Approval confirmed!`.green);
        } catch (error) {
            console.error(`❌ Approval failed: ${error.message}`.red);
            return null;
        }

        const nonce = await wallet.getTransactionCount("pending");
        const gasLimit = 150000; // Gas limitini artıralım

        try {
            const tx = await router.swapExactTokensForETH(
                balance, 
                0, // amountOutMin değerini 0 yaparak slippage toleransını en düşük seviyeye çekelim
                [tokenAddress, WETH_ADDRESS], 
                wallet.address, 
                Math.floor(Date.now() / 1000) + 60 * 20, // Deadline'ı uzatalım
                {
                    gasLimit: gasLimit, 
                    nonce: nonce 
                }
            );
            console.log(`➡️  Swap hash: ${tx.hash}`.yellow);
            console.log(`🔍 Explorer: ${EXPLORER_URL}${tx.hash}`.cyan);
            
            // İşlem onayını bekle
            console.log(`⏳ Waiting for confirmation...`.grey);
            
            const receipt = await tx.wait();
            if (receipt.status === 1) {
                console.log(`✅ Transaction confirmed!`.green);
            } else {
                console.log(`❌ Transaction failed!`.red);
            }
            return tx;
        } catch (error) {
            console.error(`❌ Swap failed: ${error.message}`.red);
            return null;
        }
    } catch (error) {
        console.error(`❌ Failed: ${error.message}`.red);
        return null;
    }
}

async function getBalance(wallet) {
    try {
        const provider = wallet.provider;

        const monBalance = await provider.getBalance(wallet.address);
        console.log(`🧧 MON    : ${ethers.utils.formatEther(monBalance)} MON`.green);

        const wethContract = new ethers.Contract(WETH_ADDRESS, erc20Abi, wallet);
        const wethBalance = await wethContract.balanceOf(wallet.address);
        console.log(`🧧 WETH   : ${ethers.utils.formatEther(wethBalance)} WETH`.green);
        
        // Diğer token bakiyelerini de gösterelim
        for (const [tokenSymbol, tokenAddress] of Object.entries(TOKEN_ADDRESSES)) {
            try {
                const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
                const tokenBalance = await tokenContract.balanceOf(wallet.address);
                console.log(`🧧 ${tokenSymbol}: ${ethers.utils.formatEther(tokenBalance)} ${tokenSymbol}`.green);
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
        
        // MON bakiyesi çok düşükse işlem yapma
        if (monBalance.lt(ethers.utils.parseEther("0.001"))) {
            console.log(`⚠️ MON balance too low for operations, skipping this wallet`.yellow);
            return;
        }

        // Her token için swap işlemleri yap
        let successfulSwaps = 0;
        for (const [tokenSymbol, tokenAddress] of Object.entries(TOKEN_ADDRESSES)) {
            try {
                const ethAmount = getRandomEthAmount();
                const result = await swapEthForTokens(wallet, tokenAddress, ethAmount, tokenSymbol);
                
                if (result) {
                    successfulSwaps++;
                    // Başarılı swap sonrası biraz daha uzun bekle
                    const delay = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;
                    console.log(`⏳ Wait ${delay / 1000} seconds`.grey);
                    console.log(` `);
                    await sleep(delay);
                } else {
                    // Başarısız swap sonrası kısa bekle
                    console.log(`⏳ Wait 2 seconds before next operation`.grey);
                    await sleep(2000);
                }
            } catch (error) {
                console.error(`❌ Error during swap to ${tokenSymbol}: ${error.message}`.red);
                await sleep(2000);
            }
        }
        
        // Hiçbir swap başarılı olmadıysa, token'dan MON'a dönüşü atlayalım
        if (successfulSwaps === 0) {
            console.log(`⚠️ No successful swaps, skipping token to MON conversions`.yellow);
        } else {
            console.log(" ");
            console.log(`🧿 Converting All Tokens Back to MONAD`.white.bold);
            console.log(" ");
            
            // Tokenlerden MON'a dönüş
            for (const [tokenSymbol, tokenAddress] of Object.entries(TOKEN_ADDRESSES)) {
                try {
                    await swapTokensForEth(wallet, tokenAddress, tokenSymbol);
                    await sleep(3000); // Her token swap'i arasında 3 saniye bekle
                } catch (error) {
                    console.error(`❌ Error during swap from ${tokenSymbol}: ${error.message}`.red);
                    await sleep(2000);
                }
            }
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
