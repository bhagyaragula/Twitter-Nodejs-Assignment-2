const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();

dbPath = path.join(__dirname, "twitterClone.db");

app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running http://localhost:3000/");
    });
  } catch (e) {
    console.log("DB Error: ${e.message}");
    process.exit(1);
  }
};

initializeDbAndServer();

//API1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const checkUsername = ` SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUsername);
  console.log(dbUser);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const requestQuery = `INSERT INTO user(name, username, password, gender)
                VALUES ('${name}', '${username}', '${password}', '${gender}');`;
      await db.run(requestQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

//API2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUser = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUser);
  if (dbUser !== undefined) {
    const checkPassword = await bcrypt.compare(password, dbUser.password);
    if (checkPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secret_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }

  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "secret_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API3

app.get(
  "/user/tweets/feed/",
  authenticationToken,
  async (request, response) => {
    const { username } = request;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
    const getUserId = await db.get(getUserIdQuery);

    const getFollowerIdQuery = `SELECT following_User_id FROM follower 
             WHERE follower_user_id = ${getUserId.user_id};`;
    const getFollowerId = await db.all(getFollowerIdQuery);

    const getFollowerIdSimple = getFollowerId.map((eachUser) => {
      return eachUser.following_user_id;
    });

    const getTweetQuery = `SELECT user.username, tweet.tweet, date_time AS dateTime
          FROM user INNER JOIN tweet ON user.user_id = tweet.user_id
          WHERE user.user_id IN (${getFollowerIdSimple}) ORDER BY tweet.date_time 
          DESC LIMIT 4;`;
    const responseResult = await db.all(getTweetQuery);
    response.send(responseResult);
  }
);

//API4

app.get("/user/following/", authenticationToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);

  const getFollowingIdQuery = `SELECT following_user_id FROM follower
          WHERE follower_user_id =${getUserId.user_id};`;
  const getFollowingIdArray = await db.all(getFollowingIdQuery);
  const getFollowingId = getFollowingIdArray.map((eachUser) => {
    return eachUser.following_user_id;
  });

  const getFollowersResultQuery = `SELECT name FROM user WHERE user_id IN (${getFollowingId});`;
  const responseResult = await db.all(getFollowersResultQuery);
  response.send(responseResult);
});

//API5

app.get("/user/followers/", authenticationToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);

  const getFollowersIdQuery = `SELECT follower_user_id FROM follower
          WHERE following_user_id =${getUserId.user_id};`;
  const getFollowersIdArray = await db.all(getFollowersIdQuery);
  console.log(getFollowersIdArray);
  const getFollowersId = getFollowersIdArray.map((eachUser) => {
    return eachUser.follower_user_id;
  });
  console.log(`${getFollowersId}`);

  const getFollowersNameQuery = `SELECT name FROM user WHERE user_id IN (${getFollowersId});`;
  const responseResult = await db.all(getFollowersNameQuery);
  response.send(responseResult);
});

//API6

const tweetOutput = (tweetData, likesCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.dateTime,
  };
};

