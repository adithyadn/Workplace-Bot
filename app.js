var express = require('express'),
    routes = require('./routes'),
    user = require('./routes/user'),
    http = require('http'),
    path = require('path'),
    fs = require('fs');

var moment = require('moment');
var _ = require('lodash');
/*var cloudant = require('./storage-cloudant')(
    {
        account:'3e7de48e-f967-48c5-aa49-61a811e771c7-bluemix.cloudant.com', 
        password:'40d816a0e9d465e963bf7da8f4d647b6c408795e46285d953c23574741b39320',
        url: 'https://3e7de48e-f967-48c5-aa49-61a811e771c7-bluemix:40d816a0e9d465e963bf7da8f4d647b6c408795e46285d953c23574741b39320@3e7de48e-f967-48c5-aa49-61a811e771c7-bluemix.cloudant.com'
    });
*/
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var multipart = require('connect-multiparty')
var multipartMiddleware = multipart();

var Botkit = require('botkit');
var request = require('request');

var app = express();
var db;
var teams_db;
var users_db;
var channels_db;
var cloudant;
var fileToUpload;

var dbCredentials = {
    dbName: 'workplace_dev',
    team: 'workplace_teams',
    channel: 'workplace_channels',
    _user: "workplace_users"
};

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);
app.use(logger('dev'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/style', express.static(path.join(__dirname, '/views/style')));

// development only
if ('development' == app.get('env')) {
    app.use(errorHandler());
}

//var bot = controller.spawn({ token: 'xoxb-97866698229-BJeBjbO0bmn9uoRvM8lkx9dj' }).startRTM();
var code = ""
var access_token = ""
var verify_token = "vLBWzecNAmRFHBYSDGJwoE3c"

// just a simple way to make sure we don't
// connect to the RTM twice for the same team
var _bots = {};

function trackBot(bot) {
    _bots[bot.config.token] = bot;
}

var watson_conv_api_username = '1a2a51c1-fa07-4066-87f2-27cb657002fb';
var watson_conv_api_password = 'UDVDSKGLZfGf';
var watson_conv_api_workspace = '7f2088e3-3f3d-4660-af9b-db6b0e874ad0';
var url = 'https://gateway.watsonplatform.net/conversation/api/v1/workspaces/' + watson_conv_api_workspace + '/message?version=2016-07-11';

var db_username = '3e7de48e-f967-48c5-aa49-61a811e771c7-bluemix'
var db_password = '40d816a0e9d465e963bf7da8f4d647b6c408795e46285d953c23574741b39320'
var db_host = '3e7de48e-f967-48c5-aa49-61a811e771c7-bluemix.cloudant.com'
var db_port = 443
var db_url = 'https://3e7de48e-f967-48c5-aa49-61a811e771c7-bluemix:40d816a0e9d465e963bf7da8f4d647b6c408795e46285d953c23574741b39320@3e7de48e-f967-48c5-aa49-61a811e771c7-bluemix.cloudant.com'

var slack_token = 'xoxp-97813616293-97818049511-101006606019-99935cde3ad76ca9a6efa19861cbea26'
var slack_url = 'https://slack.com/api/'

var alchemy_apikey = 'b08fc2a53850b4467d7151403b3261d7a32baac9'
var alchemy_url = 'https://gateway-a.watsonplatform.net/calls/text/TextGetCombinedData'

var controller = Botkit.slackbot({
    debug: false,
    stats_optout: true,
    retry: Infinity,
    interactive_replies: true,
    json_file_store: 'workplace_json_db'
        //storage: cloudant
}).configureSlackApp({
    clientId: '20751042293.100268902145',
    clientSecret: '4eb3ad97dc52f32790d5aefb28c3eee2',
    redirectUri: 'https://workplace-botapp.mybluemix.net/oauth',
    scopes: ['bot', 'users:read', 'users.profile:read', 'chat:write:bot']
});

//var bot = controller.spawn({ token: 'xoxb-97866698229-BJeBjbO0bmn9uoRvM8lkx9dj' });
//var bot = controller.spawn({ token: 'xoxb-97866698229-BJeBjbO0bmn9uoRvM8lkx9dj' }).startRTM();

controller.setupWebserver(app.get('port'), function(err, webserver) {
    /*webserver.post('/slack/receive', function(req, res) {
        console.log('/slack/receive')
        console.log(req.body)
        res.send('Success response from slack/receive');
    });*/

    // set up web endpoints for oauth, receiving webhooks, etc.
    controller
        .createHomepageEndpoint(controller.webserver)
        .createOauthEndpoints(controller.webserver, function(err, req, res) {
            console.log("req starts here");
            console.log(req.query)
                //console.log(req)
                //console.log(req)
            code = req.query.code
                //console.log("res starts here");
                //console.log(res)
                //console.log("err starts here");
                //console.log(err)

            if (err) {
                res.status(500).send('ERROR: ' + err);
            } else {
                var teamID = req.identity.team_id;
                var userID = req.identity.user_id;

                controller.storage.teams.get(teamID, function(err, team) {
                    if (err) {
                        console.error('teams get error: ' + err);
                    }
                    //team.access_token = access_token;
                    callSlackApi({ method: 'post', resource: 'team.info' }, { team: team.id, token: team.token }, function(slack_team_res) {
                        console.log('callSlackApi start')
                        console.log(slack_team_res)
                        var slack_team_tmp = JSON.parse(slack_team_res)
                        var slack_team = slack_team_res.team
                        console.log('callSlackApi end')
                        teams_db.insert({
                            id: team.id,
                            team: team,
                            slack_team_profile: slack_team
                        }, team.id, function(err, response) {
                            if (err) {
                                console.log("Error: " + err);
                            } else
                                console.log("Success: " + response);
                        });
                    });
                    controller.storage.users.get(userID, function(err, user) {
                        if (err) {
                            console.error('users get err: ' + err);
                        }
                        callSlackApi({ method: 'post', resource: 'users.info' }, { user: user.id, token: team.token }, function(slack_user_res) {
                            console.log('callSlackApi start')
                            console.log(slack_user_res)
                            var slack_user_tmp = JSON.parse(slack_user_res)
                            var slack_user = slack_user_res.user
                            console.log('callSlackApi end')

                            users_db.insert({
                                id: user.id,
                                user: user,
                                slack_user_profile: slack_user
                            }, user.id, function(err, response) {
                                if (err) {
                                    console.log("Error: " + err);
                                } else
                                    console.log("Success: " + response);
                            });
                        });
                    });
                });
                //res.send('Success!');
                res.send("You've successfully installed this Slack app now!");
            }

        })
        .createWebhookEndpoints(controller.webserver);
});



function initDBConnection() {

    dbCredentials.host = db_host;
    dbCredentials.port = db_port;
    dbCredentials.user = db_username;
    dbCredentials.password = db_password;
    dbCredentials.url = db_url;
    cloudant = require('cloudant')(dbCredentials.url);

    // check if DB exists if not create
    cloudant.db.create(dbCredentials.team, function(err, res) {
        if (err) {
            console.log('could not create db ', err);
        }
    });
    cloudant.db.create(dbCredentials._user, function(err, res) {
        if (err) {
            console.log('could not create db ', err);
        }
    });
    cloudant.db.create(dbCredentials.channel, function(err, res) {
        if (err) {
            console.log('could not create db ', err);
        }
    });
    cloudant.db.create('message', function(err, res) {
        if (err) {
            console.log('could not create db ', err);
        }
    });

    teams_db = cloudant.use(dbCredentials.team);
    users_db = cloudant.use(dbCredentials._user);
    channels_db = cloudant.use(dbCredentials.channel);
    messages_db = cloudant.use('message');

    if (teams_db == null || users_db == null || channels_db == null) {
        console.warn('Could not find Cloudant credentials in VCAP_SERVICES environment variable - data will be unavailable to the UI');
    }
}

initDBConnection();

app.get('/', routes.index);

startBotProcess(controller)

function createResponseData(id, name, value, attachments) {
    var responseData = {
        id: id,
        name: name,
        value: value,
        attachements: []
    };

    attachments.forEach(function(item, index) {
        var attachmentData = {
            content_type: item.type,
            key: item.key,
            url: '/api/favorites/attach?id=' + id + '&key=' + item.key
        };
        responseData.attachements.push(attachmentData);

    });
    return responseData;
}

function insertDocument(id, name, value, response) {
    if (id === undefined) {
        // Generated random id
        id = '';
    }
    users_db.get(id, function(err, doc) {
        if (doc) {
            users_db.insert({
                _id: id,
                _rev: doc._rev,
                name: name,
                vaue: value
            }, function(err, response) {
                if (err) {
                    console.log("error " + err);
                } else {
                    console.log("Success " + response);
                }
            });
        } else {
            users_db.insert({
                name: name,
                value: value
            }, id, function(err, response) {
                if (err) {
                    console.log("error " + err);
                } else
                    console.log("Success " + response);
            });
        }
    });
}

function updateDocument(id, name, value, response) {
    users_db.get(id, function(err, response) {
        console.log(response);
        return users_db.put({
            _id: id,
            _rev: response._rev,
            name: name,
            vaue: value
        });
    }, function(err, response) {
        if (err) {
            console.log("error " + err);
            //response.sendStatus(500);
            //response.end();
        } else {
            console.log("Success " + response);
            //response.end();
        }
    });
}

function deleteDocument(id, doc) {
    users_db.get(id, function(err, doc) {
        users_db.remove(doc, function(err, response) {
            if (err) {
                console.log("error " + err);
                //response.sendStatus(500);
                //response.end();
            } else {
                console.log("Success " + response);
                //response.end();
            }
        });
    });
}

// Gets the first text from an array of potential responses.
function getResponseText(params) {
    for (i = 0; i < params.length; i++) {
        if (params[i]) return params[i];
    }
    return "";
}

function authTest_Slack(json, response1) {
    console.log('authTest_Slack')
    var queryString = { 'token': slack_token }
    request({
            qs: queryString,
            method: 'post',
            url: slack_url + 'auth.test'
        },
        function(error, response, body) {
            if (!error && response.statusCode == 200) {
                response1(body);
            } else {
                console.log(error)
                response1(error);
            }
        }).end();
}

function getUsersInfo_Slack(json, response1) {
    console.log('getUsersList_Slack')
    var queryString = {
        'token': json.access_token,
        'user': json.user
    }

    request({
            qs: queryString,
            method: 'post',
            url: slack_url + 'users.info'
        },
        function(error, response, body) {
            if (!error && response.statusCode == 200) {
                response1(body);
                //console.log(body)
            } else {
                //console.log('error occured here.')
                console.log(error)
                    //console.log(response)
                    //console.log(body) 
                response1(error);
            }
        }).end();
}

function callSlackApi(json, queryString, response1) {
    console.log('callSlackApi')
        //var queryString = queryString
    request({
        qs: queryString,
        method: json.method,
        url: slack_url + json.resource
    }, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            response1(body);
        } else {
            console.log('Error: ' + error)
            response1(error);
        }
    }).end();
}

