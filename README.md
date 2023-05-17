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

```javascript
import { Archive } from 'arweave-archive';

async function main() => {
  const archive = new Archive("wallet_jwk.json")
  const output = await archive.archiveUrl('https://github.com/pawanpaudel93');
  return output
}

main().then((output) => console.log(output))

```

## Author

👤 **Pawan Paudel**

- Github: [@pawanpaudel93](https://github.com/pawanpaudel93)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/pawanpaudel93/arweave-archive/issues).

## Show your support

Give a ⭐️ if this project helped you!

Copyright © 2023 [Pawan Paudel](https://github.com/pawanpaudel93).<br />
