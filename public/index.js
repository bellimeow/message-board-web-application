var loggedInUser = localStorage.getItem("loggedInUser");
var loginToken = localStorage.getItem("loginToken");
var viewingUser = null;//localStorage.getItem("viewingUser");

function isLoggedIn() {
    return !(!loggedInUser || loggedInUser == "null" || loggedInUser == "");
}

function refreshPage() {
    updateMessageBoard();
    updateFriendsList();
    updateUserList();
    updateLogInStatus();
}

function setViewingUser(username) {
    viewingUser = username;
    //localStorage.setItem("viewingUser", username);
    refreshPage();
}

function signInClick() {
    var username = document.getElementById("input-username").value;
    var password = document.getElementById("input-password").value;
    logInUser(username, password);
}
function signUpClick() {
    var username = document.getElementById("input-username").value;
    var password = document.getElementById("input-password").value;
    registerUser(username, password);
}
function signOutClick() {
    logOutUser();
}

function friendClick(element) {
    setViewingUser(element.getAttribute("data-friend-name"));
}
function addFriendClick(element) {
    addFriend(element.getAttribute("data-user-name"));
}

function searchUsers() {
    updateUserList();
}

function validateInput() {
    var message = document.getElementById("message").value;
    if (message.length > 140) {
        showPopup();
    } else if (message.length > 0) {
        postMessage(message);
        $("#message").val("");
    }
}

var hidePopupTimerId
function showPopup() {
    var popup = document.getElementById("mypopup");
    popup.classList.add("show");
    window.clearTimeout(hidePopupTimerId);
    hidePopupTimerId = window.setTimeout(hidePopup, 3000);
}
function hidePopup() {
    var popup = document.getElementById("mypopup");
    popup.classList.remove("show");
}

function markElementAsRead(element, flag) {
    if (flag) {
        element.classList.remove("alert-primary");
        element.classList.add("alert-light");
    }
    else {
        element.classList.remove("alert-light");
        element.classList.add("alert-primary");
    }
}

function showFriendList(friendCollection) {
    var friendList = document.getElementById("list-group");
    var friendElement = document.createElement("a");
    var createAText = document.createTextNode(theCounter);
    createA.setAttribute('href', "https://");
    createA.appendChild(createAText);
    getTheTableTag.appendChild(createA);
}

/*******************************************************************************
    AJAX
*******************************************************************************/

function registerUser(username, password) {
    if (isLoggedIn()) {
        alert("A user is already logged in.");
    }
    else if (!username) {
        alert("A username is required to register.");
    }
    else if (!password || password.length < 8) {
        alert("Password length must be greater than or equal to 8.")
    }
    else {
        $.get("http://localhost:3000/register", `username=${username}&password=${password}`, function(data, status) {
            if (status == "success") {
                loggedInUser = username;
                localStorage.setItem("loggedInUser", username);
                loginToken = data;
                localStorage.setItem("loginToken", data);
                refreshPage();
            }
        });
    }
}
function logInUser(username, password) {
    if (isLoggedIn()) {
        alert("A user is already logged in.");
    }
    else if (!username) {
        alert("Username required.");
    }
    else if (!password || password.length < 8) {
        alert("Invalid password.");
    }
    else {
        $.get("http://localhost:3000/login", `username=${username}&password=${password}`, function(data, status) {
            if (status == "success") {
                loggedInUser = username;
                localStorage.setItem("loggedInUser", username);
                loginToken = data;
                localStorage.setItem("loginToken", data);
                refreshPage();
            }
        });
    }
}
function logOutUser() {
    $.get("http://localhost:3000/logout", `username=${loggedInUser}`, function(data, status) {
        /*
        if (status == "success") {
            loggedInUser = null;
            localStorage.removeItem("loggedInUser");
            loginToken = null;
            localStorage.removeItem("loginToken");
            refreshPage();
        }
        */
    });

    // Log out locally.
    loggedInUser = null;
    localStorage.removeItem("loggedInUser");
    loginToken = null;
    localStorage.removeItem("loginToken");
    viewingUser = null;
    refreshPage();
}

function addFriend(friend) {
    if (isLoggedIn()) {
        $.get("http://localhost:3000/addfriend", `username=${loggedInUser}&token=${loginToken}&message=${message}&friend=${friend}`, function(data, status) {
            if (status == "success") {
                updateFriendsList();
            }
        });
    }
    else {
        alert("You must be logged in to do this.");
    }
}

function postMessage(message) {
    if (isLoggedIn()) {
        var params = `username=${loggedInUser}&token=${loginToken}&message=${message}`;
        if (viewingUser && loggedInUser != viewingUser) {
            params += `&friend=${viewingUser}`;
        }

        $.get("http://localhost:3000/postmessage", params, function(data, status) {
            if (status == "success") {
                updateMessageBoard();
            }
        });
    }
    else {
        alert("You must be logged in to do this.");
    }
}

function markAsRead(element) {
    if (isLoggedIn() && (!viewingUser || viewingUser == loggedInUser) && element.getAttribute("data-message-flagged") == "false") {
        var id = element.getAttribute("data-message-id");
        $.get("flagmessage", `username=${loggedInUser}&token=${loginToken}&ID=${id}`, function(data, status) {
            if (status == "success") {
            }
        });
        // Local update. Requesting messages from the server would be overkill here.
        markElementAsRead(element, true);
    }
}