function callSlackOauthAccess(json, action1) {
    console.log('callSlackOauthAccess')
    var queryString = {
        'client_id': '20751042293.100268902145',
        'client_secret': '4eb3ad97dc52f32790d5aefb28c3eee2',
        'code': code
    }

    request({
            qs: queryString,
            method: 'get',
            url: 'https://slack.com/api/oauth.access'
        },
        function(error, response, body) {
            if (!error && response.statusCode == 200) {
                action1(body);
            } else {
                console.log(error)
                action1(error);
            }
        }).end();
}

// Calls the Watson Conversation service with provided request JSON.
// On response, calls the action function with response from Watson.
function callAlchemyService(json, action1) {
    console.log('callAlchemyService')
    var queryString = {
        'apikey': alchemy_apikey,
        'extract': 'entities,keywords,relations,concepts,doc-emotion,doc-sentiment',
        'outputMode': 'json',
        'text': json.input.text
    }

    request({
            qs: queryString,
            method: 'post',
            url: alchemy_url
        },
        function(error, response, body) {
            if (!error && response.statusCode == 200) {
                action1(body);
            } else {
                console.log(error)
                action1(error);
            }
        }).end();
}

function callConversationService(json, action) {
    request({
            auth: {
                username: watson_conv_api_username,
                password: watson_conv_api_password
            },
            method: 'post',
            json: true,
            url: url,
            headers: {
                'Content-Type': 'application/json'
            }
        },
        function(error, response, body) {
            if (!error && response.statusCode == 200) {
                action(body);
                //console.log(body)
            } else {
                console.log(error)
            }
        }).end(json);
}

