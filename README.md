# MonUltra

## Installation 
```bash
sudo apt update && sudo apt upgrade -y
```
#Install node.js and npm
```bash
sudo apt install nodejs npm
```
#Install git
```bash
sudo apt install git
```
1. **Clone the Repository**
   ```bash
   git clone https://github.com/zacnider/MonUltra.git
   cd MonUltra
   ```
2. **Install Dependencies**
   ```bash
   npm install ethers@5 dotenv ethers ora readline cfonts prompts colors axios chalk figlet solc
   ```
3. **Set Private Keys**
   ```bash
   nano .env  
   ```
4. **Create and Use Screen**
   ```bash
   screen -R monad
   ```
5. **Run the Application**
   ```bash
   node main.js
