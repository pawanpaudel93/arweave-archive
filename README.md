<h1 align="center">arweave-archive</h1>

A package to archive webpage & it's screenshot to [Arweave](https://arweave.org/)

## Installation

```sh
npm install arweave-archive
```

OR

```sh
yarn add arweave-archive
```

## Usage

### Archive a page

```javascript
import { Archive } from 'arweave-archive';

async function main() => {
  const archive = new Archive("wallet_jwk.json")
  const output = await archive.archiveUrl('https://github.com/pawanpaudel93');
  console.log(output)
}

main()
```

### Get all archived results

```javascript
import { Archive } from 'arweave-archive';

async function main() => {
  const archive = new Archive("wallet_jwk.json")
  // Get all archives of the loaded Arweave wallet JWK
  const allArchives = await archive.getAllArchives();
  console.log(allArchives)
  // Get all archives of a wallet address
  const allAddressArchives = await archive.getAllArchives("some-wallet-address");
  console.log(allAddressArchives)
}

main()
```

### Get latest archived result

```javascript
import { Archive } from 'arweave-archive';

async function main() => {
  const archive = new Archive("wallet_jwk.json")
  // Get latest archive of the loaded Arweave wallet JWK
  const latestArchive = await archive.getLatestArchive();
  console.log(latestArchive)
  // Get latest archive of a wallet address
  const latestAddressArchive = await archive.getLatestArchive("some-wallet-address");
  console.log(latestAddressArchive)
}

main()
```

## Author

👤 **Pawan Paudel**

- Github: [@pawanpaudel93](https://github.com/pawanpaudel93)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/pawanpaudel93/arweave-archive/issues).

## Show your support

Give a ⭐️ if this project helped you!

Copyright © 2023 [Pawan Paudel](https://github.com/pawanpaudel93).<br />
