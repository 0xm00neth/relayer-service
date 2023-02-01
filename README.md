# Relayer Service

## 1. Install dependencies

```bash
cd contracts && npm install

cd ../api && npm install

cd ../ui && npm install
```

## 2. Run local node

```bash
cd contracts && npx hardhat node
```

## 3. Deploy contracts

```bash
cd contracts
npx hardhat run scripts/deploy.ts --network localhost
```

## 4. Config Env

Copy `.env.sample` files in `api` and `ui` directories and set values for ENV variables.

## 5. Start API

```bash
cd api && npm run dev
```

## 6. Start UI

```bash
cd ui && npm start
```
