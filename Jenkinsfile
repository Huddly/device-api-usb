Boolean ISMASTER = BRANCH_NAME == "master" ? true : false
String cronTrigger = ISMASTER ? 'H H(0-2) * * *' : ''
Map stage_node_info = [:]

String commitHash = ""

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
  environment {
    GIT_BRANCH = "${BRANCH_NAME}"
    NODE_VERSION="11.9.0"
    RELEASE="${params.ReleaseBuild}"
  }
  stages {
    stage('Build') {
      failFast true
      agent { label "docker" }
      steps {
        echo "Running on $NODE_NAME"
        script {
          commitHash = sh(returnStdout: true, script: 'git rev-parse HEAD').trim()
        }
        timeout(30) {
          ws("/var/jenkins/workspace/executor$EXECUTOR_NUMBER") {
            cleanWs()
            checkout scm
            withCredentials([string(credentialsId: 'azuredeviceapiusbbinariesStorageToken', variable: 'AZURE_STORAGE_ACCESS_KEY')]) {
              withEnv([ 'AZURE_STORAGE_ACCOUNT=deviceapiusb' ]) {
                ansiColor('xterm') {
                  sh 'scripts/build_on_qemu.sh ~/win10'
                }
              }
            }
          }
        }
      }
      post {
        always {
          cleanWs()
          script { stage_node_info["$STAGE_NAME"] = "$NODE_NAME"}
        }
        success {
          set_github_commit_status("SUCCESS", "device-api-usb", commitHash, "Commit Passed")
        }
        failure {
          set_github_commit_status("FAILURE", "device-api-usb", commitHash, "Commit Failed")
          send_slack_Failure(BRANCH_NAME, "#device-api-usb", stage_node_info)
        }

      }
    }
  }
}
