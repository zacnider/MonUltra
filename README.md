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
2. **Set Private Keys**
   ```bash
   nano .env  
   ```
3. **Create and Use Screen**
   ```bash
   screen -S mon
   ```
4. **Run the Application**
   ```bash
   node main.js
   ```
**To keep the bot running in the background, press Ctrl + A, then D.)
To access the running bot 
 ```bash
  screen -R mon
 ```
*****Install Dependencies** (Dependencies are installed. If the bot does not work, perform this step)
   ```bash
   npm install ethers@5 dotenv ethers ora readline cfonts prompts colors axios chalk figlet solc
   ```
