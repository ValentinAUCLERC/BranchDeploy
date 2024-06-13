const core = require('@actions/core');
const github = require('@actions/github');
const {Client} = require('ssh2');
const axios = require('axios');

const main = async () => {
    try {
        const ssh_host = core.getInput('ssh-host');
        const ssh_port = core.getInput('ssh-port');
        const ssh_username = core.getInput('ssh-user');
        const ssh_password = core.getInput('ssh-pwd');
        const ssh_script = core.getInput('ssh-script');
        const post_url = core.getInput('post-url');
        const base_url = core.getInput('base-url');
        const action = core.getInput('action');
        const token = core.getInput('token', {required: true});
        const octokit = new github.getOctokit(token);

        // Determine the issue_number and pull_request details
        let issue_number;
        let pr;

        if (github.context.payload.issue) {
            issue_number = github.context.payload.issue.number;
            const {owner, repo} = github.context.repo;
            pr = await octokit.rest.pulls.get({
                owner: owner,
                repo: repo,
                pull_number: issue_number
            });
        } else if (github.context.payload.pull_request) {
            issue_number = github.context.payload.pull_request.number;
            pr = github.context.payload.pull_request;
        } else {
            throw new Error("Cannot determine the pull request number.");
        }

        const {owner, repo} = github.context.repo;

        function createComment(body) {
            octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: issue_number,
                body: body
            });
        }

        if (github.context.event_name === 'issue_comment') {
            const commandPattern = /^\.deploy\s*/;
            const triggerComment = github.context.payload.comment.body;
            if (commandPattern.test(triggerComment)) {
                createComment(`### Deployment Triggered 🚀
__${github.context.actor}__, started a deployment !
You can watch the progress [here](https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${process.env.GITHUB_RUN_ID}) 🔗
> Branch: \`${pr.data.head.ref}\``);

                var paramString = triggerComment.replace(commandPattern, '');
                if (/(--\w+\s?\w*)\s*/g.test(paramString) === false && paramString !== '') {
                    createComment('👮 Due to security policy, you can only use parameters this way : `--param1 value1 --param2 --param3...`');
                } else {
                    if (ssh_host != "") {
                        const conn = new Client();
                        conn.on('ready', () => {
                            let output = '';
                            conn.exec(`${ssh_script} --base-url ${base_url} --action ${action} --pr ${issue_number} --branch ${pr.data.head.ref} ${paramString}`, (err, stream) => {
                                if (err) throw err;
                                stream.on('data', (data) => {
                                    output += "> " + data;
                                }).on('close', (code) => {
                                    console.log('stream :: close\n', {code});
                                    conn.end();
                                    createComment(`✅ Script has been executed, here is the output :
                                    ${output}`);
                                });
                            });
                        }).connect({
                            host: ssh_host,
                            port: ssh_port,
                            username: ssh_username,
                            password: ssh_password
                        });
                    } else {
                        axios.post(post_url, {
                            baseUrl: base_url,
                            pr: issue_number,
                            branch: pr.data.head.ref,
                            action: action
                        }).then(function (response) {
                            createComment(`✅ Script has been executed, here is the output :
                            ${response.data}`);
                        }).catch(function (error) {
                            console.log(error);
                        });
                    }
                }
            }
        }

        if (action === "delete") {
            createComment(`### Deployment Triggered 🚀
__${github.context.actor}__ asked for a cleaning !
You can watch the progress [here](https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${process.env.GITHUB_RUN_ID}) 🔗
> Branch: \`${pr.data.head.ref}\``);

            axios.post(post_url, {
                baseUrl: base_url,
                pr: issue_number,
                branch: pr.data.head.ref,
                action: action
            }).then(function (response) {
                createComment(`✅ Script has been executed, here is the output :
                ${response.data}`);
            }).catch(function (error) {
                console.log(error);
            });
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
