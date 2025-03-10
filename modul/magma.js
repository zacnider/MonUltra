require("dotenv").config();
const ethers = require("ethers");
const colors = require("colors");
const cfonts = require("cfonts");
const displayHeader = require("../src/banner.js");

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
const contractAddress = "0x2c9C959516e9AAEdB2C748224a41249202ca8BE7";
const gasLimitStake = 150000;
const gasLimitUnstake = 150000;

// Rastgele stake miktarı üret
function getRandomAmount() {
    const min = 0.01;
    const max = 0.05;
    const randomAmount = Math.random() * (max - min) + min;
    return ethers.utils.parseEther(randomAmount.toFixed(4));
}

// Rastgele bekleme süresi üret (1-3 dakika arası)
function getRandomDelay(min = 60, max = 180) {
    return Math.floor(Math.random() * (max * 1000 - min * 1000 + 1) + min * 1000);
}

// Rastgele unstake bekleme süresi (orjinal kodda 73383 ms)
function getRandomUnstakeDelay() {
    // 1-2 dakika arası rastgele sapma ekle
    const baseDelay = 73383; // Orjinal bekleme süresi
    const randomOffset = Math.floor(Math.random() * 60000) + 60000; // 60-120 saniye arası
    return baseDelay + randomOffset;
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
            return provider;
        } catch (error) {
            console.log(`❌ Failed to connect to ${url}: ${error.message}`.red);
        }
    }
    throw new Error(`❌ Unable to connect to any RPC URL. Please check your internet connection or RPC endpoints.`.red);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Hesap bakiyesini kontrol et
async function checkBalance(wallet) {
    try {
        const balance = await wallet.provider.getBalance(wallet.address);
        console.log(`🧧 MON Balance: ${ethers.utils.formatEther(balance)} MON`.green);
        return balance;
    } catch (error) {
        console.error(`❌ Error checking balance: ${error.message}`.red);
        return ethers.BigNumber.from(0);
    }
}

// Gaz fiyatını optimize et
async function getOptimalGasPrice(provider) {
    try {
        // Mevcut gaz fiyatını al
        const baseGasPrice = await provider.getGasPrice();
        // %5 artır
        const optimizedGasPrice = baseGasPrice.mul(105).div(100);
        console.log(`⛽ Gas Price: ${ethers.utils.formatUnits(optimizedGasPrice, 'gwei')} gwei`.grey);
        return optimizedGasPrice;
    } catch (error) {
        console.log(`⚠️ Could not optimize gas price: ${error.message}`.yellow);
        return null;
    }
}

async function stakeMON(wallet) {
    try {
        const stakeAmount = getRandomAmount();
        console.log(`🪫  Starting Magma for ${wallet.address.substr(0, 6)}...${wallet.address.substr(-4)}`.blue);
        console.log(` `);
        console.log(`🔄 Magma stake: ${ethers.utils.formatEther(stakeAmount)} MON`.magenta);

        // Gas fiyatını optimize et
        const gasPrice = await getOptimalGasPrice(wallet.provider) || await wallet.provider.getGasPrice();

        const tx = {
            to: contractAddress,
            data: "0xd5575982",
            gasLimit: ethers.utils.hexlify(gasLimitStake),
            gasPrice: gasPrice,
            value: stakeAmount,
        };

        console.log(`🔄 STAKE`.green);
        const txResponse = await wallet.sendTransaction(tx);
        console.log(`➡️  Hash: ${txResponse.hash}`.yellow);
        console.log(`🔍 Explorer: ${EXPLORER_URL}${txResponse.hash}`.cyan);
        console.log(`🔄 Wait Confirmation`.green);
        const receipt = await txResponse.wait();
        console.log(`✅ Stake DONE (Gas used: ${receipt.gasUsed.toString()})`.green);

        return stakeAmount;
    } catch (error) {
        console.error(`❌ Staking failed:`.red, error.message);
        throw error;
    }
}

async function unstakeGMON(wallet, amountToUnstake) {
    try {
        console.log(`🔄 Unstake: ${ethers.utils.formatEther(amountToUnstake)} gMON`.green);

        // Gas fiyatını optimize et
        const gasPrice = await getOptimalGasPrice(wallet.provider) || await wallet.provider.getGasPrice();

        const functionSelector = "0x6fed1ea7";
        const paddedAmount = ethers.utils.hexZeroPad(amountToUnstake.toHexString(), 32);
        const data = functionSelector + paddedAmount.slice(2);

        const tx = {
            to: contractAddress,
            data: data,
            gasLimit: ethers.utils.hexlify(gasLimitUnstake),
            gasPrice: gasPrice,
        };

        console.log(`🔄 Unstake`.red);
        const txResponse = await wallet.sendTransaction(tx);
        console.log(`➡️ Hash: ${txResponse.hash}`.yellow);
        console.log(`🔍 Explorer: ${EXPLORER_URL}${txResponse.hash}`.cyan);
        console.log(`🔄 Wait Confirmation`.green);
        const receipt = await txResponse.wait();
        console.log(`✅ Unstake DONE (Gas used: ${receipt.gasUsed.toString()})`.green);
    } catch (error) {
        console.error(`❌ Unstaking failed:`.red, error.message);
        throw error;
    }
}

async function runCycleForWallet(wallet, walletName) {
    try {
        console.log(`\n${"=".repeat(50)}`);
        console.log(`👤 Processing wallet: ${walletName}`.cyan.bold);
        console.log(`🧧 Account: ${wallet.address}`.green);

        // Bakiyeyi kontrol et
        const balance = await checkBalance(wallet);
        
        // Eğer bakiye çok düşükse işlem yapma
        if (balance.lt(ethers.utils.parseEther("0.01"))) {
            console.log(`⚠️ MON balance too low for operations, skipping this wallet`.yellow);
            return;
        }

        // Stake işlemi
        const stakeAmount = await stakeMON(wallet);
        
        // Unstake için bekle (orijinal kodda 73383 ms + rastgele ek süre)
        const waitTime = getRandomUnstakeDelay();
        console.log(`🔄 Waiting ${waitTime/1000} seconds (${(waitTime/1000/60).toFixed(2)} minutes) before unstaking`.yellow);
        await sleep(waitTime);
        
        // Unstake işlemi
        await unstakeGMON(wallet, stakeAmount);
        
        // Son bakiyeyi kontrol et
        console.log(`\n📊 Final balance:`.cyan);
        await checkBalance(wallet);
        
        console.log(`✅ All operations completed for this wallet!`.green.bold);
    } catch (error) {
        console.error(`❌ Error processing wallet ${walletName}:`.red, error.message);
    }
}

async function main() {
    try {
        const provider = await connectToRpc();
        
        console.log(`🚀 Starting Magma operations with ${privateKeys.length} wallets`.cyan.bold);
        
        // Her bir cüzdan için işlemleri sırayla gerçekleştir
        for (let i = 0; i < privateKeys.length; i++) {
            const wallet = new ethers.Wallet(privateKeys[i].value, provider);
            
            // Her cüzdan için döngüyü çalıştır
            await runCycleForWallet(wallet, privateKeys[i].name);
            
            // Son cüzdan değilse, cüzdanlar arası bekleme süresi ekle
            if (i < privateKeys.length - 1) {
                const delay = getRandomDelay(60, 180); // 1-3 dakika arası
                console.log(`\n⏳ Waiting ${delay/1000} seconds (${(delay/1000/60).toFixed(2)} minutes) before processing next wallet...`.yellow);
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
    console.error(`❌ Unhandled error:`.red, error);
});
