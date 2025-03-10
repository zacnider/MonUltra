const dotenv = require("dotenv");
const ethers = require("ethers");
const solc = require("solc");
dotenv.config();

// RPC URL'leri
const RPC_URLS = [
  "https://testnet-rpc.monad.xyz",
  "https://monad-testnet.drpc.org"
];

// Basit renkli konsol çıktıları için yerleşik çözüm
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`
};

// Private key'leri yükle
function loadPrivateKeys() {
  const privateKeys = [];
  
  // PRIVATE_KEY_ ile başlayan tüm değişkenleri bul
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('PRIVATE_KEY_')) {
      privateKeys.push({
        name: key,
        value: process.env[key]
      });
    }
  });
  
  // Eğer özel formatta key bulunamazsa, PRIVATE_KEY'i kullan
  if (privateKeys.length === 0 && process.env.PRIVATE_KEY) {
    privateKeys.push({
      name: "PRIVATE_KEY",
      value: process.env.PRIVATE_KEY
    });
  }
  
  if (privateKeys.length === 0) {
    console.log(colors.red("❌ No private keys found in .env file!"));
    process.exit(1);
  }
  
  console.log(colors.green(`✅ Loaded ${privateKeys.length} wallet(s) from .env file`));
  return privateKeys;
}

// Rastgele kelimeler için basit bir liste
const randomWords = [
  "Quantum", "Stellar", "Cosmic", "Digital", "Cyber", "Fusion", "Nexus", "Vertex", "Zenith", "Apex",
  "Equinox", "Solstice", "Nebula", "Galaxy", "Pulsar", "Quasar", "Vortex", "Cipher", "Matrix", "Vector",
  "Photon", "Neutron", "Electron", "Proton", "Nucleus", "Isotope", "Catalyst", "Synthesis", "Genesis", "Epoch",
  "Oracle", "Phoenix", "Dragon", "Griffin", "Hydra", "Kraken", "Titan", "Atlas", "Chronos", "Helios",
  "Apollo", "Artemis", "Athena", "Poseidon", "Hermes", "Hades", "Zeus", "Hera", "Ares", "Aphrodite",
  "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Ceres",
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa",
  "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi", "Rho", "Sigma", "Tau", "Upsilon",
  "Phi", "Chi", "Psi", "Omega", "Byte", "Bit", "Pixel", "Data", "Code", "Script",
  "Token", "Block", "Chain", "Hash", "Node", "Shard", "Smart", "Contract", "Wallet", "Asset"
];

// RPC'ye bağlanma fonksiyonu
async function connectToRpc() {
  for (const url of RPC_URLS) {
    try {
      console.log(colors.yellow(`🔄 Trying to connect to RPC: ${url}`));
      const provider = new ethers.providers.JsonRpcProvider(url);
      
      // Network bilgisini al
      await provider.getNetwork();
      
      console.log(colors.green(`✅ Connected to RPC: ${url}`));
      return provider;
    } catch (error) {
      console.log(colors.red(`❌ Failed to connect to ${url}: ${error.message}`));
    }
  }
  throw new Error(colors.red(`❌ Unable to connect to any RPC URL. Please check your internet connection or RPC endpoints.`));
}

function generateRandomName() {
  // 1 rastgele kelime seç
  const numWords = Math.floor(Math.random() * 1) + 1;
  let result = "";
  
  for (let i = 0; i < numWords; i++) {
    const randomIndex = Math.floor(Math.random() * randomWords.length);
    result += randomWords[randomIndex];
  }
  
  return result;
}

const contractSource = `
pragma solidity ^0.8.0;

