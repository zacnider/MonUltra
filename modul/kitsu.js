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

// Stake miktarı ve unstake bekleme süresi
const UNSTAKE_DELAY = 5 * 60 * 1000; // 5 dakika

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
            console.log(`🪫 Starting Kitsu ⏩⏩⏩⏩`.blue);
            console.log(` `);
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

function getRandomDelay(min = 60, max = 180) {
    return Math.floor(Math.random() * (max * 1000 - min * 1000 + 1) + min * 1000);
}

// Basitleştirilmiş gaz fiyatı hesaplama
async function getOptimalGasPrice(provider) {
    try {
        console.log(`🔍 Getting optimal gas price...`.yellow);
        
        // Mevcut gaz fiyatını al
        const baseGasPrice = await provider.getGasPrice();
        console.log(`⛽ Current gas price: ${ethers.utils.formatUnits(baseGasPrice, 'gwei')} gwei`.grey);
        
        // Gaz fiyatını %5 artır (işlemin hızlı onaylanması için)
        const optimizedGasPrice = baseGasPrice.mul(105).div(100);
        console.log(`✅ Using gas price: ${ethers.utils.formatUnits(optimizedGasPrice, 'gwei')} gwei (+5%)`.green);
        
        return optimizedGasPrice;
    } catch (error) {
        console.error(`❌ Error getting gas price: ${error.message}`.red);
        // Hata durumunda null döndür, çağıran fonksiyon varsayılan değer kullanacak
        return null;
    }
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

// Stake miktarını hesapla (bakiyeye göre dinamik olarak)
function calculateStakeAmount(balance) {
    // Eğer bakiye çok düşükse varsayılan değeri kullan
    if (balance.lt(ethers.utils.parseEther("0.2"))) {
        return ethers.utils.parseEther("0.01");
    }
    
    // Bakiyenin %10 ile %20'si arasında rastgele bir değer
    const minAmount = balance.mul(10).div(100); // %10
    const maxAmount = balance.mul(20).div(100); // %20
    
    // Rastgele bir yüzde seç (10-20 arası)
    const randomPercentage = 10 + Math.floor(Math.random() * 11);
    
    // Bakiyenin bu yüzdesini hesapla
    return balance.mul(randomPercentage).div(100);
}

async function stakeMON(wallet, stakeAmount) {
    try {
        console.log(`🔄 Staking: ${ethers.utils.formatEther(stakeAmount)} MON`.magenta);

        // Optimal gaz fiyatını al
        const gasPrice = await getOptimalGasPrice(wallet.provider) || await wallet.provider.getGasPrice();
        
        // Dinamik gaz limiti hesaplama
        let gasLimit;
        try {
            // Stake işlemi için tahmini gaz limitini hesapla
            const estimatedGas = await wallet.estimateGas({
                to: contractAddress,
                data: "0xd5575982", // stake function selector
                value: stakeAmount
            });
            
            // %20 buffer ekle
            gasLimit = estimatedGas.mul(120).div(100);
            console.log(`⛽ Estimated gas limit: ${estimatedGas.toString()} (using ${gasLimit.toString()} with buffer)`.grey);
        } catch (error) {
            // Tahmin edilemezse varsayılan değeri kullan
            gasLimit = ethers.BigNumber.from(150000);
            console.log(`⚠️ Could not estimate gas, using default: ${gasLimit.toString()}`.yellow);
        }

        const tx = {
            to: contractAddress,
            data: "0xd5575982",  // stake function selector
            gasLimit: gasLimit,
            gasPrice: gasPrice,
            value: stakeAmount,
        };

        console.log(`✅ Sending STAKE transaction`.green);
        const txResponse = await wallet.sendTransaction(tx);
        console.log(`➡️  Hash: ${txResponse.hash}`.yellow);
        console.log(`🔍 Explorer: ${EXPLORER_URL}${txResponse.hash}`.cyan);
        
        console.log(`⏳ Waiting for confirmation...`.grey);
        const receipt = await txResponse.wait();
        
        console.log(`✅ Stake transaction confirmed! Gas used: ${receipt.gasUsed.toString()}`.green);

        return stakeAmount;
    } catch (error) {
        console.error(`❌ Staking failed:`.red, error.message);
        throw error;
    }
}

async function unstakeGMON(wallet, amountToUnstake) {
    try {
        console.log(`🔄 Unstaking: ${ethers.utils.formatEther(amountToUnstake)} gMON`.magenta);

        // Optimal gaz fiyatını al
        const gasPrice = await getOptimalGasPrice(wallet.provider) || await wallet.provider.getGasPrice();
        
        // Function selector ve parametre hazırlama
        const functionSelector = "0x6fed1ea7";  // unstake function selector
        const paddedAmount = ethers.utils.hexZeroPad(amountToUnstake.toHexString(), 32);
        const data = functionSelector + paddedAmount.slice(2);
        
        // Dinamik gaz limiti hesaplama
        let gasLimit;
        try {
            // Unstake işlemi için tahmini gaz limitini hesapla
            const estimatedGas = await wallet.estimateGas({
                to: contractAddress,
                data: data
            });
            
            // %20 buffer ekle
            gasLimit = estimatedGas.mul(120).div(100);
            console.log(`⛽ Estimated gas limit: ${estimatedGas.toString()} (using ${gasLimit.toString()} with buffer)`.grey);
        } catch (error) {
            // Tahmin edilemezse varsayılan değeri kullan
            gasLimit = ethers.BigNumber.from(150000);
            console.log(`⚠️ Could not estimate gas, using default: ${gasLimit.toString()}`.yellow);
        }

        const tx = {
            to: contractAddress,
            data: data,
            gasLimit: gasLimit,
            gasPrice: gasPrice,
        };

        console.log(`✅ Sending UNSTAKE transaction`.green);
        const txResponse = await wallet.sendTransaction(tx);
        console.log(`➡️  Hash: ${txResponse.hash}`.yellow);
        console.log(`🔍 Explorer: ${EXPLORER_URL}${txResponse.hash}`.cyan);
        
        console.log(`⏳ Waiting for confirmation...`.grey);
        const receipt = await txResponse.wait();
        
        console.log(`✅ Unstake transaction confirmed! Gas used: ${receipt.gasUsed.toString()}`.green);
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
        
        // Stake miktarını hesapla
        const stakeAmount = calculateStakeAmount(balance);
        
        // Stake işlemini gerçekleştir
        const stakedAmount = await stakeMON(wallet, stakeAmount);
        
        // Unstake için bekle
        const waitTime = UNSTAKE_DELAY + Math.floor(Math.random() * 60000); // 5-6 dakika arası
        console.log(`⏳ Waiting ${waitTime/1000} seconds (${(waitTime/1000/60).toFixed(2)} minutes) before unstaking`.grey);
        await sleep(waitTime);
        
        // Unstake işlemini gerçekleştir
        await unstakeGMON(wallet, stakedAmount);
        
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
        
        console.log(`🚀 Starting operations with ${privateKeys.length} wallets`.cyan.bold);
        
        // Her bir cüzdan için işlemleri sırayla gerçekleştir
        for (let i = 0; i < privateKeys.length; i++) {
            const wallet = new ethers.Wallet(privateKeys[i].value, provider);
            
            // Her cüzdan için döngüyü çalıştır
            await runCycleForWallet(wallet, privateKeys[i].name);
            
            // Son cüzdan değilse, cüzdanlar arası bekleme süresi ekle
            if (i < privateKeys.length - 1) {
                const delay = getRandomDelay(60, 120); // 1-2 dakika arası
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