app.get("/tweets/:tweetId/", authenticationToken, async (request, response) => {
  const { tweetId } = request.params;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);

  const getFollowingIdQuery = `SELECT following_user_id FROM follower
          WHERE follower_user_id =${getUserId.user_id};`;
  const getFollowingIdArray = await db.all(getFollowingIdQuery);
  const getFollowingId = getFollowingIdArray.map((eachUser) => {
    return eachUser.following_user_id;
  });

  const getTweetIdQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (${getFollowingId});`;
  const getTweetIdArray = await db.all(getTweetIdQuery);
  const followingTweetId = getTweetIdArray.map((eachId) => {
    return eachId.tweetId;
  });

  if (followingTweetId.includes(parseInt(tweetId))) {
    const likes_count_query = `SELECT COUNT(user_id) AS likes FROM like WHERE tweet_id = ${tweetId};`;
    const likes_count = await db.get(likes_count_query);

    const reply_count_query = `SELECT COUNT(user_id) AS replies FROM reply WHERE tweet_id = ${tweetId};`;
    const reply_count = await db.get(reply_count_query);

    const tweet_date_query = `SELECT tweet, date_time FROM tweet WHERE tweet_id = ${tweetId};`;
    const tweet_date = await db.get(tweet_date_query);

    response.send(tweet_date, likes_count, reply_count);
  } else {
    response.status(401);
    response.send("Invalid Request");
    console.log("Invalid Request");
  }
});

//API7

const convertLikedUserNameDbObjectToResponseObject = (dbObject) => {
  return {
    likes: dbObject,
  };
};

app.get(
  "/tweets/:tweetId/likes/",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);

    const getFollowingIdQuery = `SELECT following_user_id FROM follower
          WHERE follower_user_id =${getUserId.user_id};`;
    const getFollowingIdArray = await db.all(getFollowingIdQuery);
    const getFollowingId = getFollowingIdArray.map((eachUser) => {
      return eachUser.following_user_id;
    });

    const getTweetIdQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (${getFollowingId});`;
    const getTweetIdArray = await db.all(getTweetIdQuery);
    const followingTweetId = getTweetIdArray.map((eachId) => {
      return eachId.tweet_id;
    });

    if (followingTweetId.includes(parseInt(tweetId))) {
      const getLikedUserNameQuery = `SELECT user.username AS likes FROM user 
      INNER JOIN like ON user.user_id = like.user_id WHERE like.tweet_id = ${tweetId};`;
      const getLikedUserNameArray = await db.all(getLikedUserNameQuery);
      const getLikedUserName = getLikedUserNameArray.map((eachUser) => {
        return eachUser.likes;
      });
      response.send(
        convertLikedUserNameDbObjectToResponseObject(getLikedUserName)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API8

const convertReplyUserNameDbObjectToResponseObject = (dbObject) => {
  return {
    replies: dbObject,
  };
};

app.get(
  "/tweets/:tweetId/replies/",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);

    const getFollowingIdQuery = `SELECT following_user_id FROM follower
          WHERE follower_user_id =${getUserId.user_id};`;
    const getFollowingIdArray = await db.all(getFollowingIdQuery);
    const getFollowingId = getFollowingIdArray.map((eachUser) => {
      return eachUser.following_user_id;
    });

    const getTweetIdQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (${getFollowingId});`;
    const getTweetIdArray = await db.all(getTweetIdQuery);
    const followingTweetId = getTweetIdArray.map((eachId) => {
      return eachId.tweet_id;
    });

    if (followingTweetId.includes(parseInt(tweetId))) {
      const getReplyUserNameQuery = `SELECT user.name AS reply.reply FROM user 
      INNER JOIN reply ON user.user_id = reply.user_id WHERE reply.tweet_id = ${tweetId};`;
      const getReplyUserNameArray = await db.all(getReplyUserNameQuery);

      response.send(
        convertReplyUserNameDbObjectToResponseObject(getReplyUserNameArray)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API9

app.get("/user/tweets/", authenticationToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  console.log(getUserId);

  const getTweetIdQuery = `SELECT tweet_id FROM tweet WHERE user_id=${getUserId.user_id};`;
  const getTweetIdArray = await db.all(getTweetIdQuery);
  const getTweetId = getTweetIdArray.map((eachId) => {
    return parseInt(eachId.tweet_id);
  });
  console.log(getTweetId);
});

//API10

app.post("/user/tweets/", authenticationToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const { tweet } = request.body;
  const currentDate = new Date();
  console.log(currentDate.toISOString().replace("T", " "));

  const postRequestQuery = `INSERT INTO tweet(tweet, user_id, date_time)
         VALUES ('${tweet}', '${getUserId.user_id}', '${currentDate}');`;
  const responseResult = await db.run(postRequestQuery);
  const tweet_id = responseResult.lastID;
  response.send("Created a Tweet");
});

//API11

app.delete(
  "/tweets/:tweetId/",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    console.log(getUserId);

    const getTweetIdQuery = `SELECT tweet_id FROM tweet WHERE user_id=${getUserId.user_id};`;
    const getTweetIdArray = await db.all(getTweetIdQuery);
    const getTweetId = getTweetIdArray.map((eachId) => {
      return eachId.tweet_id;
    });
    console.log(getTweetId);

    if (getTweetId.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `DELETE FROM tweet 
            WHERE tweet_id=${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