// Register to listen for any user communication with bot.
controller.hears('(.*)', ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
    console.log("message starts here")
    console.log(message)
    var timestamp = new Date() / 1000 | 0;

    messages_db.insert({ id: timestamp, message: message, bot: '' }, function(err, response) {
        if (err) {
            console.log("Error: " + err);
        } else
            console.log("Success: " + response);
    });

    var teamId = ''
    if (message.hasOwnProperty('original_message')) {
        teamId = message.team.id
    } else {
        teamId = message.team
    }

    message.token = verify_token

    teams_db.get(teamId, function(error, team) {
        console.log('team info:')
        console.log(team)
        console.log(error)
        if (team) {
            users_db.get(message.user, function(error, user) {
                if (user) {
                    if (user.hasOwnProperty('app')) {
                        var app_data = user.app
                        if (app_data.hasOwnProperty('env')) {
                            var req_json = {
                                'input': { 'text': message.match[1] },
                                'context': {},
                                'output': { 'log_messages': [], 'nodes_visited': [] }
                            }
                            req_json.context = user.app.env.context
                            req_json.output.nodes_visited = user.app.env.output.nodes_visited

                            callConversationService(JSON.stringify(req_json), function(resp2) {
                                var temp_user = resp2.context.user
                                if (resp2.context.user.attach_card && resp2.context.send_to_db) {
                                    var timestamp = new Date() / 1000 | 0;
                                    temp_user.created = timestamp
                                }
                                users_db.insert({
                                    _id: message.user,
                                    _rev: user._rev,
                                    user: user.user,
                                    slack_user_profile: user.slack_user_profile,
                                    app: {
                                        profile: temp_user,
                                        env: {
                                            context: resp2.context,
                                            input: resp2.input,
                                            output: resp2.output,
                                            intent: resp2.intent,
                                            entities: resp2.entities
                                        }
                                    }
                                }, function(err, response) {
                                    if (err) {
                                        console.log("Error: " + err);
                                    } else
                                        console.log("Success: " + response);
                                });

                                if (resp2.context.user.attach_card == true) {
                                    for (var item in resp2.context.attachments) {
                                        resp2.context.attachments[item].color = '#2874A6'
                                    }
                                    var reply_with_attachments = { "attachments": resp2.context.attachments }
                                    var timestamp = new Date() / 1000 | 0;
                                    reply_with_attachments.attachments[0].ts = user.app.profile.created
                                    //console.log(resp2.context.attachments[0].color)
                                    //console.log("attachment color: " + resp2.context.attachments[0].color)

                                    bot.reply(message, reply_with_attachments);
                                }

                                textArray = resp2.output.text
                                if (textArray.length > 1) {
                                    for (var item in textArray) {
                                        var txt = textArray[item];
                                        bot.reply(message, txt);
                                    }
                                } else {
                                    var txt = getResponseText(resp2.output.text);
                                    bot.reply(message, txt);
                                }
                            });
                        } else {
                            callSlackApi({ method: 'post', resource: 'users.info' }, { user: message.user, token: team.team.token }, function(getUsersList_res) {
                                console.log('getUsersList_Slack start')
                                console.log(getUsersList_res)

                                var slack_user_tmp = JSON.parse(getUsersList_res)
                                    //var slack_user = {name:''}
                                var slack_user = slack_user_tmp.user

                                console.log('getUsersList_Slack end')
                                if (!slack_user) {
                                    slack_user = { name: 'Paul' }
                                }
                                callConversationService('{}', function(resp) {
                                    var req_json = '{\"input\":{\"text\":\"' + message.match[1] + '\"},\"context\":{\"conversation_id\":\"' +
                                        resp.context.conversation_id + '\",\"username\":\"' + slack_user.name + '\",\"user\":\"' + app_data.profile + 
                                        '\",\"system\":{\"dialog_stack\":[\"root\"],\"dialog_turn_counter\": 1,\"dialog_request_counter\": 1}}}';
                                    callConversationService(req_json, function(resp2) {
                                        console.log('resp2: start')
                                        console.log(resp2)
                                        console.log('resp2: end')
                                        var timestamp = new Date() / 1000 | 0;
                                        messages_db.insert({ id: timestamp, response: resp2 }, function(err, response) {
                                            if (err) {
                                                console.log("Error: " + err);
                                            } else
                                                console.log("Success: " + response);
                                        });
                                        var temp_user = resp2.context.user
                                        //if (resp2.context.user.attach_card && resp2.context.send_to_db) {
                                        //    var timestamp = new Date() / 1000 | 0;
                                        //    temp_user.updated = timestamp
                                        //}
                                        users_db.insert({
                                            _id: message.user,
                                            _rev: user._rev,
                                            user: user.user,
                                            slack_user_profile: slack_user,
                                            app: {
                                                profile: temp_user,
                                                env: {
                                                    context: resp2.context,
                                                    input: resp2.input,
                                                    output: resp2.output,
                                                    intent: resp2.intent,
                                                    entities: resp2.entities
                                                }
                                            }
                                        }, function(err, response) {
                                            if (err) {
                                                console.log("Error: " + err);
                                            } else
                                                console.log("Success: " + response);
                                        });

                                        /*if (resp2.context.user.attach_card) {
                                            for (var item in resp2.context.attachments) {
                                                resp2.context.attachments[item].color = '#2874A6'
                                            }
                                            var reply_with_attachments = { "attachments": resp2.context.attachments }
                                            var timestamp = new Date() / 1000 | 0;
                                            //reply_with_attachments.attachments[0].ts = timestamp
                                            //console.log(resp2.context.attachment[0].color)
                                            //console.log("attachment color: " + resp2.context.attachments[0].color)

                                            bot.reply(message, reply_with_attachments);
                                        }*/

                                        textArray = resp2.output.text
                                        if (textArray.length > 1) {
                                            for (var item in textArray) {
                                                var txt = textArray[item];
                                                bot.reply(message, txt);
                                            }
                                        } else {
                                            var txt = getResponseText(resp2.output.text);
                                            bot.reply(message, txt);
                                        }
                                    });
                                });
                            });
                        }
                    } else {
                        callSlackApi({ method: 'post', resource: 'users.info' }, { user: message.user, token: team.team.token }, function(getUsersList_res) {
                            console.log('getUsersList_Slack start')
                            console.log(getUsersList_res)

                            var slack_user_tmp = JSON.parse(getUsersList_res)
                                //var slack_user = {name:''}
                            var slack_user = slack_user_tmp.user

                            console.log('getUsersList_Slack end')
                            if (!slack_user) {
                                slack_user = { name: 'Paul' }
                            }
                            callConversationService('{}', function(resp) {
                                var req_json = '{\"input\":{\"text\":\"' + message.match[1] + '\"},\"context\":{\"conversation_id\":\"' +
                                    resp.context.conversation_id + '\",\"username\":\"' + slack_user.name +
                                    '\",\"system\":{\"dialog_stack\":[\"root\"],\"dialog_turn_counter\": 1,\"dialog_request_counter\": 1}}}';
                                callConversationService(req_json, function(resp2) {
                                    console.log('resp2: start')
                                    console.log(resp2)
                                    console.log('resp2: end')
                                    var timestamp = new Date() / 1000 | 0;
                                    messages_db.insert({ id: timestamp, response: resp2 }, function(err, response) {
                                        if (err) {
                                            console.log("Error: " + err);
                                        } else
                                            console.log("Success: " + response);
                                    });
                                    var temp_user = resp2.context.user
                                    if (resp2.context.user.attach_card && resp2.context.send_to_db) {
                                        var timestamp = new Date() / 1000 | 0;
                                        temp_user.updated = timestamp
                                    }
                                    users_db.insert({
                                        _id: message.user,
                                        _rev: user._rev,
                                        user: user.user,
                                        slack_user_profile: slack_user,
                                        app: {
                                            profile: temp_user,
                                            env: {
                                                context: resp2.context,
                                                input: resp2.input,
                                                output: resp2.output,
                                                intent: resp2.intent,
                                                entities: resp2.entities
                                            }
                                        }
                                    }, function(err, response) {
                                        if (err) {
                                            console.log("Error: " + err);
                                        } else
                                            console.log("Success: " + response);
                                    });

                                    if (resp2.context.user.attach_card) {
                                        for (var item in resp2.context.attachments) {
                                            resp2.context.attachments[item].color = '#2874A6'
                                        }
                                        var reply_with_attachments = { "attachments": resp2.context.attachments }
                                        var timestamp = new Date() / 1000 | 0;
                                        reply_with_attachments.attachments[0].ts = timestamp
                                        //console.log(resp2.context.attachment[0].color)
                                        //console.log("attachment color: " + resp2.context.attachments[0].color)

                                        bot.reply(message, reply_with_attachments);
                                    }

                                    textArray = resp2.output.text
                                    if (textArray.length > 1) {
                                        for (var item in textArray) {
                                            var txt = textArray[item];
                                            bot.reply(message, txt);
                                        }
                                    } else {
                                        var txt = getResponseText(resp2.output.text);
                                        bot.reply(message, txt);
                                    }
                                });
                            });
                        });
                    }
                } else {
                    callSlackApi({ method: 'post', resource: 'users.info' }, { user: message.user, token: team.team.token }, function(getUsersList_res) {
                        console.log('getUsersList_Slack start')
                        console.log(getUsersList_res)
                        var slack_user_tmp = JSON.parse(getUsersList_res)
                            //var slack_user = {name:''}
                        var slack_user = slack_user_tmp.user
                        console.log('getUsersList_Slack end')
                        if (!slack_user) {
                            slack_user = { name: 'Paul' }
                        }
                        callConversationService('{}', function(resp) {
                            var req_json = '{\"input\":{\"text\":\"' + message.match[1] + '\"},\"context\":{\"conversation_id\":\"' +
                                resp.context.conversation_id + '\",\"username\":\"' + slack_user.name +
                                '\",\"system\":{\"dialog_stack\":[\"root\"],\"dialog_turn_counter\": 1,\"dialog_request_counter\": 1}}}';
                            callConversationService(req_json, function(resp2) {
                                console.log('resp2: start')
                                console.log(resp2)
                                console.log('resp2: end')

                                var temp_user = resp2.context.user
                                if (resp2.context.user.attach_card && resp2.context.send_to_db) {
                                    var timestamp = new Date() / 1000 | 0;
                                    temp_user.created = timestamp
                                }
                                users_db.insert({
                                    id: message.user,
                                    user: slack_user,
                                    slack_user_profile: slack_user,
                                    app: {
                                        profile: temp_user,
                                        env: {
                                            context: resp2.context,
                                            input: resp2.input,
                                            output: resp2.output,
                                            intent: resp2.intent,
                                            entities: resp2.entities
                                        }
                                    }
                                }, message.user, function(err, response) {
                                    if (err) {
                                        console.log("Error: " + err);
                                    } else
                                        console.log("Success: " + response);
                                });

                                if (resp2.context.user.attach_card) {
                                    for (var item in resp2.context.attachments) {
                                        resp2.context.attachments[item].color = '#2874A6'
                                    }
                                    var reply_with_attachments = { "attachments": resp2.context.attachments }
                                    var timestamp = new Date() / 1000 | 0;
                                    reply_with_attachments.attachments[0].ts = timestamp
                                    //console.log(resp2.context.attachment.color)
                                    //console.log("attachment color: " + resp2.context.attachments[0].color)

                                    bot.reply(message, reply_with_attachments);
                                }

                                textArray = resp2.output.text
                                if (textArray.length > 1) {
                                    for (var item in textArray) {
                                        var txt = textArray[item];
                                        bot.reply(message, txt);
                                    }
                                } else {
                                    var txt = getResponseText(resp2.output.text);
                                    bot.reply(message, txt);
                                }
                            });
                        });
                    });
                }
            });
        }
    });
});

