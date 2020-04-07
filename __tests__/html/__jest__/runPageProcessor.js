import { join } from 'path';
import createDeferred from 'p-defer';

import { imageSnapshotOptions } from '../../constants.json';
import createJobObservable from './createJobObservable';

const customImageSnapshotOptions = {
  ...imageSnapshotOptions,
  customSnapshotsDir: join(__dirname, '../../__image_snapshots__/html')
};

export default async function runPageProcessor(driver, { ignoreConsoleError = false, ignorePageError = false } = {}) {
  const webChatLoaded = await driver.executeScript(() => !!window.WebChat);
  const webChatTestLoaded = await driver.executeScript(() => !!window.WebChatTest);

  if (!webChatLoaded) {
    throw new Error('"webchat.js" is not loaded on the page.');
  }

  if (!webChatTestLoaded) {
    throw new Error('"testharness.js" is not loaded on the page.');
  }

  if (await driver.executeScript(() => !(window.React && window.ReactDOM && window.ReactTestUtils))) {
    throw new Error(
      '"react", "react-dom", and "react-test-utils" is required to use page objects and must be loaded on the page.'
    );
  }

  const jobObservable = createJobObservable(driver, { ignorePageError });
  const pageResultDeferred = createDeferred();

  const subscription = jobObservable.subscribe({
    complete: async () => {
      const numConsoleError = await driver.executeScript(
        () => window.WebChatTest.getConsoleHistory().filter(({ level }) => level === 'error').length
      );

      if (!ignoreConsoleError && numConsoleError) {
        pageResultDeferred.reject(
          new Error(
            'console.error() was called in browser. Set { ignoreConsoleError: true } if console.error is okay to ignore'
          )
        );
      } else {
        pageResultDeferred.resolve();
      }
    },
    error: error => {
      pageResultDeferred.reject(error);
    },
    next: async ({ deferred, job }) => {
      try {
        if (job.type === 'snapshot') {
          try {
            expect(await driver.takeScreenshot()).toMatchImageSnapshot(customImageSnapshotOptions);
            deferred.resolve();
          } catch (err) {
            pageResultDeferred.reject(err);
            deferred.reject(err);
          }
        } else {
          throw new Error(`Unknown job type "${job.type}".`);
        }
      } catch (err) {
        deferred.reject(err);
      }
    }
  });

  global.abortSignal.addEventListener('abort', () => pageResultDeferred.reject(new Error('Test aborted.')));

  try {
    return await pageResultDeferred.promise;
  } finally {
    subscription.unsubscribe();
  }
}
