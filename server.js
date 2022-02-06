const express = require("express");
const ExpressApp = express();
const ExpressPort = 3000;
const MongoClient = require('mongodb').MongoClient;
const MongoURL = "mongodb://localhost:27017/";
const ObjectID = require('mongodb').ObjectID;
const crypto = require("crypto");
var salt = crypto.randomBytes(32).toString('hex');


function arrayIncludes(array, obj) {
    if (array) {
        for (var i = 0; i < array.length; ++i) {
            if (array[i] == obj) {
                return true;
            }
        }
    }
    return false;
}

/*******************************************************************************
        ROUTES
*******************************************************************************/

ExpressApp.use(function(httpReq, httpRes, next) {
    httpRes.header("Access-Control-Allow-Origin", "*");
    httpRes.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
ExpressApp.use(express.static(__dirname + "/public"));
ExpressApp.use(express.json());
ExpressApp.use(express.urlencoded());

/*******************************************************************************
    DATABASE
*******************************************************************************/

function accessUsers(httpRes, callback) {
    MongoClient.connect(MongoURL, function(err, db) {
        if (err) throw err;

        var dbo = db.db("tdp013");
        var collection = dbo.collection("users");

        callback(collection);
    });
}

/**
* Control user token before accepting a callback.
**/
function accessUsersSecure(httpRes, username, token, callback) {
    accessUsers(httpRes, function(userCollection) {
        userCollection.findOne({ "username": username }, function(err, user) {
            if (err) throw err;

            if (user) {
                if (token == user.loginToken) {
                    callback(userCollection, user);
                }
                else {
                    // Login Time-out
                    httpRes.sendStatus(440);
                }
            }
            else {
                httpRes.status(500).send("Invalid username.");
            }
        });
    });
}

/**
* Control if the current user is a friend before accepting a callback.
**/
function accessUsersFriendSecure(httpRes, username, token, friend, callback) {
    accessUsersSecure(httpRes, username, token, function(userCollection, user) {
        userCollection.findOne({ "username": friend }, function(err, friendUser) {
            if (err) throw err;

            if (friendUser) {
                if (arrayIncludes(friendUser.friends, username)) {
                    callback(userCollection, user, friendUser);
                }
                else {
                    httpRes.status(500).send("You are not a friend of this user :(");
                }
            }
            else {
                httpRes.status(500).send(`User '${friend}' does not exist.`);
            }
        });
    });
}

/*******************************************************************************
    ROUTES
*******************************************************************************/

// Function to set up a main method handler and use a default 405 handler for other methods.
function route(method, route, callback) {
    const allMethods = [
        "get",
        "post",
        "put",
        "head",
        "delete",
        "patch",
        "options",
    ];

    // Call the function by it's name.
    ExpressApp[method](route, callback);

    // Loop through other methods and assign default handler.
    for (var i = 0; i < allMethods.length; ++i) {
        if (allMethods[i] != method) {
            ExpressApp[allMethods[i]](route, function(httpReq, httpRes) {
                httpRes.sendStatus(405);
            });
        }
    }
}

/**
* This is the route used to register a user. A successful register also returns
* a login-token that can be used to post and read messages.
 **/
route("get", "/register", function(httpReq, httpRes) {
    // Required parameters.
    var username = httpReq.query.username;
    var password = httpReq.query.password;

    if (username && password && password.length >= 8) {
        accessUsers(httpRes, function(userCollection) {
            userCollection.findOne({ "username": username }, function(err, findRes) {
                if (err) throw err;

                // Username should not exist or we exit here.
                if (!findRes) {
                    var salt = generateToken();
                    password = hashString(password + salt);

                    var loginToken = generateToken();

                    userCollection.insertOne({ "username": username, "salt": salt, "password": password, "loginToken": loginToken }, function(err, addRes) {
                        if (err) throw err;

                        if (addRes.result.ok) {
                            httpRes.send(loginToken);
                        }
                        else {
                            httpRes.sendStatus(500);
                        }
                    });
                }
                else {
                    httpRes.sendStatus(500);
                }
            });
        });
    }
    else {
        httpRes.sendStatus(400);
    }
});

/**
* This is the route used to login a user. A successful login returns a token
* that can be used to post and read messages.
 **/
route("get", "/login", function(httpReq, httpRes) {
    // Required parameters.
    var username = httpReq.query.username;
    var password = httpReq.query.password;

    if (username && password) {
        accessUsers(httpRes, function(userCollection) {
            userCollection.findOne({ "username": username }, function(err, findRes) {
                if (err) throw err;

                if (findRes) {
                    password = hashString(password + findRes.salt);

                    if (password == findRes.password) {
                        // Generate a new login token.
                        var loginToken = generateToken();

                        findRes.loginToken = loginToken;

                        // Update the database entry.
                        userCollection.updateOne({ "_id": findRes._id }, { $set: { "loginToken" : loginToken } }, {}, function(err, updateRes) {
                            if (err) throw err;

                            if (updateRes.result.ok) {
                                httpRes.send(loginToken);
                            }
                            else {
                                httpRes.sendStatus(500);
                            }

                            //db.close();
                        });
                    }
                    else {
                        httpRes.status(500).send("Wrong password.");
                    }
                }
                else {
                    httpRes.status(500).send("User does not exist.");
                }
            });
        });
    }
    else {
        httpRes.sendStatus(400);
    }
});

/**
* This is the route used to login a user. A successful login returns a token
* that can be used to post and read messages.
 **/
route("get", "/logout", function(httpReq, httpRes) {
    // Required parameters.
    var username = httpReq.query.username;

    if (username) {
        accessUsers(httpRes, function(userCollection) {
            userCollection.findOne({ "username": username }, function(err, findRes) {
                if (err) throw err;

                if (findRes) {
                    findRes.loginToken = null;

                    // Update the database entry.
                    userCollection.updateOne({ "_id": findRes._id }, { $set: { "loginToken" : null } }, {}, function(err, updateRes) {
                        if (err) throw err;

                        httpRes.sendStatus(updateRes.result.ok ? 200 : 500);
                    });
                }
                else {
                    httpRes.sendStatus(500);
                }
            });
        });
    }
    else {
        httpRes.sendStatus(400);
    }
});

/**
* This functions add a friend by checking if the user exists and is not already
* a friend.
 **/
route("get", "/addfriend", function(httpReq, httpRes) {
    // Required parameters.
    var username = httpReq.query.username;
    var token = httpReq.query.token;
    var friendName = httpReq.query.friend;

    if (username && token && friendName) {
        accessUsersSecure(httpRes, username, token, function(userCollection, user) {
            if (arrayIncludes(user.friends, username)) {
                httpRes.status(500).send(`User '${friendName}' is already your friend :)`);
            }
            else {
                userCollection.findOne({ "username": friendName }, function(err, friend) {
                    if (err) throw err;

                    if (friend) {
                        if (!user.friends) {
                            user.friends = new Array();
                        }
                        user.friends.push(friendName);

                        userCollection.updateOne({ "_id": user._id }, { $set: { "friends" : user.friends } }, {}, function(err, updateRes) {
                            if (err) throw err;

                            httpRes.sendStatus(updateRes.result.ok ? 200 : 500);
                        });
                    }
                    else {
                        httpRes.status(500).send(`User '${friendName}' does not exist :(`);
                    }
                });
            }
        });
    }
    else {
        // Send bad request.
        httpRes.sendStatus(400);
    }
});

route("get", "/getfriends", function(httpReq, httpRes) {
    // Required parameters.
    var username = httpReq.query.username;
    var token = httpReq.query.token;
    var friend = httpReq.query.friend;

    if (username && token) {
        if (!friend || friend == username) {
            accessUsersSecure(httpRes, username, token, function(userCollection, user) {
                var friends = user.friends;
                if (!friends) {
                    friends = new Array();
                }
                httpRes.send(friends);
            });
        }
        else {
            accessUsersFriendSecure(httpRes, username, token, function(userCollection, user, friendUser) {
                var friends = friendUser.friends;
                if (!friends) {
                    friends = new Array();
                }
                httpRes.send(friends);
            });
        }
    }
    else {
        // Send bad request.
        httpRes.sendStatus(400);
    }
});

/**
* This is the route used to add new messages to a user message board.
* The messages are saved to the users messages and immediately marked as read.
 **/
route("get", "/postmessage", function(httpReq, httpRes) {
    // Required parameters.
    var username = httpReq.query.username;
    var token = httpReq.query.token;
    var message = httpReq.query.message;
    // Optional parameters.
    var friend = httpReq.query.friend;

    if (username && token && message && message.length > 0 && message.length <= 140) {
        if (!friend || friend == username) {
            // Add a message to the user's personal message board.
            accessUsersSecure(httpRes, username, token, function(userCollection, user) {
                if (!user.messages) {
                    // Initialize the messages array.
                    user.messageID = 1;
                    user.messages = new Array();
                }
                // Push message and increment messageID.
                user.messages.push({ "id": user.messageID++, "from": username, "message": message, "flag": true, });

                userCollection.updateOne({ "_id": user._id }, { $set: { "messageID": user.messageID, "messages" : user.messages } }, {}, function(err, updateRes) {
                    if (err) throw err;

                    httpRes.sendStatus(updateRes.result.ok ? 200 : 500);
                });
            });
        }
        else {
            // Add a message to a friends message board.
            accessUsersFriendSecure(httpRes, username, token, friend, function(userCollection, user, friendUser) {
                if (!friendUser.messages) {
                    friendUser.messageID = 1;
                    friendUser.messages = new Array();
                }
                friendUser.messages.push({ "id": friendUser.messageID++, "from": username, "message": message, "flag": false, });

                userCollection.updateOne({ "_id": friendUser._id }, { $set: { "messageID": friendUser.messageID, "messages" : friendUser.messages } }, {}, function(err, updateRes) {
                    if (err) throw err;

                    httpRes.sendStatus(updateRes.result.ok ? 200 : 500);
                });
            });
        }
    }
    else {
        // Send bad request.
        httpRes.sendStatus(400);
    }
});

route("get", "/getmessages", function(httpReq, httpRes) {
    // Required parameters.
    var username = httpReq.query.username;
    var token = httpReq.query.token;
    // Optional parameters.
    var friend = httpReq.query.friend;

    if (username && token) {
        if (!friend || friend == username) {
            // Get a friends messages.
            accessUsersSecure(httpRes, username, token, function(userCollection, user) {
                var messages = user.messages;
                if (!messages) {
                    message = new Array();
                }
                httpRes.send(messages);
            });
        }
        else {
            // Get a friends messages.
            accessUsersFriendSecure(httpRes, username, token, friend, function(userCollection, user, friendUser) {
                var messages = friendUser.messages;
                if (!messages) {
                    message = new Array();
                }
                httpRes.send(messages);
            });
        }
    }
    else {
        // Send bad request.
        httpRes.sendStatus(400);
    }
});

/**
* Mark a message status.
**/
route("get", "/flagmessage", function(httpReq, httpRes) {
    // Required parameters.
    var username = httpReq.query.username;
    var token = httpReq.query.token;
    var id = httpReq.query.ID;

    if (username && token && id) {
        accessUsersSecure(httpRes, username, token, function(userCollection, user) {
            if (user.messages) {
                var message = user.messages.find(m => m.id == id);
                if (message) {
                    message.flag = true;
                    userCollection.updateOne({ "_id": user._id }, { $set: { "messages" : user.messages } }, {}, function(err, updateRes) {
                        if (err) throw err;

                        httpRes.sendStatus(updateRes.result.ok ? 200 : 500);
                    });
                }
                else {
                    httpRes.status(500).send(`No message with id '${id}' found.`);
                }
            }
            else {
                httpRes.status(500).send("You have no messages.");
            }
        });
    }
    else {
        httpRes.sendStatus(400);
    }
});

route("get", "/getusers", function(httpReq, httpRes) {
    var search = httpReq.query.search;
    if (!search) {
        search = "";
    }
    else {
        search = search.toLowerCase();
    }

    accessUsers(httpRes, function(userCollection) {
        userCollection.find().toArray(function(err, findRes) {
            var results = new Array();
            // Make sure to only return the usernames and nothing else.
            for (var i = 0; i < findRes.length; ++i) {
                if (findRes[i].username.toLowerCase().includes(search)) {
                    results.push(findRes[i].username);
                }
            }

            httpRes.send(results);
        });
    });
});

// This is just for testing!
route("get", "/testusers", function(httpReq, httpRes) {
    accessUsers(httpRes, function(userCollection) {
        userCollection.find().toArray(function(err, findRes) {
            httpRes.send(findRes);
        });
    });
});

// This is just for testing!
route("get", "/drop", function(httpReq, httpRes) {
    MongoClient.connect(MongoURL, function(err, db) {
        if (err) throw err;

        var dbo = db.db("tdp013");
        var messages = dbo.collection("users");
        messages.drop(function(err, dropRes) {
            if (err) throw err;

            httpRes.sendStatus(200);
        });
    });
});

var server = null;
function startServer(callback = null) {
    server = ExpressApp.listen(ExpressPort, function() {
        var host = server.address().address;
        var port = server.address().port;

        console.log('Example app listening at http://%s:%s', host, port);

        if (callback) {
            callback();
        }
    });
}
function stopServer() {
    if (server) {
        server.close();
        server = null;
    }
}

// Start the server if this file is not required as a module.
if (!module.parent) {
    startServer();
}

/*******************************************************************************
    UTILITY
*******************************************************************************/

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}
function hashString(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

/*******************************************************************************
    EXPORTS
*******************************************************************************/

var exports = module.exports = {};
exports.startServer = startServer;
exports.stopServer = stopServer;