controller.hears('interactive', 'direct_message', function(bot, message) {
    console.log('interactive_message_callback')

    bot.reply(message, {
        attachments: [{
            title: 'Do you want to interact with my buttons?',
            callback_id: '123',
            attachment_type: 'default',
            actions: [{
                "name": "yes",
                "text": "Yes",
                "value": "yes",
                "type": "button",
            }, {
                "name": "no",
                "text": "No",
                "value": "no",
                "type": "button",
            }]
        }]
    });
});

controller.on('interactive_message_callback', function(bot, message) {
    console.log('interactive_message_callback')
        //console.log(message)
    var payload = JSON.parse(message.payload)
    console.log(payload)

    if (payload.token == 'vLBWzecNAmRFHBYSDGJwoE3c') {
        console.log('Request confirmed from Slack.')
        if (payload.callback_id == 'update_profile') {
            console.log('callback id: update_profile')

            bot.replyInteractive(message, {
                text: 'Which one you would like to change now? ',
                attachments: [{
                    text: 'You selected to update your *' + payload.actions[0].name + '*.',
                    color: '#36a64f',
                    mrkdwn_in: ['text', 'pretext']
                }]
            });
        } else if (payload.callback_id == 'appraisal_question') {
            console.log('callback id: appraisal_question')

            bot.replyInteractive(message, {
                text: payload.original_message.attachments[0].text,
                attachments: [{
                    text: 'Your selection was *' + payload.actions[0].name + '*.',
                    color: '#36a64f',
                    mrkdwn_in: ['text', 'pretext']
                }]
            });
        } else if ((payload.callback_id == 'show_profile')) {
            console.log('callback id: show_profile')
            var attachment = payload.original_message.attachments[0]

            bot.replyInteractive(message, {
                text: payload.original_message.attachments[0].text,
                attachments: [{
                    text: 'Your selection was *' + payload.actions[0].name + '*.',
                    color: '#36a64f',
                    mrkdwn_in: ['text', 'pretext']
                }]
            });
        } else if (payload.callback_id == 'confirm_profile') {
            console.log(payload.callback_id)
            var attachment = payload.original_message.attachments[0]
            var message_text;
            switch (payload.actions[0].name) {
                case 'yes':
                    message_text = 'You confirmed the profile looks *good* with above info.'
                    break;
                case 'no':
                    message_text = 'You confirmed the profile looks *incorrect* with above info.'
                    break;
                default:
                    message_text = 'You confirmed the profile looks *' + payload.actions[0].name + '*.'
                    break;
            }
            bot.replyInteractive(message, {
                text: '',
                attachments: [payload.original_message.attachments[0], {
                    text: message_text,
                    color: '#36a64f',
                    mrkdwn_in: ['text', 'pretext']
                }]
            });
        } else if (payload.callback_id == 'submit_appraisal') {
            console.log('callback id: submit_appraisal')
            var message_text;
            switch (payload.actions[0].name) {
                case 'submit':
                    message_text = '*Thank you for submiting the performance appraisal report.*'
                    notifyManager(bot, message.user, payload.team.id);
                    break;
                case 'save':
                    message_text = 'Your performance appraisal report is *saved* now. You can view and submit anytime later.'
                    break;
                case 'delete':
                    message_text = 'Your performance appraisal report is *deleted* now.'
                    break;
                default:
                    message_text = 'Your selection was *' + payload.actions[0].name + '*.'
                    break;
            }
            bot.replyInteractive(message, {
                text: '',
                attachments: [payload.original_message.attachments[0], {
                    text: message_text,
                    color: '#36a64f',
                    mrkdwn_in: ['text', 'pretext']
                }]
            });
        } else if (payload.callback_id == 'approve_appraisal') {
            console.log('callback id: approve_appraisal')
            var message_text;
            switch (payload.actions[0].name) {
                case 'approve':
                    message_text = 'Thanks. You have *approved* above performance appraisal report.'
                    notifyUser(bot, message.user, payload.team.id,'approved');
                    break;
                case 'reject':
                    message_text = 'You have *rejected* above performance appraisal report.'
                    notifyUser(bot, message.user, payload.team.id, 'rejected');
                    break;
                default:
                    message_text = 'Your selection was *' + payload.actions[0].name + '*.'
                    break;
            }
            bot.replyInteractive(message, {
                text: '',
                attachments: [payload.original_message.attachments[0], {
                    text: message_text,
                    color: '#36a64f',
                    mrkdwn_in: ['text', 'pretext']
                }]
            });
        } else {
            console.log('callback not found')
        }
    } else {
        console.log('Error: Request not from Slack.')
    }
});

