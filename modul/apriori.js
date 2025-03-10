require("dotenv").config();
const ethers = require("ethers");
const colors = require("colors");
const displayHeader = require("../src/banner.js");
const readline = require("readline");
const axios = require("axios");

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
            console.log(`🪫  Starting Apriori ⏩⏩⏩⏩`.blue);
            console.log(` `);
            return provider;
        } catch (error) {
            console.log(`❌ Failed to connect to ${url}: ${error.message}`.red);
        }
    }
    throw new Error(`❌ Unable to connect to any RPC URL. Please check your internet connection or RPC endpoints.`.red);
}

const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";
const contractAddress = "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A";
const gasLimitStake = 150000;
const gasLimitUnstake = 200000;
const gasLimitClaim = 300000;

const minimalABI = [
  "function getPendingUnstakeRequests(address) view returns (uint256[] memory)",
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function getRandomAmount() {
  const min = 0.01;
  const max = 0.05;
  const randomAmount = Math.random() * (max - min) + min;
  return ethers.utils.parseEther(randomAmount.toFixed(4));
}

function getRandomDelay() {
  const minDelay = 1 * 60 * 1000;
  const maxDelay = 2 * 60 * 1000;
  return Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function stakeMON(wallet, cycleNumber) {
  try {
    const stakeAmount = getRandomAmount();

    console.log(
      `🔄 Stake: ${ethers.utils.formatEther(stakeAmount)} MON`.green
    );

    const data =
      "0x6e553f65" +
      ethers.utils.hexZeroPad(stakeAmount.toHexString(), 32).slice(2) +
      ethers.utils.hexZeroPad(wallet.address, 32).slice(2);

    const tx = {
      to: contractAddress,
      data: data,
      gasLimit: ethers.utils.hexlify(gasLimitStake),
      value: stakeAmount,
    };

    console.log(`✅ Stake `.magenta);
    const txResponse = await wallet.sendTransaction(tx);
    console.log(
      `➡️  Hash: ${txResponse.hash}`.yellow
    );
    console.log(`🔍 Explorer: ${EXPLORER_URL}${txResponse.hash}`.cyan);

    console.log(`🔄 Wait confirmation`.grey);
    const receipt = await txResponse.wait();
    console.log(`✅ Stake successful!`.green);

    return { receipt, stakeAmount };
  } catch (error) {
    console.error(`❌ Staking failed:`.red, error.message);
    throw error;
  }
}

async function requestUnstakeAprMON(wallet, amountToUnstake, cycleNumber) {
  try {
    console.error(` `);
    console.log(
      `🔄 unstake: ${ethers.utils.formatEther(
        amountToUnstake
      )} aprMON`.green
    );

    const data =
      "0x7d41c86e" +
      ethers.utils.hexZeroPad(amountToUnstake.toHexString(), 32).slice(2) +
      ethers.utils.hexZeroPad(wallet.address, 32).slice(2) +
      ethers.utils.hexZeroPad(wallet.address, 32).slice(2);

    const tx = {
      to: contractAddress,
      data: data,
      gasLimit: ethers.utils.hexlify(gasLimitUnstake),
      value: ethers.utils.parseEther("0"),
    };

    console.log(`🔄 Unstake`.magenta);
    const txResponse = await wallet.sendTransaction(tx);
    console.log(
      `➡️   Hash: ${txResponse.hash}`.yellow
    );
    console.log(`🔍 Explorer: ${EXPLORER_URL}${txResponse.hash}`.cyan);

    console.log(`🔄 Wait confirmation`.grey);
    const receipt = await txResponse.wait();
    console.log(`✅ Unstake successful`.green);

    return receipt;
  } catch (error) {
    console.error(`❌ Unstake failed:`.red, error.message);
    throw error;
  }
}

async function checkClaimableStatus(walletAddress) {
  try {
    const apiUrl = `https://testnet.monadexplorer.com/api/v1/unstake-requests?address=${walletAddress}`;
    const response = await axios.get(apiUrl, { timeout: 10000 });

    const claimableRequest = response.data.find(
      (request) => !request.claimed && request.is_claimable
    );

    if (claimableRequest) {
      console.log(`✅ Found claimable: ${claimableRequest.id}`.green);
      return {
        id: claimableRequest.id,
        isClaimable: true,
      };
    }
    return {
      id: null,
      isClaimable: false,
    };
  } catch (error) {
    console.error(
      `❌ Failed Claimable :`.red,
      error.message
    );
    return {
      id: null,
      isClaimable: false,
    };
  }
}

async function claimMON(wallet, cycleNumber) {
  try {
    const { id, isClaimable } = await checkClaimableStatus(wallet.address);

    if (!isClaimable || !id) {
      console.log(`❌ No claimable`.red);
      return null;
    }

    console.log(`✅ Claim withdrawal: ${id}`.green);

    const data =
      "0x492e47d2" +
      "0000000000000000000000000000000000000000000000000000000000000040" +
      ethers.utils.hexZeroPad(wallet.address, 32).slice(2) +
      "0000000000000000000000000000000000000000000000000000000000000001" +
      ethers.utils
        .hexZeroPad(ethers.BigNumber.from(id).toHexString(), 32)
        .slice(2);

    const tx = {
      to: contractAddress,
      data: data,
      gasLimit: ethers.utils.hexlify(gasLimitClaim),
      value: ethers.utils.parseEther("0"),
    };

    console.log(`✅ Claim `.green);
    const txResponse = await wallet.sendTransaction(tx);
    console.log(`➡️ Hash: ${txResponse.hash}`.grey);
    console.log(`🔍 Explorer: ${EXPLORER_URL}${txResponse.hash}`.cyan);

    console.log(`✅ Wait Confirmation`.green);
    const receipt = await txResponse.wait();
    console.log(`✅ Claim successful: ${id}`.green);

    return receipt;
  } catch (error) {
    console.error(`❌ Claim failed:`.red, error.message);
    throw error;
  }
}

async function runCycle(wallet, walletName, cycleNumber) {
  try {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`👤 Processing wallet: ${walletName}`.cyan.bold);
    console.log(`🧧 Account: ${wallet.address}`.green);
    
    const { stakeAmount } = await stakeMON(wallet, cycleNumber);

    const delayTimeBeforeUnstake = getRandomDelay();
    console.log(
      `⏳ Wait ${
        delayTimeBeforeUnstake / 1000
      } Seconds`.grey
    );
    await delay(delayTimeBeforeUnstake);

    await requestUnstakeAprMON(wallet, stakeAmount, cycleNumber);

    console.log(
      `✅ Wait for claim (11 minutes)`.green
    );
    await delay(660000); // 11 dakika bekle

    await claimMON(wallet, cycleNumber);

    console.log(`✅ All operations completed for this wallet!`.green.bold);
  } catch (error) {
    console.error(`❌ Error in cycle: ${error.message}`.red);
  }
}

async function getCycleCount() {
  return 1;
}

async function main() {
  try {
    const provider = await connectToRpc();
    const contract = new ethers.Contract(contractAddress, minimalABI, provider);
    
    console.log(`🚀 Starting operations with ${privateKeys.length} wallets`.cyan.bold);
    
    const cycleCount = await getCycleCount();
    
    // Her bir cüzdan için işlemleri sırayla gerçekleştir
    for (let i = 0; i < privateKeys.length; i++) {
      const wallet = new ethers.Wallet(privateKeys[i].value, provider);
      
      for (let j = 1; j <= cycleCount; j++) {
        await runCycle(wallet, privateKeys[i].name, j);
      }
      
      // Son cüzdan değilse, cüzdanlar arası bekleme süresi ekle
      if (i < privateKeys.length - 1) {
        const interWalletDelay = getRandomDelay() * 2; // Cüzdanlar arası daha uzun bekleme
        console.log(`\n⏳ Waiting ${interWalletDelay/1000} seconds before processing next wallet...`.yellow);
        await delay(interWalletDelay);
      }
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`🎉 All wallets processed successfully!`.green.bold);
  } catch (error) {
    console.error("❌ Operation failed:".red, error.message);
  } finally {
    rl.close();
  }
}

main().catch(error => {
  console.error(`❌ Unhandled error: ${error.message}`.red);
  console.error(error);
});

module.exports = {
  stakeMON,
  requestUnstakeAprMON,
  claimMON,
  getRandomAmount,
  getRandomDelay,
};
