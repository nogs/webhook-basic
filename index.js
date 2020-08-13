const http = require('http')

console.log('hook test starting...')

http.createServer( function(request, response) {
    try {
        if ( request.method === 'POST' ) {
            const eventName = request.headers["x-github-event"]
            const signature = request.headers["x-hub-signature"]
            const id = request.headers["x-github-delivery"]

            var payload = '';

            request.setEncoding('utf8')

            request.on( 'error', function(error) {
                console.log(`Error reading request body: ${error}`)
                response.writeHead( 500, 'OK', {
                    'Content-Type': 'text/plain'
                })
                response.end()
                return
            })

            request.on( 'data', function(data) {
                payload += data
            })

            request.on( 'end', function() {
                valid = processRequest(eventName, signature, id, payload)
                if (!valid) {
                    response.writeHead( 501, 'OK', {
                        'Content-Type': 'text/plain'
                    })
                    response.end()
                } else {
                    response.writeHead( 200, 'OK', {
                        'Content-Type': 'text/plain'
                    })
                    response.end()        
                }
            })
        } else { 
            console.log(`${request.method}`)
            
            response.writeHead( 200, 'OK', {
                'Content-Type': 'text/plain'
            })
            response.end()
        }
    } catch (error) {
        console.log(`Error thrown processing request: ${error}`)
        response.writeHead( 500, 'OK', {
            'Content-Type': 'text/plain'
        })
        response.end()
    }
}).listen(3000)

function processRequest(eventName, signature, id, payload) {
    console.log(`${eventName} - ${signature} - ${id}`)

    const { verify, sign } = require('@octokit/webhooks')
    const matchesSignature = verify(process.env.GITHUB_SECRET, payload, signature)
    const calculatedSignature = sign(process.env.GITHUB_SECRET, payload)

    const fs = require('fs');
    try {
      fs.writeFileSync(`${signature}-${calculatedSignature}`, payload);
    } catch (error) {
      console.log(error)
    }
    
    if (!matchesSignature) {
        console.log(`Mismatched signatures - ${signature} - ${calculatedSignature}`)
        return false
    }

    if ( eventName === 'issue_comment' ) {
        eventData = JSON.parse(payload)

        const { Octokit } = require("@octokit/rest");
        const { createAppAuth } = require("@octokit/auth-app");
  
        const octokit = new Octokit({
          authStrategy: createAppAuth,
          auth: {
            id: process.env.GITHUB_APP_ID,
            privateKey: process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),  // replace newlines as macos/zsh? has fun with them
            installationId: eventData.installation.id,
          },
        });
  
        setTimeout(function postComment() {
            const comment = randomString(200)
            const issueComment = {
                owner: eventData.repository.owner.login,
                repo: eventData.repository.name,
                issue_number: eventData.issue.number,
                body: comment
            }

            console.log({ newBody: comment })
            octokit.issues.createComment(issueComment);
        }, 5000);
    }

    return true
}

function randomString(length) {
    const crypto = require('crypto');
    var array = new Uint16Array(length);
    crypto.randomFillSync(array);
    var str = '';
    for (var i = 0; i < array.length; i++) {
      str += String.fromCharCode(array[i]);
    };
    return str;
}