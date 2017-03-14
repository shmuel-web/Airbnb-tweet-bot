/**
 * Created by shmuel-d on 14.3.2017.
 */

'use strict';

const    Twitter  = require('twitter'),
         moment   = require('moment'),
         keys     = require("./keys"),
         Promise  = require("bluebird"),
         json2csv = require('json2csv'),
         mailer   = require('nodemailer'),
         fs       = require('fs');

let      client    = new Twitter(keys.twitter),
         last24h   = moment().subtract(24, 'hours'),
         allTweets = [],
         lastTweet = {},
         params    = {
            q: 'airbnb',
            count: 100,
            include_entities: false
         };

function getAirBnbTweets(maxId) {

    if (maxId) {
        //adding the last received tweet id to the new API query
        params.max_id = maxId;
    }
    return new Promise((resolve, reject) => {

        client.get('search/tweets', params, (err, tweets, response) => {

            if (err) {
                reject(err);
            }

            //checking how many API calls we have left!
            if (response.headers['x-rate-limit-remaining'] == 0){
                console.log("we used up all our API calls waiting 15 minutes to retry...");
                setTimeout(() => {
                    resolve()
                }, 1000 * 60 * 15);
            }
            else{
                lastTweet = tweets.statuses[tweets.statuses.length - 1];
                allTweets = allTweets.concat(tweets.statuses);
                resolve();
            }
        })
    })
    .then(() => {
        //recurs
        if (new Date(lastTweet.created_at) >= last24h) {
            console.log("tweets colected: " +allTweets.length);
            return getAirBnbTweets(lastTweet.id)//calling the api with the last tweet id as the courser
        }
    })
}

console.log("searching the twitter API for Airbnb reference's in the last 24 hours this will take a few minutes...");
getAirBnbTweets()
    .then(() => {

        console.log(`retrieved ${allTweets.length} tweets all most there...`);
        //filtering out older the 24H old tweets
        allTweets = allTweets.filter(tweet => {
            return (new Date(tweet.created_at) >= last24h)
        });
        //parsing the tweets in to a CSV
        let fields = ['created_at', 'lang', 'text'];
        return json2csv({data: allTweets, fields: fields});
    })
    .then(csv => {

        console.log("parsed tweets to csv, sending mail...");
        return new Promise((resolve, reject) => {

            let transporter = mailer.createTransport(keys.mail);
            let mailOptions = {
                from: '"Shmuel Disraeli" <shmuel.disraeli@gmail.com>',
                to: 'dev@guesty.com, shmuel.disraeli@gmail.com', // list of receivers
                subject: 'Airbnb tweets in the last 24 hours', // Subject line
                text: "Good morning people! \nhere are all Airbnb references in twitter from the last 24 hours", // plain text body
                attachments: [
                    {
                        filename: 'last24hAirbnbTweets.csv',
                        content: csv
                    }
                ]
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    reject(error);
                }
                resolve();
            });
        })
    })
    .then(() => console.log('mail sent! all done!'))
    .catch(err => console.log("sorry something bad happened! " + err.message));
