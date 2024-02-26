const core = require('@actions/core');
const github = require('@actions/github');
const { Client } = require('ssh2');
const {issue} = require("@actions/core/lib/command");

const main = async() => {
    try {
        const host = core.getInput('ssh-host');
        const port = core.getInput('ssh-port');
        const username = core.getInput('ssh-user');
        const password = core.getInput('ssh-pwd');
        const script = core.getInput('ssh-script');
        const base_url = core.getInput('base-url');

        const token = core.getInput('token', { required: true });
        const octokit = new github.getOctokit(token);

        const issue_number = github.context.payload.issue.number;
        const {owner, repo} = github.context.repo;

        function createComment(body) {
            octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: issue_number,
                body: body
            });
        }

        const pr = await octokit.rest.pulls.get({
            owner: owner,
            repo: repo,
            pull_number: issue_number
        });

        var commandPattern = /^\.deploy\s*/;
        var triggerComment = github.context.payload.comment.body;
        if(commandPattern.test(triggerComment)) {
            createComment(`### Deployment Triggered 🚀
__${github.context.actor}__, started a deployment to SSH !
You can watch the progress [here](https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${process.env.GITHUB_RUN_ID}) 🔗
> Branch: \`${pr.data.head.ref}\``);
            var paramString = triggerComment.replace(commandPattern, '');
            if(/(--\w* \S*)\s*/g.test(paramString) === false && paramString !== '') {
                createComment('👮 Due to security policy, you can only use parameters this way : `--param1 value1 --param2 value2...`')
            } else {
                const conn = new Client();
                conn.on('ready', () => {
                    let output = '';
                    conn.exec(script+' --base-url '+ base_url +' --pr '+ github.context.issue.number +' --branch '+pr.data.head.ref+' '+paramString, (err, stream) => {
                        if (err) throw err;
                        stream.on('data', (data) => {
                            output += "> "+data;
                        }).on('close', (code) => {
                            console.log('stream :: close\n', { code });
                            conn.end();
                            createComment(
`✅ Script has been executed, here is the output :
${output}`
                            );
                        });
                    });

                }).connect({
                    host: host,
                    port: port,
                    username: username,
                    password: password
                });
            }
        }
    } catch(error) {
        core.setFailed(error.message)
    }

}

main();