controller.on('create_bot', function(bot, config) {
    console.log('create_bot: start')
    console.log(config)
    console.log('create_bot: end')
    if (_bots[bot.config.token]) {
        // already online! do nothing.
        console.log("already online! do nothing.")
    } else {
        bot.startRTM(function(err, bot, payload) {
            console.log('payload: start')
                //console.log(payload)
            console.log('payload: end')

            console.log('bot: start')
                //console.log(bot)
            console.log('bot: end')

            if (!err) {
                trackBot(bot);
                console.log("RTM ok")
                    /*controller.storage.teams.save(team, function(err, id) {
                        if (err) {
                            console.log("Error saving team")
                        } else {
                            console.log("Team " + team.name + " saved")
                        }
                    })*/
            } else {
                console.log("RTM failed")
            }

            bot.startPrivateConversation({ user: config.createdBy }, function(err, convo) {
                if (err) {
                    console.log(err);
                } else {
                    callConversationService('{}', function(resp) {
                        console.log('Init Response: start')
                        console.log(resp)
                        console.log('Init Response: end')

                        textArray = resp.output.text
                        if (textArray.length > 1) {
                            for (var item in textArray) {
                                var txt = textArray[item];
                                convo.say(txt);
                            }
                        } else {
                            var txt = getResponseText(resp.output.text);
                            convo.say(txt);
                        }
                    });
                }
            });
        });
    }
});