function updateMessageBoard() {
    var messageBoard = document.getElementById("message-board");
    var messageElements = messageBoard.children;

    // First hide all elements.
    for (var i = 0; i < messageElements.length; ++i) {
        messageElements[i].classList.add("hide");
    }

    // Check if a user is logged in.
    if (isLoggedIn()) {
        var params = `username=${loggedInUser}&token=${loginToken}`;
        if (viewingUser && loggedInUser != viewingUser) {
            params += `&friend=${viewingUser}`;
        }

        $.get("http://localhost:3000/getmessages", params, function(data, status) {
            if (status == "success") {
                // Increase message list if needed.
                while (messageElements.length < data.length) {
                    var messageItem = messageBoard.children[0].cloneNode(true);
                    messageItem.children[1].onclick = function() {
                        markAsRead(this.parentElement);
                    }
                    messageBoard.appendChild(messageItem);
                }

                for (var i = 0; i < data.length; i++) {
                    var post = data[(data.length - 1) - i];
                    messageElements[i].setAttribute("data-message-id", post.id);
                    messageElements[i].children[0].innerHTML = "<b>" + post.from + "</b>" + " says: " + post.message;
                    messageElements[i].setAttribute("data-message-flagged", post.flag);
                    markElementAsRead(messageElements[i], post.flag);
                    messageElements[i].classList.remove("hide");
                    var markAsReadButton = messageElements[i].children[1];
                    if (viewingUser && viewingUser != loggedInUser) {
                        markAsReadButton.classList.add("hide");
                    }
                    else {
                        markAsReadButton.classList.remove("hide");
                    }
                }
            }
            else {
                alert(`Server says: STATUS ${status}: ${data}`);
            }
        });
    }
}

function updateFriendsList() {
    var container = document.getElementById("list-friends");
    var friendList = document.getElementById("list-friends-my");
    var friendElements = friendList.children;

    // First hide all elements.
    for (var i = 0; i < friendElements.length; ++i) {
        friendElements[i].classList.add("hide");
    }

    if (isLoggedIn()) {
        container.classList.remove("hide");

        // First get friends, then get all users and filter out friends.
        $.get("http://localhost:3000/getfriends", `username=${loggedInUser}&token=${loginToken}`, function(data, status) {
            if (status == "success") {
                var friends = data;

                // Increase friend list if needed.
                while (friendElements.length < friends.length) {
                    var friendElement = friendList.children[0].cloneNode(true);
                    friendElement.onclick = function() {
                        friendClick(this);
                    }
                    friendList.appendChild(friendElement);
                }

                for (var i = 0; i < friends.length; i++) {
                    friendElements[i].innerHTML = friends[i];
                    friendElements[i].setAttribute("data-friend-name", friends[i]);
                    friendElements[i].classList.remove("hide");
                }
            }
            else {
                alert(`Server says: STATUS ${status}: ${data}`);
            }
        });
    }
    else {
        // Hide everything.
        container.classList.add("hide");
    }
}

function updateUserList() {
    var addFriendList = document.getElementById("list-friends-add");
    var addFriendElements = addFriendList.children;

    // Hide all elements.
    for (var i = 0; i < addFriendElements.length; ++i) {
        addFriendElements[i].classList.add("hide");
    }

    if (isLoggedIn()) {
        var search = document.getElementById("search-user-textbox").value;

        if (search && search.length >= 2) {
            $.get(`http://localhost:3000/getusers?search=${search}`, "", function(data, status) {
                if (status == "success") {
                    // Filter out the logged in user.
                    var allUsers = data.filter(user => user != loggedInUser);

                    // Increase friend list if needed.
                    while (addFriendElements.length < allUsers.length) {
                        var addFriendElement = addFriendList.children[0].cloneNode(true);
                        addFriendElement.onclick = function() {
                            friendClick(this);
                        }
                        addFriendList.appendChild(addFriendElement)
                    }

                    for (var i = 0; i < allUsers.length; i++) {
                        addFriendElements[i].innerHTML = allUsers[i];
                        addFriendElements[i].setAttribute("data-user-name", allUsers[i]);
                        addFriendElements[i].classList.remove("hide");
                    }
                }
                else {
                    alert(`Server says: STATUS ${status}: ${data}`);
                }
            });
        }
    }
}

function updateLogInStatus() {
    document.getElementById("input-username").value = "";
    document.getElementById("input-password").value = "";

    var loginStatus = document.getElementById("login-status");
    //var logOutButton = document.getElementById("btn-sign-out");
    if (isLoggedIn()) {
        loginStatus.innerHTML = `Welcome ${loggedInUser}!`;
        //logOutButton.classList.add("show");
    }
    else {
        loginStatus.innerHTML = "Log in or register an account to join in on all the fun!";
        //logOutButton.classList.remove("show");
    }

    var welcomeText = document.getElementById("welcome-text");
    if (!isLoggedIn()) {
        welcomeText.innerHTML = "Welcome to the message board!";
    }
    else if (!viewingUser || viewingUser == loggedInUser) {
        welcomeText.innerHTML = "Welcome to your message board!";
    }
    else {
        welcomeText.innerHTML = `Welcome to ${viewingUser}'s message board!`;
    }
}

/*******************************************************************************
    INITIALIZATION
*******************************************************************************/

$(document).ready(function() {
    refreshPage();
});
