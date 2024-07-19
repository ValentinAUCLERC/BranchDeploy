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
            // This is an issue_comment event
            issue_number = github.context.payload.issue.number;
            const {owner, repo} = github.context.repo;
            const response = await octokit.rest.pulls.get({
                owner: owner,
                repo: repo,
                pull_number: issue_number
            });
            pr = response.data;
        } else if (github.context.payload.pull_request) {
            // This is a pull_request event
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

        if (github.context.eventName === 'issue_comment') {
            const commandPattern = /^\.deploy\s*/;
            const triggerComment = github.context.payload.comment.body;
            if (commandPattern.test(triggerComment)) {
                let paramString = triggerComment.replace(commandPattern, '');
                if (/(--\w+\s?\w*)\s*/g.test(paramString) === false && paramString !== '') {
                    createComment('👮 Pour des raisons de sécurité, la seule syntaxe de paramètres autorisée est : `--param1 value1 --param2 --param3...`');
                } else {
                        const paramObject = {};
                        if (paramString && paramString.trim()) {
                            paramString.match(/--\S+(?:\s+\S+)?/g).forEach(param => {
                                const parts = param.split(' ');
                                const paramName = parts[0].replace(/^--/, '');
                                const paramValue = parts[1] || null;
                                paramObject[paramName] = paramValue;
                            });
                        }
                        axios.post(post_url, {
                            baseUrl: base_url,
                            pr: issue_number,
                            branch: pr.head.ref,
                            action: action,
                            parameters: paramObject
                        }).then(function (response) {
                            createComment(`### Branches dynamiques 🚀
__${github.context.actor}__, a demandé le démarrage d'un déploiement !
Les détails d'exécution se trouvent [ici](https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${process.env.GITHUB_RUN_ID}) 🔗
> Branche: \`${pr.head.ref}\`
✅ Résultat du script :
${response.data}`);
                        }).catch(function (error) {
                            createComment(`Une erreur s'est produite lors de l'exécution du script : ${error}`);
                        });
                }
            }
        }

        if (action === "delete") {
            axios.post(post_url, {
                baseUrl: base_url,
                pr: issue_number,
                branch: pr.head.ref,
                action: action
            }).then(function (response) {
                if(response.data != "") {
                    createComment(`### Branches dynamiques 🚀
__${github.context.actor}__ a demandé un nettoyage !
Les détails se trouvent [ici](https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${process.env.GITHUB_RUN_ID}) 🔗
> Branche: \`${pr.head.ref}\`
✅ Résultat de l'exécution :
${response.data}`);
                }
            }).catch(function (error) {
                console.log(error);
            });
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
