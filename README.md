# BranchDeploy
Give quick access to your branch using IssueOps

Required input : 

- ssh-host : Host of the SSH server
- ssh-port : Port of the SSH server
- ssh-user : User of the SSH server
- ssh-pwd : Password of the SSH server
- ssh-script : Path to the script on the SSH server
- base-url : Base URL of the web server


The ssh-script is called with the following arguments : `--branch {BRANCH_NAME} --pr {PULL_REQUEST_ID}`  
Also add all the parameters given after `.deploy`
