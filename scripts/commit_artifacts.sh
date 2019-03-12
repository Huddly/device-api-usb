#!/bin/bash
set -e
set -x

git config --global user.email "jenkins@huddly.com"
git config --global user.name "Jenkins CI"
git config --global push.default current
git add -f prebuilds
echo $GIT_BRANCH
git checkout $GIT_BRANCH
git lfs install
git commit -m "[ci skip] Prebuilds ${OS}"
git reset --hard
git pull --rebase
git push --quiet
