var assert = require('assert');
var expect = require("chai").expect;
var request = require("superagent");
var express = require("../server.js");

const username = "I_hate_my_job_as_a_tester";
const password = "iR3allyD0";
const friend = "The_Friendly_Friend";
const friendPassword = "12345678";
var loginToken;
var friendLoginToken;

describe("Start up the server.", function() {
    it("Call startServer().", function(done) {
        express.startServer(function() { done(); });
    });
});

describe("Drop the MongoDB in preparation for other tests.", function() {
    it("Do a request to /drop.", function(done) {
        request.get("http://localhost:3000/drop").then(function(res) {
            expect(res.status).to.equal(200);
            done();
        });
    });
});

describe("Register, log in and out a new user.", function() {
    it("Do a request to /register with password as 'abc' (too short).", function(done) {
        request.get(`http://localhost:3000/register?username=${username}&password=abc`).then().catch(function(err) {
            expect(err.status).to.equal(400);
            done();
        });
    });
    it(`Do a request to /register with a valid password.`, function(done) {
        request.get(`http://localhost:3000/register?username=${username}&password=${password}`).then(function(res) {
            expect(res.status).to.equal(200);
            done();
        });
    });
    it("Do another request to /register with the same username and password.", function(done) {
        request.get(`http://localhost:3000/register?username=${username}&password=${password}`).then().catch(function(err) {
            expect(err.status).to.equal(500);
            done();
        });
    });
    it("Do a request to /logout with our username.", function(done) {
        request.get(`http://localhost:3000/logout?username=${username}`).then(function(res) {
            expect(res.status).to.equal(200);
            done();
        });
    });
    it("Do a request to /login with our username and a different password than we registered with.", function(done) {
        request.get(`http://localhost:3000/login?username=${username}&password=NotOurPassword`).then().catch(function(err) {
            expect(err.status).to.equal(500);
            done();
        });
    });
    it("Do a request to /login with another username that does not exist", function(done) {
        request.get(`http://localhost:3000/login?username=The_One_Who_Likes_Testing&password=${password}`).then().catch(function(err) {
            expect(err.status).to.equal(500);
            done();
        });
    });
    it("Do a request to /login with the correct username and password, and save the login token to test other methods.", function(done) {
        request.get(`http://localhost:3000/login?username=${username}&password=${password}`).then(function(res) {
            expect(res.status).to.equal(200);
            loginToken = res.text;
            done();
        });
    });
});

describe("Using our username and login token; post a message, mark it as read and finally get all our messages.", function() {
    it("Do a request to /postmessage with the wrong username.", function(done) {
        request.get(`http://localhost:3000/postmessage?username=Not_My_Username&token=${loginToken}&message=Hej!`).then().catch(function(err) {
            expect(err.status).to.equal(500);
            done();
        });
    });
    it("Do a request to /postmessage with an invalid token.", function(done) {
        request.get(`http://localhost:3000/postmessage?username=${username}&token=aabbcc&message=Hej!`).then().catch(function(err) {
            expect(err.status).to.equal(440);
            done();
        });
    });
    it("Before posting the message successfully, do a request to /flagmessage when the user has no messages.", function(done) {
        request.get(`http://localhost:3000/flagmessage?username=${username}&token=${loginToken}&ID=1`).then().catch(function(err) {
            expect(err.status).to.equal(500);
            done();
        });
    });
    it("Do a request to /postmessage with only valid parameters.", function(done) {
        request.get(`http://localhost:3000/postmessage?username=${username}&token=${loginToken}&message=Hej!`).then(function(res) {
            expect(res.status).to.equal(200);
            done();
        });
    });
    it("Do a request to /flagmessage with ID 2 which does not exist.", function(done) {
        request.get(`http://localhost:3000/flagmessage?username=${username}&token=${loginToken}&ID=2`).then().catch(function(err) {
            expect(err.status).to.equal(500);
            done();
        });
    });
    it("Do a request to /flagmessage with ID 1 as we have only posted one message.", function(done) {
        request.get(`http://localhost:3000/flagmessage?username=${username}&token=${loginToken}&ID=1`).then(function(res) {
            expect(res.status).to.equal(200);
            done();
        });
    });
});

describe("Register a new user, make both users friends.", function() {
    it("Register new user and save login token.", function(done) {
        request.get(`http://localhost:3000/register?username=${friend}&password=${friendPassword}`).then(function(res) {
            expect(res.status).to.equal(200);
            friendLoginToken = res.text;
            done();
        });
    });
    it("Get both users via /getusers and make sure the usernames are correct.", function(done) {
        request.get("http://localhost:3000/getusers").then(function(res) {
            expect(res.status).to.equal(200);
            expect(res.body[0]).to.equal(username);
            expect(res.body[1]).to.equal(friend);
            done();
        });
    });
    it("Search for a user via /getusers using part of the username.", function(done) {
        var usernameSub = username.substring(3, 6);
        request.get(`http://localhost:3000/getusers?search=${usernameSub}`).then(function(res) {
            expect(res.status).to.equal(200);
            expect(res.body.includes(username)).to.equal(true);
            done();
        });
    });
    it("Make both users friends of each other.", function(done) {
        request.get(`http://localhost:3000/addfriend?username=${username}&token=${loginToken}&friend=${friend}`).then(function(res) {
            expect(res.status).to.equal(200);
            done();
        });
    });
    it("Make both users friends of each other.", function(done) {
        request.get(`http://localhost:3000/addfriend?username=${friend}&token=${friendLoginToken}&friend=${username}`).then(function(res) {
            expect(res.status).to.equal(200);
            done();
        });
    });
});

describe("Drop the MongoDB in preparation for other tests.", function() {
    it("Do a request to /drop.", function(done) {
        request.get("http://localhost:3000/drop").then(function(res) {
            expect(res.status).to.equal(200);
            done();
        });
    });
});

describe("Shut down the server.", function() {
    it("Call stopServer().", function(done) {
        express.stopServer();
        done();
    });
});
