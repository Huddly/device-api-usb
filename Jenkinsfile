Boolean ISMASTER = BRANCH_NAME == "master" ? true : false
String cronTrigger = ISMASTER ? 'H H(0-2) * * *' : ''

pipeline {
  agent none
  options {
    skipDefaultCheckout()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '50', artifactNumToKeepStr: '50'))
  }
  triggers { cron(cronTrigger) }
  parameters {
    booleanParam(name: 'ReleaseBuild', defaultValue: false, description: 'Should release the built platform')
  }
  stages {
    stage('Build') {
      failFast false
      parallel {
        stage('node 8 mac') {
          agent { label "osx" }
          options { timeout(time: 1, unit: 'HOURS') }
          environment {
            NODE_VERSION="11.9.0"
            RELEASE="${params.ReleaseBuild}"
          }
          steps {
            echo "Running on $NODE_NAME"
            cleanWs()
            checkout scm

             sshagent(credentials: ['04bb3e7e-f3b3-42f9-8792-68b5ee8acafd']) {
              sh('scripts/build_macos.sh');
             }
          }
        }
        stage('node 8 linux') {
          agent { label "linux && rev6" }
          options { timeout(time: 1, unit: 'HOURS') }
          environment {
            NODE_VERSION="11.9.0"
            RELEASE="${params.ReleaseBuild}"
          }
          steps {
            echo "Running on $NODE_NAME"
            cleanWs()
            checkout scm

             sshagent(credentials: ['04bb3e7e-f3b3-42f9-8792-68b5ee8acafd']) {
              sh('scripts/build_linux.sh')
             }
          }
        }
        stage('node 8 win') {
          agent { label "win10-ci01" }
          options { timeout(time: 1, unit: 'HOURS') }
          environment {
            NODE_VERSION="11.9.0"
            RELEASE="${params.ReleaseBuild}"
          }
          steps {
            echo "Running on $NODE_NAME"
            cleanWs()
            checkout scm

             sshagent(credentials: ['04bb3e7e-f3b3-42f9-8792-68b5ee8acafd']) {
              sh('scripts/build_win.sh')
             }
          }
        }
      }
    }
  }
}
