#!/bin/bash
set -e
set -x

git config --global user.email "travis@travis-ci.org"
git config --global user.name "Travis CI"
git config --global push.default current
git add -f prebuilds
git checkout $TRAVIS_BRANCH
git commit -m '[ci skip] Prebuilds ${TRAVIS_OS_NAME}'
git remote add origin-https https://${GITHUB_TOKEN}@github.com/Huddly/device-api-usb.git > /dev/null 2>&1
git pull origin-https --rebase
git push --quiet --set-upstream origin-https