contract Counter {
    uint256 private count;
    string public name;
    address public owner;
    
    event CountIncremented(address indexed by, uint256 newCount);
    
    constructor(string memory _name) {
        name = _name;
        owner = msg.sender;
    }
    
    function increment() public {
        count += 1;
        emit CountIncremented(msg.sender, count);
    }
    
    function getCount() public view returns (uint256) {
        return count;
    }
    
    function getName() public view returns (string memory) {
        return name;
    }
}
`;

function compileContract() {
  console.log("⏳ Compiling contract...");

  try {
    const input = {
      language: "Solidity",
      sources: { "Counter.sol": { content: contractSource } },
      settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
      const hasError = output.errors.some(error => error.severity === 'error');
      if (hasError) {
        console.log(colors.red("❌ Contract compilation failed!"));
        console.error(output.errors);
        process.exit(1);
      } else {
        console.log(colors.yellow("⚠️ Contract compiled with warnings:"));
        output.errors.forEach(warning => console.log(colors.yellow(`- ${warning.message}`)));
      }
    } else {
      console.log(colors.green("✅ Contract compiled successfully!"));
    }

    const contract = output.contracts["Counter.sol"].Counter;
    return { abi: contract.abi, bytecode: contract.evm.bytecode.object };
  } catch (error) {
    console.log(colors.red("❌ Contract compilation failed!"));
    console.error(error);
    process.exit(1);
  }
}

async function deployContract(wallet, walletName, contractName) {
  const { abi, bytecode } = compileContract();
  console.log(`🚀 Deploying contract ${contractName} to blockchain...`);

  try {
    // Gas fiyatını optimize et
    const baseGasPrice = await wallet.provider.getGasPrice();
    const gasPrice = baseGasPrice.mul(110).div(100); // %10 artır

    const nonce = await wallet.provider.getTransactionCount(wallet.address, "latest");
    console.log(colors.gray(`Using nonce: ${nonce}`));

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy(contractName, { 
      gasPrice: gasPrice,
      gasLimit: 500000
    }); 

    console.log("⏳ Waiting for transaction confirmation...");
    const txReceipt = await contract.deployTransaction.wait();

    console.log(colors.green(`✅ Contract ${contractName} deployed successfully!`));
    console.log(colors.cyan(`\n📌 Contract Address: `) + colors.yellow(contract.address));
    console.log(colors.cyan(`📜 Transaction Hash: `) + colors.yellow(txReceipt.transactionHash));
    console.log(colors.green("✅ Deployment complete! 🎉\n"));
    
    return true;
  } catch (error) {
    console.log(colors.red(`❌ Deployment failed for ${contractName}!`));
    console.error(colors.red(`Error: ${error.message}`));
    return false;
  }
}

async function main() {
  try {
    console.log(colors.blue("🪫  Starting Deploy Contract ⏩⏩⏩⏩"));
    console.log(" ");
    
    // RPC provider'a bağlan
    const provider = await connectToRpc();
    
    // Private key'leri yükle
    const privateKeys = loadPrivateKeys();
    
    let successCount = 0;
    let failCount = 0;
    
    // Her cüzdan için işlem yap
    for (let i = 0; i < privateKeys.length; i++) {
      const wallet = new ethers.Wallet(privateKeys[i].value, provider);
      
      console.log(`\n${"=".repeat(50)}`);
      console.log(colors.cyan(`👤 Using wallet ${i+1}/${privateKeys.length}: ${privateKeys[i].name}`));
      console.log(colors.green(`🧧 Address: ${wallet.address}`));
      
      // Bakiye kontrolü
      const balance = await provider.getBalance(wallet.address);
      console.log(colors.cyan(`💰 MON Balance: ${ethers.utils.formatEther(balance)} MON`));
      
      if (balance.lt(ethers.utils.parseEther("0.01"))) {
        console.log(colors.yellow(`⚠️ Wallet balance too low for deployment. Skipping this wallet.`));
        continue;
      }
      
      // Her cüzdan için 1-3 arası rastgele kontrat deploy et
      const numberOfContracts = Math.floor(Math.random() * 3) + 1;
      console.log(colors.cyan(`\n🚀 Wallet will deploy ${numberOfContracts} contracts`));
      
      let walletSuccessCount = 0;
      
      for (let j = 0; j < numberOfContracts; j++) {
        const contractName = generateRandomName();
        console.log(colors.yellow(`\n🚀 Deploying contract ${j+1}/${numberOfContracts}: ${contractName}`));
        
        const success = await deployContract(wallet, privateKeys[i].name, contractName);
        
        if (success) {
          walletSuccessCount++;
          successCount++;
        } else {
          failCount++;
        }
        
        // Son kontrat değilse, kontratlar arası bekleme süresi ekle
        if (j < numberOfContracts - 1) {
          const delay = Math.floor(Math.random() * (6000 - 4000 + 1)) + 4000; // 4-6 saniye
          console.log(colors.gray(`⏳ Waiting for ${delay / 1000} seconds before next deployment...`));
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      
      console.log(colors.cyan(`\n📊 Wallet ${privateKeys[i].name} summary: ${walletSuccessCount}/${numberOfContracts} contracts deployed successfully`));
      
      // Son cüzdan değilse, cüzdanlar arası bekleme süresi ekle
      if (i < privateKeys.length - 1) {
        const delay = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000; // 5-10 saniye
        console.log(colors.yellow(`\n⏳ Waiting ${delay / 1000} seconds before processing next wallet...`));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.log(`\n${"=".repeat(50)}`);
    console.log(colors.green(`🎉 All operations completed!`));
    console.log(colors.cyan(`📊 Summary: ${successCount} successful, ${failCount} failed deployments`));
    
  } catch (error) {
    console.error(colors.red(`❌ Error in main function: ${error.message}`));
  }
}

// Programı çalıştır
main().catch(error => {
  console.error(colors.red(`❌ Unhandled error:`), error);
});

module.exports = main;
