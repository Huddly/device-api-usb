#### 0.4.1 (2022-11-08)

##### Bug Fixes

*  do not open devices if they should be excluded ([c172c3bd](https://github.com/Huddly/device-api-usb/commit/c172c3bda14ba218675d3979b382c456d1b0a0ae))

#### 0.4.1 (2022-11-08)

##### Bug Fixes

*  do not open devices if they should be excluded ([c172c3bd](https://github.com/Huddly/device-api-usb/commit/c172c3bda14ba218675d3979b382c456d1b0a0ae))

### 0.4.0 (2022-10-26)

##### Chores

*  updated sdk-interfaces ([7d14b45e](https://github.com/Huddly/device-api-usb/commit/7d14b45ebdbced690abbd34a9c9c01d0f3fcd1be))
*  updated minimatch because of high severity vulnerability ([fd0a128a](https://github.com/Huddly/device-api-usb/commit/fd0a128a68a888ec4bc4bc3de94dcb3c7b102c7e))
*  update prod & dev depedencies to latest releases ([065c7ebf](https://github.com/Huddly/device-api-usb/commit/065c7ebf1109d76cf3e79782280600189b128c4c))
*  remove unused dependencies, audit, update sdk-intefaces version ([6a1f4a49](https://github.com/Huddly/device-api-usb/commit/6a1f4a4981d74c640ad60bb2d8cde1765942fb99))

##### Continuous Integration

*  temporarily disable cron trigger builds ([a592c1a0](https://github.com/Huddly/device-api-usb/commit/a592c1a0678eb8b695d7c5a27c8a8a4976ff9b8b))

##### New Features

*  delete libusb submodule ([fc603575](https://github.com/Huddly/device-api-usb/commit/fc603575d773b94eaef8b1974b2b1d64dadcf580))
*  Remove scripts for binary upload/download to/from azure ([2d3fcb2a](https://github.com/Huddly/device-api-usb/commit/2d3fcb2a5ac8bc4851b374caf75ac53778fb700a))
*  Update github actions ([e00aee17](https://github.com/Huddly/device-api-usb/commit/e00aee17717266d0a63185e156578e889efcde57))
*  Updated ApiUsb lib with multicam support ([7967a19a](https://github.com/Huddly/device-api-usb/commit/7967a19ade693cd4e8885cade1d97e1682c0e230))
*  Remove dependencies and scripts pkg.json ([ad35a05d](https://github.com/Huddly/device-api-usb/commit/ad35a05dba52e8ed0b7cf494d27510df5c4cc3a6))
*  Remove all the cpp implementation & setup ([07ca6e59](https://github.com/Huddly/device-api-usb/commit/07ca6e59af15bea82897877ea53d9beebcb1abaa))

##### Bug Fixes

* **transport.ts:**  Use wMaxPacketSize for read ([3320e415](https://github.com/Huddly/device-api-usb/commit/3320e415b61b3d8c2d7cbf476b053793815e4a6a))
*  Typo depricated -> deprecated ([c4f520e8](https://github.com/Huddly/device-api-usb/commit/c4f520e86f5f696bc1cf3b125f684cea6ab06804))
*  usb api should not attempt to initialize s1 devices ([d35e6c3c](https://github.com/Huddly/device-api-usb/commit/d35e6c3cb8a8fadae6fe0bb1f527ecc86221bdbf))
*  lock node-usb to 2.1.3 ([e24fb302](https://github.com/Huddly/device-api-usb/commit/e24fb30280c1dcc0b14bf92469464962893f1f62))
*  node-usb buffer split wont work on ubuntu ([516c965a](https://github.com/Huddly/device-api-usb/commit/516c965a23cbdc2b406d91221492af327b1ccde9))
*  nodeusb has build-in support for splitting data to chunks ([835ab42a](https://github.com/Huddly/device-api-usb/commit/835ab42aceefea48fc8d4ad00b423dbfd91b913a))
*  Ignore usb errors on device detach ([98f09eaa](https://github.com/Huddly/device-api-usb/commit/98f09eaadff1daec671ccccfbc416928b09a1aca))
*  On reset received...continue read ([54aaa6e9](https://github.com/Huddly/device-api-usb/commit/54aaa6e9651242e0580ea73aeccd727308cbba2a))
*  Ignore LIBUSB_ERROR_NO_DEVICE on release ([e5a61d0d](https://github.com/Huddly/device-api-usb/commit/e5a61d0d600f85614fd0bd235f1da06acf8b9d2e))
*  getDeviceFilter check serialNumber is set ([c85b4356](https://github.com/Huddly/device-api-usb/commit/c85b435668d8c8621ac6ed920e4e23bd4081b5c5))
*  Dont try closing a closed device ([95964c51](https://github.com/Huddly/device-api-usb/commit/95964c51dc8b5b9d45c920505a3577d0f8522f9b))
*  First letter of serialnr might be omitted ([86c0baf7](https://github.com/Huddly/device-api-usb/commit/86c0baf73130373046c73f0742b628baae23474b))
*  getTransport handle uvc device instance ([8956c098](https://github.com/Huddly/device-api-usb/commit/8956c098b3a8f54aa8dddf64d6fa4298350418fd))
*  Use npx on package.json scripts ([0a14189b](https://github.com/Huddly/device-api-usb/commit/0a14189b6da18533c29b589a23620c6210c82c2a))
*  skipLibCheck on tsconfig file ([15277703](https://github.com/Huddly/device-api-usb/commit/15277703a080af066c1c519e5e3e23c1b6de5116))

##### Other Changes

*  Rewrite unit tests for new implementation ([29e647e0](https://github.com/Huddly/device-api-usb/commit/29e647e05158e5c25001a9358aa65bc19cc1e815))

##### Refactors

*  on reset seq during read, recover not possible ([da8aabf0](https://github.com/Huddly/device-api-usb/commit/da8aabf0a2955075b10e6a45a90338b8675ca9ce))
*  Method visibiity update on manager.ts ([f6d632fd](https://github.com/Huddly/device-api-usb/commit/f6d632fd84b29e08741fa75ec70cd91bc8a57353))

##### Tests

*  Test private fuctions using rewire ([9d7e2b5b](https://github.com/Huddly/device-api-usb/commit/9d7e2b5bb9ce7b3b30a114765a2b328fa8895671))

#### 0.3.4 (2022-02-18)

##### Build System / Dependencies

* **gh-actions:**  Custom build cmd for win node 11&12 ([7d582b3b](https://github.com/Huddly/device-api-usb/commit/7d582b3ba09fa4e1d6e28414b851b08d32eb0195))

##### Chores

*  Remove support for electron 3 & 4 for future release ([b2595303](https://github.com/Huddly/device-api-usb/commit/b25953037705093fc15efd4ccbeaa57d2cf8f87a))
*  Build for node 16 ([ec21a2f7](https://github.com/Huddly/device-api-usb/commit/ec21a2f798932adf8fc69afa56b8322fb0b76f31))
*  fix npm dependency vulnerabilities ([5dd9a887](https://github.com/Huddly/device-api-usb/commit/5dd9a887f89b3bac8d959852bb0bb811ace0fca0))

##### New Features

*  Slack notify when build fails (master) ([91fa3bab](https://github.com/Huddly/device-api-usb/commit/91fa3bab08bbb7ab4f28c660099e5ea013d7e278))
*  Cron trigger master branch (Mon-Fri @ 0700) ([26e6f1f4](https://github.com/Huddly/device-api-usb/commit/26e6f1f440675a7369d64e4816d455a135af88f4))
*  Allow audit check to have a whitelist ([214ef6f8](https://github.com/Huddly/device-api-usb/commit/214ef6f876bbbfaff3a09f6010095a7abcd7daac))
*  Introduce dependency audit-check ([ab09a958](https://github.com/Huddly/device-api-usb/commit/ab09a958be472e06f35256237867ac8f22d72a68))

##### Bug Fixes

* **checkVulnerabilities:**  Validate data before usage ([22af4c75](https://github.com/Huddly/device-api-usb/commit/22af4c752729af37762b0472f06a762fec0b1966))

##### Tests

*  Install chalk-js for terminal styling ([4b62328a](https://github.com/Huddly/device-api-usb/commit/4b62328a16caf22fd58eda598fddce625a3b72dd))

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