function notifyManager(bot, userId, teamId) {
    console.log('notifyManager')
    console.log(userId)
    console.log(teamId)
    console.log('notifyManager: parameters')

    teams_db.get(teamId, function(error, team) {
        if (team) {
            users_db.get(userId, function(error, user) {
                if (user) {
                    if (user.hasOwnProperty('app')) {
                        var manager_tmp = user.app.profile.manager
                        var manager = manager_tmp.substring(2, manager_tmp.length - 1);
                        var user_name = user.app.profile.name
                        console.log('manager: ' + manager)

                        callSlackApi({ method: 'post', resource: 'users.info' }, { user: manager, token: team.team.token }, function(getUsersList_res) {
                            console.log('getUsersList_Slack start')
                            console.log(getUsersList_res)
                            var manager_slack = JSON.parse(getUsersList_res)
                            var manager_slack_user = manager_slack.user
                            console.log('getUsersList_Slack end')
                            manager_name = manager_slack_user.name

                            users_db.get(manager, function(err, manager_doc) {
                                if (manager_doc) {
                                    var manager_appraisals_review = [];
                                    if (manager_doc.app.profile.appraisals_review) {
                                        if (manager_doc.app.profile.appraisals_review.length > 0) {
                                            manager_appraisals_review = manager_doc.app.profile.appraisals_review
                                            manager_appraisals_review.push({ appraisee: user.app.profile,
                                                    slack_user: user.slack_user_profile })
                                                //manager_appraisals_review[manager_appraisals_review.length] = { appraisee: user.app.profile }
                                        } else {
                                            manager_appraisals_review.push({ appraisee: user.app.profile,
                                                    slack_user: user.slack_user_profile })
                                        }
                                    } else {
                                        manager_appraisals_review.push({ appraisee: user.app.profile,
                                                    slack_user: user.slack_user_profile })
                                    }
                                    users_db.insert({
                                        _id: manager,
                                        _rev: manager_doc._rev,
                                        user: manager_slack_user,
                                        slack_user_profile: manager_slack_user,
                                        app: {
                                            profile: {
                                                appraisals_review: manager_appraisals_review
                                            }
                                        }
                                    }, function(err, response) {
                                        if (err) {
                                            console.log("Error: " + err);
                                        } else
                                            console.log("Success: " + response);
                                    });
                                } else {
                                    users_db.insert({
                                        id: manager,
                                        user: manager_slack_user,
                                        slack_user_profile: manager_slack_user,
                                        app: {
                                            profile: {
                                                appraisals_review: [{
                                                    appraisee: user.app.profile,
                                                    slack_user: user.slack_user_profile
                                                }]
                                            }
                                        }
                                    }, manager, function(err, response) {
                                        if (err) {
                                            console.log("Error: " + err);
                                        } else
                                            console.log("Success: " + response);
                                    });
                                }
                            });

                            bot.startPrivateConversation({ user: manager }, function(err, convo) {
                                if (err) {
                                    console.log(err);
                                } else {

                                    var attachments = [{
                                        "ts": "",
                                        "text": user.app.profile.name + ' ( ' + user.app.profile.role + ' ) , ' + user.app.profile.department,
                                        "color": "#36a64f",
                                        "title": "Performance Appraisal Report",
                                        "fields": [{
                                            "short": true,
                                            "title": "Technical Skill and Ability",
                                            "value": user.app.profile.appraisal.technical
                                        }, {
                                            "short": true,
                                            "title": "Knowledge of Job",
                                            "value": user.app.profile.appraisal.job_knowledge
                                        }, {
                                            "short": true,
                                            "title": "Quality of Work",
                                            "value": user.app.profile.appraisal.quality_of_work
                                        }, {
                                            "short": true,
                                            "title": "Communication",
                                            "value": user.app.profile.appraisal.communication
                                        }, {
                                            "short": true,
                                            "title": "Teamwork",
                                            "value": user.app.profile.appraisal.teamwork
                                        }, {
                                            "short": false,
                                            "title": "Goal met:",
                                            "value": user.app.profile.appraisal.goals_met
                                        }, {
                                            "short": false,
                                            "title": "Achievements:",
                                            "value": user.app.profile.appraisal.achievements
                                        }, {
                                            "short": false,
                                            "title": "Appraisee comments:",
                                            "value": user.app.profile.appraisal.appraisee_comments
                                        }],
                                        "footer": "User performance appraisal",
                                        "fallback": "Performance Appraisal Report.",
                                        "callback_id": "appraisal_report",
                                        "footer_icon": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTgrremDO1rZJn57FqEVQqS-HZSFBef6Uok3yesoyqgNUEgRU7-tQ"
                                    }, {
                                        "actions": [{
                                            "name": "approve",
                                            "text": "Approve",
                                            "type": "button",
                                            "style": "primary",
                                            "value": "approve appraisal"
                                        }, {
                                            "name": "reject",
                                            "text": "Reject",
                                            "type": "button",
                                            "style": "danger",
                                            "value": "reject appraisal",
                                            "confirm": {
                                                "text": "Would you like to reject this performance report now?",
                                                "title": "Are you sure?",
                                                "ok_text": "Reject",
                                                "dismiss_text": "Cancel"
                                            }
                                        }],
                                        "fallback": "Performance Appraisal Report: Action",
                                        "color": "#36a64f",
                                        "callback_id": "approve_appraisal"
                                    }]

                                    var reply_with_attachments = { "attachments": attachments }

                                    //bot.reply(message, reply_with_attachments);

                                    convo.say('Hello ' + manager_name + '!');
                                    convo.say(user_name + ' has submitted performance appraisal report to you. Please take necesary actions on the report.');
                                    convo.say(reply_with_attachments)
                                }
                            });
                        });
                    } else {
                        console.log('user is not created yet.')
                    }
                } else {
                    console.log('user is not found in database.')
                }
            });
        } else {
            console.log('no teams')
        }
    });
}

