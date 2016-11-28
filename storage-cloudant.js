var Cloudant = require('cloudant');
var _ = require('lodash');

module.exports = function(config) {

    var cloudant = Cloudant(config.url);

    var entriesDB;
    var usersDB ;
    var teamsDB;
    var channelsDB ;
    /*
    cloudant.db.destroy('workplace_profiles', function (err) {
        cloudant.db.create('workplace_profiles', function () {
            entriesDB = cloudant.db.use('workplace_profiles');
        });
    });

    cloudant.db.destroy('workplace_users', function (err) {
        cloudant.db.create('workplace_users', function () {
            usersDB = cloudant.db.use('workplace_users');
        });
    });
    
    cloudant.db.destroy('workplace_teams', function (err) {
        cloudant.db.create('workplace_teams', function () {
            teamsDB = cloudant.db.use('workplace_teams');
        });
    });
    
    cloudant.db.destroy('workplace_channels', function (err) {
        cloudant.db.create('workplace_channels', function () {
            channelsDB = cloudant.db.use('workplace_channels');
        });
    });
    */
    entriesDB = cloudant.db.use('workplace_profiles');
    usersDB = cloudant.db.use('workplace_users');
    teamsDB = cloudant.db.use('workplace_teams');
    channelsDB = cloudant.db.use('workplace_channels');
    var messagesDB = cloudant.db.use("messages");


    // var objectsToList = function(cb) {
    //     return function(err, data) {
    //         if (err) {
    //             cb(err, data);
    //         } else {
    //             cb(err, Object.keys(data).map(function(key) {
    //                 return data[key];
    //             }));
    //         }
    //     };
    // };


    var objectsToList = function(cb) {
        return function(err, data) {
            if (err) {
                cb(err, data);
            } else {
                var mappedData = _.map(data.rows, function(row){ return row.doc; });
                cb(err, mappedData);
            }
        };
    };

    var storage = {
        entries: {
            get: function(entry_id, cb) {
                entriesDB.get(entry_id, cb);
            },
            save: function(entry_data, cb) {
                entriesDB.insert(entry_data, entry_data.id, cb);
            },
            all: function(cb) {
                entriesDB.list({include_docs: true}, objectsToList(cb));
            },
            delete: function(entry_id, cb) {
                entriesDB.destroy(entry_id, cb);
            }
        },
        users: {
            get: function(user_id, cb) {
                console.log(user_id);
                usersDB.get(user_id, cb);
            },
            save: function(user, cb) {
                usersDB.insert(user, user.id, cb);
            },
            all: function(cb) {
                usersDB.list({include_docs: true}, objectsToList(cb));
            },
            delete: function(user_id, cb) {
                usersDB.destroy(user_id, cb);
            }
        },
        teams: {
            get: function(team_id, cb) {
                teamsDB.get(team_id, cb);
            },
            save: function(team_data, cb) {
                teamsDB.insert(team_data.id, team_data, cb);
            },
            all: function(cb) {
                teamsDB.list({include_docs: true}, objectsToList(cb));
            },
            delete: function(team_id, cb) {
                teamsDB.destroy(team_id, cb);
            }
        },
        channels: {
            get: function(channel_id, cb) {
                channelsDB.get(channel_id, cb);
            },
            save: function(channel, cb) {
                channelsDB.insert(channel.id, channel, cb);
            },
            all: function(cb) {
                channelsDB.list({include_docs: true}, objectsToList(cb));
            },
            delete: function(channel_id, cb) {
                channelsDB.destroy(channel_id, cb);
            }
        },
        messages: {
            get: function(message_id, cb) {
                messagesDB.get(message_id, cb);
            },
            save: function(message_data, cb) {
                messagesDB.insert(message.id, message_data, cb);
            },
            all: function(cb) {
                messagesDB.list({include_docs: true}, objectsToList(cb));
            },
            delete: function(message_id, cb) {
                messagesDB.destroy(message_id, cb);
            }
        }
    };

    return storage;
};