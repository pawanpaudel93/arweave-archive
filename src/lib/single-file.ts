import fs from 'fs';

import fileUrl from 'file-url';
import args from 'single-file-cli/args';
import api from 'single-file-cli/single-file-cli-api';

async function run(options) {
  let urls: any[];
  if (options.url && !api.VALID_URL_TEST.test(options.url)) {
    options.url = fileUrl(options.url);
  }
  if (options.urlsFile) {
    urls = fs.readFileSync(options.urlsFile).toString().split('\n');
  } else {
    urls = [options.url];
  }
  if (options.browserCookiesFile) {
    const cookiesContent = fs.readFileSync(options.browserCookiesFile).toString();
    try {
      options.browserCookies = JSON.parse(cookiesContent);
    } catch (error) {
      options.browserCookies = parseCookies(cookiesContent);
    }
  }
  const singlefile = await api.initialize(options);
  await singlefile.capture(urls);
  await singlefile.finish();
}

function parseCookies(textValue: string) {
  const httpOnlyRegExp = /^#HttpOnly_(.*)/;
  return textValue
    .split(/\r\n|\n/)
    .filter((line: string) => line.trim() && (!/^#/.test(line) || httpOnlyRegExp.test(line)))
    .map((line: string) => {
      const httpOnly = httpOnlyRegExp.test(line);
      if (httpOnly) {
        line = line.replace(httpOnlyRegExp, '$1');
      }
      const values = line.split(/\t/);
      if (values.length == 7) {
        return {
          domain: values[0],
          path: values[2],
          secure: values[3] == 'TRUE',
          expires: (values[4] && Number(values[4])) || undefined,
          name: values[5],
          value: values[6],
          httpOnly,
        };
      }
      return undefined;
    })
    .filter((cookieData: any) => cookieData);
}

export async function runBrowser({
  basePath,
  browserArgs,
  browserExecutablePath,
  url,
  output,
  userAgent,
}: {
  basePath: string;
  browserArgs: string;
  browserExecutablePath: string;
  url: string;
  output: string;
  userAgent: string;
}) {
  const options = {
    ...args,
    basePath,
    browserArgs,
    browserExecutablePath,
    url,
    output,
    userAgent,
    browserWidth: 1920,
    browserHeight: 1080,
  };
  await run(options);
}
