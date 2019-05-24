#!/bin/bash -l

set -u #Do not allow unset variables
set -x #Print commands
set -e #Exit on error

WIN_IMG_PATH=$1
if [ -z "$WIN_IMG_PATH" ];
then
	WIN_IMG_PATH=./
fi
[ -z "$EXECUTOR_NUMBER" ] && EXECUTOR_NUMBER=0
hostport=$((2222+$EXECUTOR_NUMBER))

GIT_COMMIT=$(git log -n 1 --pretty=format:'%H')
# -machine pc-i440fx-2.8 is critical to remain portable between build hosts
qemu-system-x86_64 \
       -serial none -parallel none -name windows10 \
       -rtc clock=host,base=localtime \
       -smp 8 -enable-kvm -m 8G \
       -device virtio-scsi-pci,id=scsi \
       -drive file=$WIN_IMG_PATH/05-boot-with-workspace.qcow2,if=virtio,index=0 \
       -drive file=$WIN_IMG_PATH/workspace.qcow2,if=virtio,index=1 \
       -net nic -net user,hostfwd=tcp:127.0.0.1:$hostport-:22 \
       -usb -device usb-tablet \
       -display none \
       -machine pc-i440fx-2.8 \
       -loadvm jenkins &
pid=$!
finish() {
	kill $pid
}
trap finish EXIT
sleep 1
# azure cloud uploads need the correct time on the client
ssh -p $hostport -o StrictHostKeyChecking=false jenkins@localhost 'net start w32time && w32tm //resync //force && w32tm //resync //force && date'
scp -P $hostport -r . jenkins@localhost:/d/device-api-usb
ssh -p $hostport jenkins@localhost "cd /d/device-api-usb/scripts && ./build_win.sh $BRANCH_NAME $GIT_COMMIT $AZURE_STORAGE_ACCESS_KEY $AZURE_STORAGE_ACCOUNT"
