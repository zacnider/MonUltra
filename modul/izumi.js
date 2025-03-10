require("dotenv").config();
const { ethers } = require("ethers");
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

const EXPLORER_URL = "https://testnet.monadexplorer.com/tx";
const WMON_CONTRACT = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";

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
            console.log(`🪫 Starting Izumi ⏩⏩⏩⏩`.blue);
            console.log(` `);
            return provider;
        } catch (error) {
            console.log(`❌ Failed to connect to ${url}: ${error.message}`.red);
        }
    }
    throw new Error(`❌ Unable to connect to any RPC URL. Please check your internet connection or RPC endpoints.`.red);
}

function getRandomAmount() {
    const min = 0.01;
    const max = 0.05;
    return ethers.utils.parseEther((Math.random() * (max - min) + min).toFixed(4));
}

function getRandomDelay(min = 60, max = 180) {
    return Math.floor(Math.random() * (max * 1000 - min * 1000 + 1) + min * 1000);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkBalance(wallet) {
    try {
        const provider = wallet.provider;
        const balance = await provider.getBalance(wallet.address);
        
        console.log(`🧧 MON Balance: ${ethers.utils.formatEther(balance)} MON`.green);
        
        const wmonContract = new ethers.Contract(
            WMON_CONTRACT,
            ["function balanceOf(address) view returns (uint256)"],
            provider
        );
        
        const wmonBalance = await wmonContract.balanceOf(wallet.address);
        console.log(`🧧 WMON Balance: ${ethers.utils.formatEther(wmonBalance)} WMON`.green);
        
        return { monBalance: balance, wmonBalance };
    } catch (error) {
        console.error(`❌ Error checking balances: ${error.message}`.red);
        return { monBalance: ethers.BigNumber.from(0), wmonBalance: ethers.BigNumber.from(0) };
    }
}

// Dinamik gaz limiti hesaplayan fonksiyon
async function getDynamicGasLimit(wallet, operation, amount = null) {
    try {
        const contract = new ethers.Contract(
            WMON_CONTRACT,
            ["function deposit() public payable", "function withdraw(uint256 amount) public"],
            wallet
        );
        
        let estimatedGas;
        
        if (operation === 'wrap') {
            estimatedGas = await contract.estimateGas.deposit({ value: amount });
        } else if (operation === 'unwrap') {
            estimatedGas = await contract.estimateGas.withdraw(amount);
        }
        
        // Güvenlik için %15 buffer ekle
        const gasLimit = estimatedGas.mul(115).div(100);
        console.log(`⛽ Estimated gas for ${operation}: ${estimatedGas.toString()} (using ${gasLimit.toString()} with buffer)`.grey);
        
        return gasLimit;
    } catch (error) {
        console.error(`❌ Error estimating gas: ${error.message}`.red);
        // Tahmin edilemezse, varsayılan değerleri kullan
        const defaultGas = 500000;
        console.log(`⚠️ Using default gas limit: ${defaultGas}`.yellow);
        return defaultGas;
    }
}

async function wrapMON(wallet, amount) {
    try {
        const contract = new ethers.Contract(
            WMON_CONTRACT,
            ["function deposit() public payable", "function withdraw(uint256 amount) public"],
            wallet
        );
        
        console.log(`🔄 Wrap ${ethers.utils.formatEther(amount)} MON > WMON`.magenta);
        
        // Dinamik gaz limiti hesapla
        const gasLimit = await getDynamicGasLimit(wallet, 'wrap', amount);
        
        const tx = await contract.deposit({ value: amount, gasLimit: gasLimit });
        console.log(`✅ Wrap MON > WMON successful`.green);
        console.log(`➡️  Hash: ${EXPLORER_URL}/${tx.hash}`.grey);
        
        const receipt = await tx.wait();
        console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`.grey);
        
        return receipt;
    } catch (error) {
        console.error(`❌ Error wrapping MON:`.red, error.message);
        throw error;
    }
}

async function unwrapMON(wallet, amount) {
    try {
        const contract = new ethers.Contract(
            WMON_CONTRACT,
            ["function deposit() public payable", "function withdraw(uint256 amount) public"],
            wallet
        );
        
        console.log(`🔄 Unwrap ${ethers.utils.formatEther(amount)} WMON > MON`.magenta);
        
        // Dinamik gaz limiti hesapla
        const gasLimit = await getDynamicGasLimit(wallet, 'unwrap', amount);
        
        const tx = await contract.withdraw(amount, { gasLimit: gasLimit });
        console.log(`✅ Unwrap WMON > MON successful`.green);
        console.log(`➡️  Hash: ${EXPLORER_URL}/${tx.hash}`.grey);
        
        const receipt = await tx.wait();
        console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`.grey);
        
        return receipt;
    } catch (error) {
        console.error(`❌ Error Unwrap:`.red, error.message);
        throw error;
    }
}

