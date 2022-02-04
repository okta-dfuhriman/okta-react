/*!
 * Copyright (c) 2017-Present, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

/* eslint-disable */
const path = require('path');
const spawn = require('cross-spawn-with-kill');
const waitOn = require('wait-on');

// will load environment vars from testenv file and set on process.env
require('@okta/env');

const ROUTER_APPS = [
  'reach-router',
  'react-router-v5',
  'react-router-v5-hash',
  'react-router-v6',
  'react-router-v6-hash',
];

const runTestsOnApp = (app) => {
  return new Promise((resolve) => {
    // extend `process.env` so variables like PATH are included
    const env = { ...(process.env), PORT: 4440 };
    // start react router app dev server
    const routerApp = spawn('yarn', ['workspace', `@okta/test.app.${app}`, 'start'], { env });
    console.log(`## ~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~ ##
  Running e2e tests on ${app}
## ~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~ ##`
    );

    let returnCode = 0;
    routerApp.on('exit', function(code) {
      console.log('Server exited with code: ' + code);
      resolve(returnCode);
    });

    let routerAppError = null;
    routerApp.on('error', function (err) {
      console.log(err);
      routerAppError = err;
    });
    if (routerAppError) return routerApp.kill();

    waitOn({
      resources: [
        'http-get://localhost:4440'
      ],
      timeout: 10000
    })
    .then(() => {
      const wdioConfig = path.resolve(__dirname, 'wdio.conf.js');

      const runner = spawn('yarn', ['wdio', 'run', wdioConfig], { stdio: 'inherit' });

      runner.on('exit', function(code) {
        console.log('Test runner exited with code: ' + code);
        returnCode = code;
        routerApp.kill();
      });
      runner.on('error', function(err) {
        routerApp.kill();
        throw err;
      });
    });
  });
};

const runTests = async (apps) => {
  let i = 0;
  while (i < apps.length) {
    await runTestsOnApp(apps[i]);
    i += 1;
  }
};

if (process.argv[2]) {
  if (!ROUTER_APPS.includes(process.argv[2])) {
    console.log(`Error: ${process.argv[2]} not a valid router app`);
    return;
  }

  runTests([process.argv[2]]).catch(console.error);
}
else {
  runTests(ROUTER_APPS).catch(console.error);
}