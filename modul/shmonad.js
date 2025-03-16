const ethers = require('ethers');
require('dotenv').config();

class MonadTransaction {
    constructor() {
        this.rpcUrls = [
            "https://testnet-rpc.monad.xyz",
            "https://monad-testnet.drpc.org"
        ];
        
        this.provider = null;
        this.wallets = [];
    }

    // RPC Sağlayıcıyı Ayarla
    async setupProvider() {
        for (const rpcUrl of this.rpcUrls) {
            try {
                const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
                
                // RPC bağlantısını test et
                await provider.getNetwork();
                
                this.provider = provider;
                break;
            } catch (error) {
                console.log(`❌ RPC Bağlantı Hatası: ${rpcUrl}`);
            }
        }

        if (!this.provider) {
            throw new Error('Hiçbir RPC sunucusuna bağlanılamadı!');
        }
    }

    // Cüzdanları yükle
    loadWallets() {
        // .env dosyasındaki tüm PRIVATE_KEY'leri topla
        const privateKeys = Object.keys(process.env)
            .filter(key => key.startsWith('PRIVATE_KEY'))
            .map(key => process.env[key]);

        this.wallets = privateKeys.map((privateKey, index) => {
            try {
                return new ethers.Wallet(privateKey, this.provider);
            } catch (error) {
                console.log(`❌ Cüzdan ${index + 1} yüklenemedi`);
                return null;
            }
        }).filter(wallet => wallet !== null);
    }

    // Tek bir cüzdanla işlem
    async processWallet(wallet, index) {
        try {
            console.log(`\n🚀 ${index + 1}. Cüzdan İşlemi Başlatılıyor`);
            console.log(`Adres: ${wallet.address}`);

            const tx = await wallet.sendTransaction({
                to: '0xbce2c725304e09cef4cd7639760b67f8a0af5bc4',
                value: ethers.utils.parseEther('0'),
                data: '0x0c60e091',
                gasPrice: await this.provider.getGasPrice(),
                gasLimit: 200000
            });

            console.log(`✅ İşlem Gönderildi: ${tx.hash}`);
            console.log(`🌐 Explorer: https://testnet.monadexplorer.com/tx/${tx.hash}`);
        } catch (error) {
            console.log(`❌ İşlem Hatası: ${error.message}`);
        }
    }

    // Tüm cüzdanlarla işlem
    async processAllWallets() {
        console.log('\n🔄 İşlemler Başlatılıyor');
        
        for (let i = 0; i < this.wallets.length; i++) {
            await this.processWallet(this.wallets[i], i);
            
            // Her işlem arası 10 saniye bekle
            await new Promise(resolve => setTimeout(resolve, 10000));
        }

        console.log('\n🏁 Tüm İşlemler Tamamlandı');
    }

    // Ana çalıştırma metodu
    async run() {
        try {
            // Önce RPC sağlayıcıyı ayarla
            await this.setupProvider();
            
            // Sonra cüzdanları yükle
            this.loadWallets();
            
            // Tüm cüzdanlarla işlem yap
            await this.processAllWallets();
        } catch (error) {
            console.error('🛑 Kritik Hata:', error);
        }
    }
}

// Ana fonksiyon
async function main() {
    const transaction = new MonadTransaction();
    await transaction.run();
}

// Başlat
main();
