/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

/* eslint-disable consistent-return */

const chalk = require('chalk');
const { spawnSync, execFileSync } = require('child_process');

const adb = require('./adb');
const tryRunAdbReverse = require('./tryRunAdbReverse');
const tryLaunchAppOnDevice = require('./tryLaunchAppOnDevice');

function getCommand(appFolder, command) {
  return appFolder ? `${appFolder}:${command}` : command;
}

function runOnAllDevices(
  args,
  cmd,
  packageNameWithSuffix,
  packageName,
  adbPath
) {
  try {
    const gradleArgs = [];

    if (args.installDebug) {
      gradleArgs.push(getCommand(args.appFolder, args.installDebug));
    } else if (args.variant) {
      gradleArgs.push(
        `${getCommand(
          args.appFolder,
          'install'
        )}${args.variant[0].toUpperCase()}${args.variant.slice(1)}`
      );
    } else if (args.flavor) {
      console.warn(
        chalk.yellow('--flavor has been deprecated. Use --variant instead')
      );
      gradleArgs.push(
        `${getCommand(
          args.appFolder,
          'install'
        )}${args.flavor[0].toUpperCase()}${args.flavor.slice(1)}`
      );
    } else {
      gradleArgs.push(getCommand(args.appFolder, 'installDebug'));
    }

    console.log(
      chalk.bold(
        `Building and installing the app on the device (cd android && ${cmd} ${gradleArgs.join(
          ' '
        )})...`
      )
    );

    execFileSync(cmd, gradleArgs, {
      stdio: [process.stdin, process.stdout, process.stderr],
    });
  } catch (e) {
    console.log(
      chalk.red(
        'Could not install the app on the device, read the error above for details.\n' +
          'Make sure you have an Android emulator running or a device connected and have\n' +
          'set up your Android development environment:\n' +
          'https://facebook.github.io/react-native/docs/getting-started.html'
      )
    );
    // stderr is automatically piped from the gradle process, so the user
    // should see the error already, there is no need to do
    // `console.log(e.stderr)`
    return Promise.reject(e);
  }
  const devices = adb.getDevices();
  if (devices && devices.length > 0) {
    devices.forEach(device => {
      tryRunAdbReverse(args.port, device);
      tryLaunchAppOnDevice(
        device,
        packageNameWithSuffix,
        packageName,
        adbPath,
        args.mainActivity
      );
    });
  } else {
    try {
      // If we cannot execute based on adb devices output, fall back to
      // shell am start
      const fallbackAdbArgs = [
        'shell',
        'am',
        'start',
        '-n',
        `${packageNameWithSuffix}/${packageName}.MainActivity`,
      ];
      console.log(
        chalk.bold(
          `Starting the app (${adbPath} ${fallbackAdbArgs.join(' ')}...`
        )
      );
      spawnSync(adbPath, fallbackAdbArgs, { stdio: 'inherit' });
    } catch (e) {
      console.log(
        chalk.red('adb invocation failed. Do you have adb in your PATH?')
      );
      // stderr is automatically piped from the gradle process, so the user
      // should see the error already, there is no need to do
      // `console.log(e.stderr)`
      return Promise.reject(e);
    }
  }
}

module.exports = runOnAllDevices;