function notifyUser(bot, userId, teamId, status) {
    console.log('notifyUser')
    console.log(userId)
    console.log(teamId)
    console.log('notifyUser: parameters')

    teams_db.get(teamId, function(error, team) {
        if (team) {
            users_db.get(userId, function(error, user) {
                if (user) {
                    if (user.hasOwnProperty('app')) {
                        var appraiser_name = user.slack_user_profile.name
                        var reviews = user.app.profile.appraisals_review
                        var appraisee = reviews[reviews.length - 1].slack_user.id

                        var appraisee_name = reviews[reviews.length - 1].slack_user.name


                        bot.startPrivateConversation({ user: appraisee }, function(err, convo) {
                            if (err) {
                                console.log(err);
                            } else {

                                convo.say('Hello ' + appraisee_name + '!');
                                convo.say(appraiser_name + ' has '+status+' your performance appraisal report.');
                                //convo.say(reply_with_attachments)
                            }
                        });
                    } else {
                        console.log('user is not created yet.')
                    }
                } else {
                    console.log('user is not found in database.')
                }
            });
        } else {
            console.log('no teams')
        }
    });
}


function startBotProcess(controller) {
    console.log('startBotProcess')

    users_db.list({ include_docs: true }, function(err, users_data) {
        if (err) {
            console.error("Error: Failed to get all users - " + err);
            throw err;
        }
        var users_data_mapped = _.map(users_data.rows, function(row) {
            return row.doc;
        });
        users_data_mapped.forEach(function(user) {
            console.log('user: start')
            console.log(user)
            console.log('user: end')
            controller.storage.users.save(user.user, function(err, id) {
                if (err) {
                    console.log("Error saving users")
                } else {
                    console.log("User " + user.user.name + " saved locally.")
                }
            });
        });
    });

    teams_db.list({ include_docs: true }, function(err, teams_data) {
        if (err) {
            console.error("Error: Failed to get all teams - " + err);
            throw err;
        }
        var teams_data_mapped = _.map(teams_data.rows, function(row) {
            return row.doc;
        });

        teams_data_mapped.forEach(function(team) {
            console.log('team')
            console.log(team)
            console.log('team')
            controller.storage.teams.save(team.team, function(err, id) {
                if (err) {
                    console.log("Error saving team")
                } else {
                    console.log("Team " + team.team.name + " saved locally.")

                    console.log("Trying to connect to the " + team.team.name + " team...");
                    controller.spawn(team.team).startRTM(function(err, bot) {
                        if (err) {
                            console.error('Error connecting bot to Slack: ', err);
                        }
                        console.log("Connected to the " + team.team.name + " team.");
                        trackBot(bot);
                    });
                }
            });
        });
    });
}

