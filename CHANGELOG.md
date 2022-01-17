#### 0.3.3 (2022-01-17)

##### Continuous Integration

*  upload binaries with github actions ([e8b48145](https://github.com/Huddly/device-api-usb/commit/e8b481454a3873756251f90726d84abb09f8e722))
*  build windows with github actions as well ([d3f48347](https://github.com/Huddly/device-api-usb/commit/d3f4834704ae5431290549361d4ea4e714c8adb3))

##### New Features

*  replace travis with github actions ([472f0a9e](https://github.com/Huddly/device-api-usb/commit/472f0a9e0616cbedc191d213d9ed6a213a1981e3))

##### Other Changes

* **build:**
  *  Ubuntu 18.04 instead of latest ([db143d1a](https://github.com/Huddly/device-api-usb/commit/db143d1a43f781d06e41ab22158740e1f87fbac7))
  *  Build for node v11 & v12 ([ee12c6df](https://github.com/Huddly/device-api-usb/commit/ee12c6df0c5eb661618a5674c7c0e5959531cdc7))
*  npm registry url should be https ([5b5526ad](https://github.com/Huddly/device-api-usb/commit/5b5526ad72990439018d3bb774a84f0f8a3d1d2b))

##### Refactors

*  Build win binaries with githubactions ([caf527f9](https://github.com/Huddly/device-api-usb/commit/caf527f9ce88e5b77479b0168a3647d36ef306e3))
*  Use @huddly/sdk-interfaces ([ba7819d8](https://github.com/Huddly/device-api-usb/commit/ba7819d85eecd481abf03a90323a7e3218f51fbe))

#### 0.3.2 (2021-09-08)

##### Other Changes

*  print err when retries are drained ([8d735e25](https://github.com/Huddly/device-api-usb/commit/8d735e25d683d9752653e0b509eac1c38eb0ff33))
*  Print out usb descriptor index ([b2a31129](https://github.com/Huddly/device-api-usb/commit/b2a311296449dccc2b9c08cd081d8f179f83319c))

#### 0.3.1 (2021-08-25)

##### Chores

*  bump sdk version to 0.6.1 ([f29ec021](https://github.com/Huddly/device-api-usb/commit/f29ec0215f69812a168d92f03f804e6d1ef59a03))

##### Bug Fixes

*  Handle Huddly BASE devices properly ([fc26aaa1](https://github.com/Huddly/device-api-usb/commit/fc26aaa15322558bc7f7600cbbd310a323a80c5b))

### 0.3.0 (2021-08-16)

##### Build System / Dependencies

* **deps:**  bump jszip from 3.6.0 to 3.7.1 ([b5203724](https://github.com/Huddly/device-api-usb/commit/b5203724e76b251f7ea42a218302fef86d43d7e0))
* **deps-dev:**  bump tar from 6.1.0 to 6.1.2 ([3708d33e](https://github.com/Huddly/device-api-usb/commit/3708d33ec11e165f39c60ff5c0bd0627f2ac23e8))
* **windows bin:**  do only upload bin from win build since tar.gz is built and deployed by travis ([f6130982](https://github.com/Huddly/device-api-usb/commit/f6130982f9cee9cbb3783761ccf5b2f695e10db2))

##### Chores

*  bump @huddly/sdk to v0.6.0 ([1d856c13](https://github.com/Huddly/device-api-usb/commit/1d856c13063dbf6e4655741069751522917a0ce0))
*  add support for node v14 (LTS) ([ce8b07a4](https://github.com/Huddly/device-api-usb/commit/ce8b07a4e8780e574534da9cd4ad177a37392777))
* **package.json:**
  *  prebuildify target bumped to electron version 7.1.2 ([bc2b15a3](https://github.com/Huddly/device-api-usb/commit/bc2b15a3a88211d40206be8f44ff90295a6d5501))
  *  Add node 12 to napi node targets ([faa93c76](https://github.com/Huddly/device-api-usb/commit/faa93c760bb1b7108475cd18f44f6d6f7447fcb8))
* **Node:**  Support for Node 12 LTS ([633d501b](https://github.com/Huddly/device-api-usb/commit/633d501bf8ada15b5d2ffe413fa1f4cae7507de4))

##### New Features

* **index:**  l1 camera does not support hlink transport ([662883ea](https://github.com/Huddly/device-api-usb/commit/662883ea9d935999953c5e69e5837fc04d02fe87))
*  implement crash call to be able to quickly check if stacktraces are working ([1b8ba63f](https://github.com/Huddly/device-api-usb/commit/1b8ba63f57b2d9e99be451b426b662d48ee3c99c))

##### Bug Fixes

* **update dep:**
  *  update npm deps ([b119d1fd](https://github.com/Huddly/device-api-usb/commit/b119d1fdf6b581e2498cb01103365a6debc89451))
  *  update npm deps ([e852ffb3](https://github.com/Huddly/device-api-usb/commit/e852ffb3af947a2bd9200d6c5f6c2d715b2ee242))
* **travis.yml:**  Fix the 2x2 matrix ([47a48844](https://github.com/Huddly/device-api-usb/commit/47a48844397520b88f819ccf1fb28c30eb639263))

##### Other Changes

*  audit dependencies ([13345e18](https://github.com/Huddly/device-api-usb/commit/13345e185f64239004248b6facb6fdee5eeb337b))
*  Prevent destructor to run after uv loop have been destroyed ([7b67c006](https://github.com/Huddly/device-api-usb/commit/7b67c0066c441a39109cc2e84ea5dd52d6b3bf65))

##### Refactors

*  update code to use static methods of SDK Logger ([b178909e](https://github.com/Huddly/device-api-usb/commit/b178909e517c570e58da7599a51d364209389d29))

#### 0.2.15 (2020-09-30)

##### Chores

* **package.json:**
  *  prebuildify target bumped to electron version 7.1.2 ([bc2b15a3](https://github.com/Huddly/device-api-usb/commit/bc2b15a3a88211d40206be8f44ff90295a6d5501))
  *  Add node 12 to napi node targets ([faa93c76](https://github.com/Huddly/device-api-usb/commit/faa93c760bb1b7108475cd18f44f6d6f7447fcb8))
* **Node:**  Support for Node 12 LTS ([633d501b](https://github.com/Huddly/device-api-usb/commit/633d501bf8ada15b5d2ffe413fa1f4cae7507de4))

##### New Features

*  implement crash call to be able to quickly check if stacktraces are working ([1b8ba63f](https://github.com/Huddly/device-api-usb/commit/1b8ba63f57b2d9e99be451b426b662d48ee3c99c))

##### Bug Fixes

* **cpp** Fix for possible crash race on uv_sync_t when threads pass messages over queue
* **travis.yml:**  Fix the 2x2 matrix ([47a48844](https://github.com/Huddly/device-api-usb/commit/47a48844397520b88f819ccf1fb28c30eb639263))

##### Other Changes

*  Prevent destructor to run after uv loop have been destroyed ([7b67c006](https://github.com/Huddly/device-api-usb/commit/7b67c0066c441a39109cc2e84ea5dd52d6b3bf65))


#### 0.2.14 (2020-04-16)

##### Chores

* **package.json:**
  *  prebuildify target bumped to electron version 7.1.2 ([bc2b15a3](https://github.com/Huddly/device-api-usb/commit/bc2b15a3a88211d40206be8f44ff90295a6d5501))
  *  Add node 12 to napi node targets ([faa93c76](https://github.com/Huddly/device-api-usb/commit/faa93c760bb1b7108475cd18f44f6d6f7447fcb8))
* **Node:**  Support for Node 12 LTS ([633d501b](https://github.com/Huddly/device-api-usb/commit/633d501bf8ada15b5d2ffe413fa1f4cae7507de4))

##### Bug Fixes

* **travis.yml:**  Fix the 2x2 matrix ([47a48844](https://github.com/Huddly/device-api-usb/commit/47a48844397520b88f819ccf1fb28c30eb639263))

#### 0.2.13 (2019-12-30)

##### Chores

* **package.json:**  Update dependencies to their latest stable versions ([77769078](https://github.com/Huddly/device-api-usb/commit/77769078c8fea381710ef76ef69d5959e0e093cd))

##### New Features

* **Possible to configure how long we look for usb device:**  Configurable max # attempts previously ([e53a508b](https://github.com/Huddly/device-api-usb/commit/e53a508b57284f748ff5fbded37d09d7ae89eb14))

#### 0.2.11 (2019-10-21)

#### 0.2.9 (2019-09-11)

##### Chores

* **package:**
  *  update lockfile package-lock.json ([36a762b4](https://github.com/Huddly/device-api-usb/commit/36a762b424e165f1c1eb8fab14f15eb1949a350f))
  *  update node-addon-api to version 1.7.1 ([6b6bec4e](https://github.com/Huddly/device-api-usb/commit/6b6bec4e252d3536929f792a7e090761766a82b8))
  *  update lockfile package-lock.json ([4d7c7205](https://github.com/Huddly/device-api-usb/commit/4d7c7205fc5eb7c65bf6195160c04eeae342905b))
  *  update @types/node to version 12.7.4 ([964b02ff](https://github.com/Huddly/device-api-usb/commit/964b02ff0037443e2d4ec9e414decc21036d934e))

##### Bug Fixes

* **Package.json:**  `scripts` dir should be included in npm published package ([2e1e38b2](https://github.com/Huddly/device-api-usb/commit/2e1e38b2e7850bb99815f576f6ab68eade58291f))

##### Refactors

* **Release:**  Prebuild binaries must be hosted inside lib folder ([7587768f](https://github.com/Huddly/device-api-usb/commit/7587768fdb17cab087ba9f0b66cafbfd4edd45de))
*  Proper release flow of device-api-usb ([a0adc1f4](https://github.com/Huddly/device-api-usb/commit/a0adc1f4a530e13f45a21e9b343231cfa1ffb2dd))

