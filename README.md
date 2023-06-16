# arweave-archive

arweave-archive is a node package that allows you to archive webpage and screenshot of the desired url on the [Arweave](https://arweave.org) blockchain. It provides a convenient way to store web content permanently and securely.

[![NPM version](https://img.shields.io/npm/v/arweave-archive?color=green&label=npm-package)](https://www.npmjs.com/package/arweave-archive)

## Installation

Using npm,

```sh
npm install arweave-archive
```

Using yarn,

```sh
yarn add arweave-archive
```

Using pnpm,

```sh
pnpm add arweave-archive
```

## Usage

To use the Arweave Archive package, import it and create an instance of the `ArweaveArchiver` class. You need to provide a JSON Web Key (JWK) or a path to a JWK file, which will be used to sign transactions. Optionally, you can also provide the gateway and bundler URLs and browserless options. If browserless options is not provided, locally installed Chrome browser is used to capture the webpage and screenshot of the provided url using puppeteer.

```ts
import { ArweaveArchiver } from 'arweave-archive'

const jwk = '<your-jwk-file-path-or-data>'
const options = {
  gatewayUrl: 'https://arweave.net',
  bundlerUrl: 'https://node2.bundlr.network',
}

const archiver = new ArweaveArchiver(jwk, options)
```

### Configuration

The `ArweaveArchiver` class allows you to configure the following options:

- `gatewayUrl` (optional): The URL of the Arweave gateway to use for uploading and accessing archived webpages. (default: '<https://arweave.net>')
- `bundlerUrl` (optional): The URL of the Arweave bundler to use for bundling and uploading archives. (default: '<https://node2.bundlr.network>')
- `browserlessOptions` (optional): The browserlessOptions object allows you to configure options related to [browserless.io](https://www.browserless.io/docs/chrome-flags). Here are the available options:

  - `apiKey` (optional): Your API key for using a browserless service.
  - `proxyServer` (optional): The URL of the proxy server to use.
  - `blockAds` (optional): A boolean indicating whether to block ads on the webpage.
  - `stealth` (optional): A boolean indicating whether to enable stealth mode for the browser.
  - `userDataDir` (optional): The directory where user data for the browser will be stored.
  - `keepalive` (optional): The maximum time to keep the browser process alive, in milliseconds.
  - `windowSize` (optional): The size of the browser window in pixels, specified as a string in the format "width,height".
  - `ignoreDefaultArgs` (optional): Additional arguments to pass to the browser process.
  - `headless` (optional): A boolean indicating whether to run the browser in headless mode. Default is true.
  - `userAgent` (optional): The user agent string to use for the browser.
  - `timeout` (optional): session timer.

Here's an example of how you can set the browserlessOptions:

```ts
const options = {
  browserlessOptions: {
    apiKey: 'your-api-key',
    proxyServer: 'your-proxy-server',
    blockAds: true,
    stealth: true,
    userDataDir: 'your-user-data-dir',
    keepalive: 60000,
    windowSize: '1280,720',
    ignoreDefaultArgs: '--disable-extensions',
    headless: true,
    userAgent: 'your-user-agent',
    timeout: 60000
  }
}

const archiver = new ArweaveArchiver(jwk, options)
```

Please note that the browserlessOptions is optional, and you can omit them if you don't need to use it for capturing webpage and screenshots of the provided url.

### Archiving a URL

You can archive a webpage by providing its URL to the `archiveUrl` method. The method returns a promise that resolves to an `ArchiveReturnType` object, containing the status of the archive process, a message, the transaction ID, the title of the webpage, and the timestamp.

```ts
const output = await archiver.archiveUrl('https://github.com/pawanpaudel93')
console.log(output)
```

### Retrieving Archived Webpages

You can retrieve a list of all archived webpages or get the latest archived webpage for a specific wallet address or the provided wallet itself.

To get all archived webpages, use the `getAllArchives` method. It returns a promise that resolves to an array of `ArchiveType` objects, representing each archived webpage. Each object contains the ID, URL, title, webpage URL, screenshot URL, and timestamp.

```javascript
// Get all archives of the loaded Arweave wallet JWK
const allArchives = await archiver.getAllArchives();
console.log(allArchives)
// Get all archives of a wallet address
const allAddressArchives = await archiver.getAllArchives("some-wallet-address");
console.log(allAddressArchives)
```

### Get latest archived webpages

To get the latest archived webpage for a specific wallet address or the provided wallet itself, use the `getLatestArchive` method. It returns a promise that resolves to an `ArchiveType` object representing the latest archived webpage, or null if no archived webpages are found.

```javascript
// Get latest archive of the loaded Arweave wallet JWK
const latestArchive = await archiver.getLatestArchive();
console.log(latestArchive)
// Get latest archive of a wallet address
const latestAddressArchive = await archiver.getLatestArchive("some-wallet-address");
console.log(latestAddressArchive)
```

## Author

👤 **Pawan Paudel**

- Github: [@pawanpaudel93](https://github.com/pawanpaudel93)

## 🤝 Contributing

Contributions, issues and feature requests are welcome! \ Feel free to check [issues page](https://github.com/pawanpaudel93/arweave-archive/issues).

## Show your support

Give a ⭐️ if this project helped you!

Copyright © 2023 [Pawan Paudel](https://github.com/pawanpaudel93)