function objectsToList(cb) {
    return function(err, data) {
        if (err) {
            cb(err, data);
        } else {
            var mappedData = _.map(data.rows, function(row) {
                return row.doc;
            });
            cb(err, mappedData);
        }
    };
};


startRTM = function(controller) {
    return controller.storage.teams.all(function(err, teams) {
        if (err) {
            console.error("Failed to get all teams");
            console.error(err);
            throw err;
        }
        return teams.forEach(function(team) {
            console.log("Trying to connect to the " + team.name + " team...");
            return controller.spawn(team).startRTM(function(err, bot) {
                if (err) {
                    return console.error('Error connecting bot to Slack: ', err);
                }
                console.log("Connected to the " + team.name + " team.");
                return trackBot(bot);
            });
        });
    });
};

controller.storage.teams.all(function(err, teams) {

    if (err) {
        throw new Error(err);
    }

    // connect all teams with bots up to slack!
    for (var t in teams) {
        if (teams[t].bot) {
            controller.spawn(teams[t]).startRTM(function(err, bot) {
                if (err) {
                    console.log('Error connecting bot to Slack:', err);
                } else {
                    trackBot(bot);
                }
            });
        }
    }

});
//var team = bot.identifyTeam() // returns team id
//var identity = bot.identifyBot() // returns object with {name, id, team_id}

/*
Slack Button specific events:
create_incoming_webhook   
create_bot  
update_team 
create_team 
create_user 
update_user 
oauth_error
*/
// reply to any incoming message
controller.on('message_received', function(bot, message) {
    //bot.reply(message, 'I heard... something!');
    console.log('message_received')
});

// reply to a direct mention - @bot hello
controller.on('direct_mention', function(bot, message) {
    // reply to _message_ by using the _bot_ object
    console.log('direct_mention')
        //bot.reply(message,'I heard you mention me!');
});

// reply to a direct message
controller.on('direct_message', function(bot, message) {
    // reply to _message_ by using the _bot_ object
    console.log('direct_message')
        //bot.reply(message,'You are talking directly to me');
});

controller.on('channel_joined', function(bot, message) {
    // message contains data sent by slack
    // in this case:
    // https://api.slack.com/events/channel_joined
    console.log('channel_joined')
});

controller.on('channel_leave', function(bot, message) {
    // message format matches this:
    // https://api.slack.com/events/message/channel_leave
    console.log('channel_leave')
});

// Handle events related to the websocket connection to Slack
controller.on('rtm_open', function(bot) {
    console.log('** The RTM api just connected!');
});

controller.on('rtm_close', function(bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
});

controller.hears('^stop', 'direct_message', function(bot, message) {
    console.log('stop - direct_message');
    bot.reply(message, 'Goodbye');
    bot.rtm.close();
});

/*
// receive an interactive message, and reply with a message that will replace the original
controller.on('interactive_message_callback', function(bot, message) {

        // check message.actions and message.callback_id to see what action to take...
        bot.replyInteractive(message, {
                text: '...',
                attachments: [
                        {
                                title: 'My buttons',
                                callback_id: '123',
                                attachment_type: 'default',
                                actions: [
                                        {
                                                "name":"yes",
                                                "text": "Yes!",
                                                "value": "yes",
                                                "type": "button",
                                        },
                                        {
                                             "text": "No!",
                                                "name": "no",
                                                "value": "delete",
                                                "style": "danger",
                                                "type": "button",
                                                "confirm": {
                                                    "title": "Are you sure?",
                                                    "text": "This will do something!",
                                                    "ok_text": "Yes",
                                                    "dismiss_text": "No"
                                                }
                                        }
                                ]
                        }
                ]
        });

});*/

/*/*if (context.user.attach_change_options) {
                                var reply_with_attachments = {
                                    "attachments": [{
                                        "fallback": "User profile change options",
                                        "title": "Which one you would like to change now?",
                                        "callback_id": "profile_callback_1001",
                                        "color": "#3AA3E3",
                                        "attachment_type": "default",
                                        "actions": [{
                                            "name": "name",
                                            "text": "A. Your name is " + context.user.name,
                                            "type": "button",
                                            "value": "name"
                                        }, {
                                            "name": "project_name",
                                            "text": "B. Your project is " + context.user.project,
                                            "type": "button",
                                            "value": "project_name"
                                        }, {
                                            "name": "role",
                                            "text": "C. Your role is " + context.user.role,
                                            "type": "button",
                                            "value": "role"
                                        }, {
                                            "name": "manager",
                                            "text": "D. Your Manager is " + context.user.manager,
                                            "type": "button",
                                            "value": "manager_name"
                                        }]
                                    }]
                                }
                                bot.reply(message, reply_with_attachments);
                            } else */

/*app.get('/slack/message_action', function(req, res) {
    console.log('slack action is called now.')
    console.log(req)
    console.log('========')
    console.log(res)

    res.send('hello');
});
*/
/*
http.createServer(app).listen(app.get('port'), '0.0.0.0', function() {
    console.log('Express server listening on port ' + app.get('port'));
});*/