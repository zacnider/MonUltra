require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");
const cfonts = require("cfonts");
const displayHeader = require("../src/banner.js");

displayHeader();

const RPC_URL = "https://testnet-rpc.monad.xyz/"; 
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx";
const WMON_CONTRACT = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701"; 

// Private key'leri .env dosyasından al
const privateKeys = [
    process.env.PRIVATE_KEY_1,
    process.env.PRIVATE_KEY_2,
    process.env.PRIVATE_KEY_3,
    process.env.PRIVATE_KEY_4
].filter(key => key); // Boş olmayan private key'leri filtrele

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

function getRandomAmount() {
    const min = 0.01; 
    const max = 0.05; 
    return ethers.utils.parseEther((Math.random() * (max - min) + min).toFixed(4));
}

function getRandomDelay(min = 1, max = 3) {
    return Math.floor(Math.random() * (max * 60 * 1000 - min * 60 * 1000 + 1) + min * 60 * 1000);
}

function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes} dakika ${seconds} saniye`;
}

async function wrapMON(wallet, amount, walletIndex) {
    try {
        const contract = new ethers.Contract(
            WMON_CONTRACT,
            ["function deposit() public payable", "function withdraw(uint256 amount) public"],
            wallet
        );

        console.log(`🪫 [Cüzdan ${walletIndex + 1}] Bebop Başlatılıyor ⏩⏩⏩⏩`.blue);
        console.log(`📍 Cüzdan Adresi: ${wallet.address}`.grey);
        console.log(`🔄 ${ethers.utils.formatEther(amount)} MON'u WMON'a Sarma`.magenta);

        const tx = await contract.deposit({ value: amount, gasLimit: 210000 });
        console.log(`✅ WMON Sarma İşlemi Başarılı`.green);
        console.log(`➡️  İşlem Hash: ${tx.hash}`.grey);
        await tx.wait();
    } catch (error) {
        console.error(`❌ [Cüzdan ${walletIndex + 1}] WMON Sarma Hatası:`.red, error);
    }
}

async function unwrapMON(wallet, amount, walletIndex) {
    try {
        const contract = new ethers.Contract(
            WMON_CONTRACT,
            ["function deposit() public payable", "function withdraw(uint256 amount) public"],
            wallet
        );

        console.log(`🔄 [Cüzdan ${walletIndex + 1}] ${ethers.utils.formatEther(amount)} WMON'u MON'a Çevirme`.magenta);
        const tx = await contract.withdraw(amount, { gasLimit: 210000 });
        console.log(`✅ WMON Çevirme İşlemi Başarılı`.green);
        console.log(`➡️  İşlem Hash: ${tx.hash}`.grey);
        await tx.wait();
    } catch (error) {
        console.error(`❌ [Cüzdan ${walletIndex + 1}] WMON Çevirme Hatası:`.red, error);
    }
}

async function runSwapCycleForWallet(privateKey, walletIndex, cycles = 1) {
    try {
        const wallet = new ethers.Wallet(privateKey, provider);
        console.log(`🚀 [Cüzdan ${walletIndex + 1}] Swap Döngüsü Başlatılıyor`.yellow);
        console.log(`📍 Cüzdan Adresi: ${wallet.address}`.grey);

        for (let i = 0; i < cycles; i++) {
            const randomAmount = getRandomAmount(); 
            const randomDelay = getRandomDelay(); 

            await wrapMON(wallet, randomAmount, walletIndex);
            await unwrapMON(wallet, randomAmount, walletIndex);

            if (i < cycles - 1) {
                console.log(`⏳ [Cüzdan ${walletIndex + 1}] Sonraki İşlem İçin Bekleniyor`.grey);
                console.log(`⏰ Bekleme Süresi: ${formatTime(randomDelay)}`.grey);
                await new Promise(resolve => setTimeout(resolve, randomDelay)); 
            }
        }
        console.log(`✅ [Cüzdan ${walletIndex + 1}] Swap Döngüsü Tamamlandı`.green);
    } catch (error) {
        console.error(`❌ [Cüzdan ${walletIndex + 1}] Swap Döngüsü Hatası:`.red, error);
    }
}

async function runMultiWalletSwapCycles(cycles = 1) {
    for (let i = 0; i < privateKeys.length; i++) {
        const privateKey = privateKeys[i];
        await runSwapCycleForWallet(privateKey, i, cycles);
        
        // Son cüzdandan sonra bekleme yapma
        if (i < privateKeys.length - 1) {
            const walletDelay = getRandomDelay(0.2,0.3 ); // Cüzdanlar arası 10-20 saniye bekleme
            console.log(`⏳ Cüzdanlar Arası Bekleme: ${formatTime(walletDelay)}`.grey);
            await new Promise(resolve => setTimeout(resolve, walletDelay));
        }
    }
}

runMultiWalletSwapCycles(1).catch(error => {
    console.error(`❌ Çoklu Cüzdan Swap Döngüsü Hatası:`.red, error);
});