// Bu fonksiyon güvenli şekilde rastgele miktar hesaplar
function calculateRandomAmount(minAmount, maxAmount) {
    // BigNumber'ları güvenli bir şekilde işlemek için
    // Önce farkı hesapla
    const range = maxAmount.sub(minAmount);
    
    // Farkın yüzde kaçını alacağımızı hesapla (0-100 arası)
    const randomPercentage = Math.floor(Math.random() * 100);
    
    // Bu yüzdeyi kullanarak minAmount'a eklenecek miktarı hesapla
    const randomAddition = range.mul(randomPercentage).div(100);
    
    // Sonuç: minAmount + randomAddition
    return minAmount.add(randomAddition);
}

async function runSwapCycle(wallet, walletName, cycles = 1) {
    try {
        console.log(`\n${"=".repeat(50)}`);
        console.log(`👤 Processing wallet: ${walletName}`.cyan.bold);
        console.log(`🧧 Account: ${wallet.address}`.green);
        
        // İlk bakiye kontrolü
        const { monBalance, wmonBalance } = await checkBalance(wallet);
        
        // MON bakiyesi çok düşükse işlem yapma
        if (monBalance.lt(ethers.utils.parseEther("0.01"))) {
            console.log(`⚠️ MON balance too low for operations, skipping this wallet`.yellow);
            return;
        }
        
        for (let i = 0; i < cycles; i++) {
            console.log(`\n🔄 Cycle ${i + 1} of ${cycles}`.cyan);
            
            // Rastgele miktarı hesapla (bakiyenin %10-%40'ı arasında)
            const minAmount = monBalance.mul(10).div(100); // %10
            const maxAmount = monBalance.mul(40).div(100); // %40
            
            // Güvenli şekilde rastgele miktar hesapla
            const randomAmount = calculateRandomAmount(minAmount, maxAmount);
            
            // Rastgele gecikmeyi hesapla
            const randomDelay = getRandomDelay();

            try {
                // WMON'a dönüştür
                await wrapMON(wallet, randomAmount);
                
                // Kısa bir bekleme süresi
                const shortDelay = getRandomDelay(10, 30);
                console.log(`⏳ Waiting for ${shortDelay / 1000} seconds before unwrapping`.grey);
                await sleep(shortDelay);
                
                // WMON'dan MON'a geri dönüştür
                await unwrapMON(wallet, randomAmount);
                
                if (i < cycles - 1) {
                    console.log(`⏳ Wait ${randomDelay / 1000 / 60} minutes before next cycle`.grey);
                    await sleep(randomDelay);
                }
            } catch (error) {
                console.error(`❌ Error in cycle ${i + 1}: ${error.message}`.red);
                // Hata durumunda kısa bir süre bekle ve devam et
                await sleep(5000);
            }
        }
        
        // Son bakiye kontrolü
        console.log(`\n📊 Final balances:`.cyan);
        await checkBalance(wallet);
        
        console.log(`✅ All operations completed for this wallet!`.green.bold);
    } catch (error) {
        console.error(`❌ Error in runSwapCycle:`.red, error.message);
    }
}

async function main() {
    try {
        const provider = await connectToRpc();
        
        console.log(`🚀 Starting operations with ${privateKeys.length} wallets`.cyan.bold);
        
        // Her bir cüzdan için işlemleri sırayla gerçekleştir
        for (let i = 0; i < privateKeys.length; i++) {
            const wallet = new ethers.Wallet(privateKeys[i].value, provider);
            
            // Her cüzdan için 1 döngü çalıştır
            await runSwapCycle(wallet, privateKeys[i].name, 1);
            
            // Son cüzdan değilse, cüzdanlar arası bekleme süresi ekle
            if (i < privateKeys.length - 1) {
                const delay = getRandomDelay(60, 120); // 1-2 dakika arası
                console.log(`\n⏳ Waiting ${delay/1000} seconds (${(delay/1000/60).toFixed(2)} minutes) before processing next wallet...`.yellow);
                await sleep(delay);
            }
        }
        
        console.log(`\n${"=".repeat(50)}`);
        console.log(`✅ Finished Izumi Swap for all wallets`.green.bold);
        
    } catch (error) {
        console.error(`❌ Error in main function: ${error.message}`.red);
    }
}

main().catch(error => {
    console.error(`❌ Error SwapCycle:`.red, error);
});
